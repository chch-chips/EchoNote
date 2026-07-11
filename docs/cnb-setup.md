# CNB 零新增服务器部署接入

本文记录 EchoNote 从 GitHub 合并到腾讯云 CNB 构建、TCR 存储和现有 CVM 部署的接入步骤。所有步骤默认使用现有 2GB CVM 与 TCR 个人版，不购买 TKE、TCR 企业版或额外服务器。

## 1. 最终链路

```text
GitHub feature branch / PR
-> GitHub Actions CI
-> merge main
-> GitHub 将已验证 main 的小体积 Git 数据同步到 CNB
-> CNB 构建 runtime + migrate 两个不可变镜像
-> CNB 推送到 TCR 个人版
-> DEPLOY_ENABLED=true 时，通过受限 SSH 用户调用服务器部署脚本
-> pull -> migrate -> switch -> health check -> rollback on failure
```

GitHub 不再保存生产 root 私钥或 TCR 密码，也不再上传 release 或 Docker 镜像到腾讯云。

## 2. 创建 CNB 免费资源

1. 打开 <https://cnb.cool>，使用微信扫码登录。
2. 使用现有顶层组织 `chch_chips`。
3. 使用已创建的私有代码仓库 [`chch_chips/echonote`](https://cnb.cool/chch_chips/echonote)。该仓库由 GitHub 同步，不在 CNB 侧单独维护代码。
4. 在同一组织下创建一个私有密钥仓库（KeyStore），名称固定为 `echonote-secrets`。
5. 不绑定付费预算。免费额度用尽时让构建停止，避免意外付费。

根目录 `.cnb.yml` 已固定引用同一组织下的 `chch_chips/echonote-secrets`，避免首个 POC 依赖额外的路径变量解析。

## 3. 配置 TCR 构建凭据

在 `echonote-secrets` 中创建 `registry.yml`，参考仓库内：

```text
deploy/cnb/registry.example.yml
```

需要替换：

- `allow_slugs`：保持为 `chch_chips/echonote`。
- `TCR_IMAGE_REPOSITORY`：改为现有 EchoNote TCR 仓库完整路径，不带 tag。
- `TCR_USERNAME` / `TCR_PASSWORD`：使用 TCR 登录凭据。

首次验证必须保持：

```yaml
DEPLOY_ENABLED: "false"
```

这样 CNB 只构建并推送镜像，不连接生产服务器。

## 4. 准备部署密钥占位文件

在 `echonote-secrets` 中创建 `deploy.yml`，参考：

```text
deploy/cnb/deploy.example.yml
```

首次 POC 可以暂时保留无效私钥占位，因为 `DEPLOY_ENABLED=false` 时部署步骤会跳过。正式启用前必须替换为专用 `echonote-deploy` 私钥；不得复用 root 私钥或现有 `chips.pem`。

## 5. 配置 GitHub 到 CNB 的源码同步

在 CNB 为 `echonote` 仓库创建具有仓库写入权限、可撤销且设置有效期的访问令牌。

在 GitHub 仓库 Settings -> Secrets and variables -> Actions 中配置：

Repository secret：

```text
CNB_ACCESS_TOKEN=<CNB access token>
```

Repository variables：

```text
CNB_REPO_URL=https://cnb.cool/chch_chips/echonote.git
CNB_SYNC_ENABLED=true
```

`CNB_SYNC_ENABLED` 未设置为 `true` 时，GitHub 的同步 job 会安全跳过。同步只推送 Git 数据，不传 Docker 镜像或生产 secret。

## 6. 构建-only POC 验收

首次同步 `main` 后，在 CNB 检查：

1. `.cnb.yml` 被识别并触发 `build-and-deploy-production`。
2. runtime target 构建成功。
3. migrate target 构建成功。
4. TCR 出现两个不可变 tag：

```text
sha-<full-git-sha>
migrate-sha-<full-git-sha>
```

5. `Deploy healthy image to CVM` 显示为跳过。
6. 生产 `echonote-web` / `echonote-worker` 仍由 systemd 运行且健康。

POC 没有全部通过前，不准备服务器、不启用自动部署。

## 7. 一次性服务器准备

该步骤会写入生产服务器，必须再次得到用户确认后执行。

准备内容：

1. 生成专用 ed25519 密钥对，只用于 CNB -> `echonote-deploy`。
2. 将公钥和以下文件安全上传到服务器临时目录：
   - `scripts/bootstrap-cnb-deploy.sh`
   - `scripts/deploy-cnb.sh`
   - `docker-compose.prod.yml`
3. 以 root 执行：

```bash
bash scripts/bootstrap-cnb-deploy.sh \
  ccr.ccs.tencentyun.com/<namespace>/echonote \
  /path/to/echonote-deploy.pub
```

bootstrap 只完成以下动作，不切换运行服务：

- 创建 `echonote-deploy` 非 root 用户。
- 使用 `restrict` 公钥限制 SSH 转发能力。
- 安装 root-owned `/usr/local/sbin/echonote-deploy`。
- 安装 root-owned Compose 文件和镜像白名单。
- 仅允许 deploy 用户通过 sudo 调用经过镜像/release 校验的部署脚本。

4. root 在服务器执行一次 TCR 登录，密码通过 stdin 输入，不写入命令历史：

```bash
read -rsp 'TCR password: ' TCR_PASSWORD
printf '%s' "$TCR_PASSWORD" | docker login ccr.ccs.tencentyun.com \
  -u '<TCR username>' --password-stdin
unset TCR_PASSWORD
```

5. 将专用私钥写入 CNB `deploy.yml`，不得写入 GitHub、普通仓库或服务器应用目录。

## 8. 首次切换与回滚演练

在 `registry.yml` 将 `DEPLOY_ENABLED` 改为 `true` 前，先手动调用一次新部署脚本完成受控切换。脚本顺序为：

1. 校验 TCR 仓库和完整 commit SHA。
2. 当前 systemd 版本继续在线时拉取 runtime/migrate 镜像。
3. 当前版本继续在线时执行向后兼容 migration。
4. 仅在镜像和 migration 成功后停止旧 systemd 进程。
5. 启动容器并检查直连 `3001` 与 nginx `8081`。
6. 失败时恢复旧 systemd 版本；后续版本失败时恢复上一容器镜像。
7. 成功后才禁用旧 systemd 开机自启。

建议在低风险窗口演练一次指定旧 SHA 的应用镜像回滚。数据库 migration 不自动向下回滚，schema 变更必须遵循 expand/contract 和向后兼容规则。

## 9. 正式启用

完成 build-only POC、首次容器切换，并确认部署密钥与服务器 TCR 登录可用后，将 KeyStore 的 `registry.yml` 改为：

```yaml
DEPLOY_ENABLED: "true"
```

之后每次 GitHub PR 合并到 `main`，将自动完成 CNB 构建、TCR 推送和 CVM 部署。

## 10. 日常检查

服务器：

```bash
tail -n 200 /var/log/echonote-deploy.log
docker compose -f /opt/echonote-runtime/docker-compose.prod.yml ps
docker logs --tail=200 echonote-web
docker logs --tail=200 echonote-worker
curl -fsS -I http://127.0.0.1:8081/login
```

部署状态：

```bash
cat /var/lib/echonote-deploy/current.env
```

状态文件只记录镜像引用和 commit，不包含数据库或 API secret。

## 11. 当前验收状态

截至 2026-07-11，以下链路已在生产环境完成验证：

- GitHub `main` 合并后，GitHub Actions 成功同步源码到 CNB。
- CNB 成功构建 runtime 与 migrate 两个 Docker target，并推送带完整 commit SHA 的 TCR tags。
- CNB 使用 KeyStore 中的专用 `echonote-deploy` 私钥连接 CVM，调用 root-owned 部署脚本。
- CVM 成功拉取镜像、确认 Prisma migrations 无待执行项、切换 Web 与 worker 容器，并通过 `127.0.0.1:3001/login` 和 `127.0.0.1:8081/login` 健康检查。
- 旧 `echonote-web` 与 `echonote-worker` systemd 服务已禁用；生产服务器不再从 GitHub 拉代码或本地构建。

日常发布只需将经 CI 验证的 PR 合并至 `main`。若部署失败，先保留现场并查看 CNB 记录及第 10 节的服务器日志；不要通过重新执行 `git pull` 或 `npm ci` 绕过该链路。
