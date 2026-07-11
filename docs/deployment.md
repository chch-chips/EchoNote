# 部署说明

本文档记录当前服务器事实和后续安全部署路径。它不是服务器变更授权；任何写入、创建数据库、部署服务之前都需要再次确认。

## 已知服务器

- SSH 别名：`chips-server`
- 系统：腾讯云 OpenCloudOS / Linux
- Docker：28.0.1
- Docker Compose：2.32.1

2026-06-27 只读检查结果：

- hostname：`VM-0-8-opencloudos`
- 已有容器：`gewu-postgres`
- 镜像：`pgvector/pgvector:pg18-trixie`
- 状态：healthy
- 端口：`127.0.0.1:5432->5432/tcp`

## 操作规则

- 未经确认，不停止、不删除、不重启、不覆盖 `gewu-postgres`。
- 不打印、不提交数据库密码。
- 不把 5432 暴露到公网。
- EchoNote 使用独立数据库和独立用户。
- 真实配置只放 `.env` 或服务器 secret 文件，不能进 Git。

## 本地通过 SSH 隧道开发

当前本地开发连接隔离 dev 数据库，不连接生产库：

- dev 数据库：`echo_note_dev`
- dev 用户：`echo_note_dev_user`
- 本地隧道：`127.0.0.1:15432`

```powershell
ssh -N -L 15432:127.0.0.1:5432 chips-server
```

本机 `.env` 使用：

```env
DATABASE_URL="postgresql://echo_note_dev_user:<password>@127.0.0.1:15432/echo_note_dev?schema=public"
```

生产库仍为 `echo_note` / `echo_note_user`，只供服务器上的 `echonote-web` 和 `echonote-worker` 使用。

## 后续服务器建库计划

获得确认后：

1. SSH 到 `chips-server`。
2. 在不打印密码的前提下读取现有 Postgres 管理凭据。
3. 创建 `echo_note` 数据库和 `echo_note_user` 用户。
4. 保持 Postgres 只监听服务器本机地址。
5. 通过 SSH 隧道在本地执行迁移，或未来从应用容器执行迁移。

## EchoNote Web 与 AI worker

EchoNote 生产构建使用 `output: "standalone"`。生产环境需要两个长期进程。

Web 进程：

```powershell
npm run build
$env:PORT="3000"
node .next\standalone\server.js
```

AI worker 进程：

```powershell
npm run worker:ai
```

`next start` 不适用于当前 standalone 输出。

本地开发可用：

```powershell
npm run dev:all
```

### Codex 桌面环境启动 Web dev server

普通终端中仍然优先使用：

```powershell
npm run dev
```

Codex 桌面工具里不要把 `npm run dev` 作为前台长期命令直接挂住。2026-06-30 复测稳定的做法是用 `cmd start /b` 脱离当前工具调用，并把日志写入本地文件：

```powershell
$cwd = "D:\code\xiaoji"
$node = "D:\Program Files\nodejs\node.exe"
$out = Join-Path $cwd "dev.codex.out.log"
$err = Join-Path $cwd "dev.codex.err.log"
$q = [char]34
$inner = "$q$node$q $q.\node_modules\next\dist\bin\next$q dev > $q$out$q 2> $q$err$q"
$startCommand = "start $qEchoNoteDev$q /b cmd.exe /d /c $q$inner$q"
Push-Location $cwd
& $env:ComSpec /d /c $startCommand
Pop-Location
```

验活：

```powershell
Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing -TimeoutSec 10
netstat -ano | Select-String ":3000"
```

停止时先从 `netstat` 找到监听 `:3000` 的 PID，再停止该进程树：

```powershell
taskkill /PID <PID> /T /F
```

注意：这只启动 Web dev server。若 `.env` 中的 `DATABASE_URL` 指向 `127.0.0.1:15432`，仍需另开终端保持 SSH 隧道：

```powershell
ssh -N -L 15432:127.0.0.1:5432 chips-server
```

新增 `MemoryRainSnapshot` 等表结构后，需要在确认数据库连接安全的前提下执行对应 Prisma migration。已上线环境不要再把 `db:push` 当作常规同步方式。

```powershell
npm run db:migrate
```

当前 dev 数据库从空库开始，已经使用 `prisma/migrations/` 中的 baseline 和后续迁移初始化。生产库早于 migration 历史存在，首次生产切换到 migration 流程时，需要先确认 baseline 与生产 schema 等价，再用 `prisma migrate resolve --applied "20260702000000_baseline_schema"` 记录 baseline，避免重复创建既有表。

不要把 AI worker 放进单个 Next.js Route Handler 长循环里；生产部署应使用 systemd、PM2、Docker Compose 或同等进程管理方式分别守护 Web 和 worker。

## 2026-07-01 服务器隔离部署记录

本次部署目标是在同一台腾讯云服务器上运行 EchoNote，同时不影响已经占用 `80` 端口的既有前后端项目。

已确认既有项目：

- nginx 站点：`/www/server/panel/vhost/nginx/101.35.48.157.conf`
- 监听：`80`
- 前端根目录：`/www/wwwroot/yu-picture-frontend`
- API 代理：`/api` -> `127.0.0.1:8123`

EchoNote 使用隔离部署：

- 代码目录：`/opt/echonote`
- 生产环境变量：`/etc/echonote/echonote.env`
- Web systemd 服务：`echonote-web`
- AI worker systemd 服务：`echonote-worker`
- Web 内部监听：`127.0.0.1:3001`
- nginx 独立入口：`/www/server/panel/vhost/nginx/echonote-8081.conf`
- nginx 公网监听：`8081`
- 访问地址：`http://101.35.48.157:8081`
- 当前入口是 HTTP，不是 HTTPS，因此 `/etc/echonote/echonote.env` 中设置 `SESSION_COOKIE_SECURE=false`。未来切换到 HTTPS 域名后应改回 `true`，再重启 `echonote-web`。

当前服务器内验证结果：

```bash
systemctl status echonote-web echonote-worker
curl -I http://127.0.0.1:8081/login
```

`echonote-web` 与 `echonote-worker` 均已启用开机自启。服务器本机访问 `127.0.0.1:8081/login` 返回 `200 OK`。

注意：服务器系统防火墙 `firewalld` 当前为 inactive，但从公网直连 `101.35.48.157:8081` 超时，说明腾讯云安全组大概率尚未放行 `8081/tcp`。在腾讯云控制台放行该端口后，公网 IP 访问才会生效。不要为了公网访问直接接管现有 `80` 端口，除非确认要迁移或合并既有项目入口。

若 HTTP 入口可以打开登录页但登录后仍回到登录页，优先检查 cookie Secure 模式：

```bash
grep '^SESSION_COOKIE_SECURE=' /etc/echonote/echonote.env
```

HTTP 临时访问应为：

```env
SESSION_COOKIE_SECURE=false
```

HTTPS 正式访问应为：

```env
SESSION_COOKIE_SECURE=true
```

### 历史 systemd 手动发布（已停用）

在本地开发完成并推送到 `origin/main` 后，SSH 到服务器执行：

```bash
cd /opt/echonote
git pull origin main
npm ci
npm run db:generate
npm run db:deploy
npm run build
mkdir -p .next/standalone/.next
[ -d public ] && cp -a public .next/standalone/
cp -a .next/static .next/standalone/.next/
systemctl restart echonote-web echonote-worker
systemctl status echonote-web echonote-worker
curl -I http://127.0.0.1:8081/login
```

若只是文案或前端变更且 Prisma schema 未变化，可以跳过 `npm run db:deploy`。若 `prisma/migrations/` 有新增迁移，必须先执行 `db:deploy`，再构建和重启服务。

### 历史 Codex 直连 systemd 发布（已停用）

此路径仅保留为迁移历史，不得再作为生产发布方式。生产发布必须走 GitHub → CNB → TCR → Docker Compose；旧 systemd 服务已禁用。

适用场景：

- 用户想先把当前 `origin/main` 版本发布到服务器，而不是继续推进自动部署链路。
- 变更已经在 GitHub 合并到 `main`，或用户明确指定要发布的提交。
- 需要保守沿用当前生产运行方式，避免切换到尚未确认的 Docker Compose / 容器镜像路径。

执行边界：

- 发布前必须由用户明确确认，因为该操作会修改生产服务器、构建生产包并重启服务。
- 默认发布 `origin/main`。如果要发布其他分支或特定 commit，必须先让用户明确指定。
- 不执行 `scripts/deploy-container.sh`。
- 不停止、不禁用 `echonote-web` / `echonote-worker` 之外的服务。
- 只有当 `prisma/migrations/` 有新增迁移，或用户明确要求时，才执行 `npm run db:deploy`。
- 不打印 `.env`、数据库密码、API key 或其他 secret。

发布前只读确认：

```powershell
ssh chips-server "hostname; cd /opt/echonote && git rev-parse --abbrev-ref HEAD && git rev-parse --short HEAD && git status --short && systemctl is-active echonote-web echonote-worker"
git diff --name-status <server-current-commit>..origin/main -- prisma prisma.config.ts package.json package-lock.json src
```

常规发布命令：

```bash
cd /opt/echonote
git pull --ff-only origin main
npm run db:generate

# 仅当 prisma/migrations/ 有新增迁移时执行
npm run db:deploy

npm run build
mkdir -p .next/standalone/.next
[ -d public ] && cp -a public .next/standalone/
cp -a .next/static .next/standalone/.next/
systemctl restart echonote-web echonote-worker
systemctl is-active echonote-web echonote-worker
curl -fsS -I --connect-timeout 10 http://127.0.0.1:8081/login
```

发布后验证：

```powershell
Invoke-WebRequest -Uri http://101.35.48.157:8081/login -UseBasicParsing -TimeoutSec 10
```

2026-07-09 验证记录：Codex 使用该路径将服务器 `/opt/echonote` 更新到 `main@4f50d2f`，执行 `npm run db:generate`、`npm run build`、同步 standalone 静态资源并重启 `echonote-web` / `echonote-worker`。服务器本机 `http://127.0.0.1:8081/login` 和公网 `http://101.35.48.157:8081/login` 均返回 `200 OK`。

### 常用运维命令

查看日志：

```bash
journalctl -u echonote-web -f
journalctl -u echonote-worker -f
```

重启服务：

```bash
systemctl restart echonote-web
systemctl restart echonote-worker
```

检查 nginx 入口：

```bash
/www/server/nginx/sbin/nginx -t
ss -ltnp | grep -E ':(3001|8081) '
curl -I http://127.0.0.1:8081/login
```

### 目标自动部署：GitHub CI + CNB + TCR + CVM

2026-07-10 用户确认采用零新增服务器方案。GitHub Actions 只做 CI，不再持有 TCR 密码、生产 SSH 私钥或直接执行生产部署。

目标链路：

```text
feature branch -> GitHub PR -> GitHub Actions CI
-> 用户合并 main
-> GitHub 同步已验证 Git 数据到 CNB
-> CNB 构建 runtime/migrate 不可变镜像
-> CNB 推送 TCR 个人版
-> 受限 echonote-deploy 用户调用 root-owned 部署脚本
-> pull -> migrate -> switch -> health check -> rollback on failure
```

仓库文件：

- `.github/workflows/ci.yml`：CI 与可开关的 CNB 源码同步。
- `.cnb.yml`：CNB build/push/deploy Pipeline as Code。
- `Dockerfile`：`runtime` 与 `migrate` targets。
- `docker-compose.prod.yml`：Web、worker 和临时 migration 服务。
- `scripts/deploy-cnb.sh`：部署、健康检查与自动恢复。
- `scripts/bootstrap-cnb-deploy.sh`：一次性安装受限部署边界，不切换运行服务。
- `docs/cnb-setup.md`：用户开通与验收步骤。

CNB build-only POC、首次容器切换和自动部署已完成验收，KeyStore 的 `DEPLOY_ENABLED` 已启用。生产由 `/opt/echonote-runtime/docker-compose.prod.yml` 管理 `echonote-web` 与 `echonote-worker`；旧 systemd 服务已禁用，不能再作为常规发布路径。故障时优先检查 CNB 记录、`/var/log/echonote-deploy.log`、`/var/lib/echonote-deploy/current.env` 和容器健康状态。

### 历史失败与 2026-07-10 新决策

截至 2026-07-09，自动部署链路仍处于待推进状态，不要把当前容器化方案视为已经确认的生产发布路径。已经尝试过的方向如下：

1. 服务器 pull 模式：服务器执行 `git fetch` / `git pull`，在 `fetching origin/main` 附近多次超时。
2. artifact push 模式：GitHub-hosted runner 通过 `scp` / `rsync` 向服务器传 release 文件，上传链路超时。
3. 容器镜像模式：GitHub-hosted runner 构建 Docker 镜像并推送到腾讯云 CCR/TCR，`Build and push container image` 在推送镜像层时 35 分钟超时。

这些失败共同指向同一个事实：GitHub-hosted runner 到腾讯云中国区的长时间大文件/镜像传输链路不稳定。继续单纯增加 `timeout-minutes`、反复 rerun、或在 `scp` / `rsync` / `docker push` 参数上打补丁，不是当前推荐方向。

新链路完成 POC 前，生产服务器仍不要执行以下动作，除非用户重新明确确认：

- 不安装或注册 GitHub self-hosted runner。
- 不停止、不禁用旧的 `echonote-web` / `echonote-worker` systemd 服务。
- 不执行旧的 `scripts/deploy-container.sh`（该文件已经由安全的新脚本替换）。
- 不在健康检查和回滚演练前切换到 Docker Compose。
- 不重跑会实际部署或推送大镜像的 GitHub Actions。

2026-07-10 已确定：不购买新服务器、不使用生产机 self-hosted runner、不新购已进入退市周期的 CODING DevOps。使用其下一代 CNB 社区版免费额度，在腾讯云侧构建并推送镜像；现有 2GB CVM 只负责运行。worker 改为构建后的 JavaScript bundle，runtime 镜像不再复制完整 `node_modules`。

下面的旧 GitHub-hosted runner 容器方案只作为失败历史保留，不得恢复为生产路径。

历史容器镜像流程：

```text
GitHub Actions checkout
-> npm ci
-> npm run db:generate
-> npm run typecheck
-> npm run lint
-> docker build
-> docker push ccr.ccs.tencentyun.com/<namespace>/echonote:sha-<git-sha>
-> 上传小型 docker-compose.prod.yml 与 deploy-container.sh 到服务器
-> 服务器 docker login 腾讯云镜像仓库
-> docker compose pull
-> docker compose run --rm migrate
-> docker compose up -d web worker
-> health check
```

服务器只接收很小的 compose 和部署脚本文件；应用代码、依赖、Next.js standalone 输出、worker 脚本和 Prisma migration 都封装在 Docker 镜像中，通过腾讯云容器镜像仓库分发。

旧方案曾要求 GitHub Repository Secrets 保存 TCR 密码和生产 root SSH 私钥；新方案禁止这样做。GitHub 只保存可撤销的 CNB 镜像仓库写入 token，TCR 与受限 CVM 凭据只放 CNB KeyStore。

服务器端已经添加专用公钥：

```text
github-actions-echonote
```

服务器上的容器部署目录为：

```text
/opt/echonote-container
```

该目录由 GitHub Actions 上传并维护以下文件：

```text
/opt/echonote-container/docker-compose.prod.yml
/opt/echonote-container/deploy-container.sh
/opt/echonote-container/deploy.log
```

容器运行结构：

```text
echonote-web     -> node server.js
echonote-worker  -> npm run worker:ai
echonote-migrate -> npm run db:deploy
```

Web 和 worker 使用同一个镜像，但启动命令不同。Compose 使用 `network_mode: host`，目的是复用现有服务器边界：

- nginx 继续代理 `127.0.0.1:3001`。
- 生产 `.env` 继续使用 `/etc/echonote/echonote.env`。
- `DATABASE_URL` 中的 `127.0.0.1:5432` 继续指向服务器上已有的 PostgreSQL 容器端口。
- 不重建、不迁移、不改动现有 `gewu-postgres` 容器。

容器部署首次成功时，`scripts/deploy-container.sh` 会停止并禁用旧的 systemd 服务：

```text
echonote-web
echonote-worker
```

这是为了避免旧 systemd 进程和新容器同时抢占 `3001` 端口。旧的 `/opt/echonote/deploy.sh`、`/opt/echonote/releases/*` 和 systemd unit 可作为短期回退参考保留，但新的 GitHub Actions 不再调用它们。

### 历史 GitHub Actions CD 失败排查（已停用）

以下内容只用于理解 2026-07-09 的失败记录，不再作为当前操作手册：

- `Install dependencies` / `Generate Prisma client` / `Typecheck` / `Lint` 失败：这是 CI 问题，服务器当前版本不受影响。
- `Build and push container image` 失败：重点检查 Dockerfile、Next.js build、腾讯云镜像仓库凭据和 GitHub runner 到腾讯云 CCR/TCR 的推送链路。
- `Upload deployment files` 失败：只上传 compose 和部署脚本，文件很小；若失败通常是 SSH 连接或服务器权限问题。
- `Log in to Tencent Cloud registry on server` 失败：检查服务器 Docker、TCR 用户名/密码和私有仓库权限。
- `Deploy container release` 失败：继续看 GitHub Actions 日志和服务器 `/opt/echonote-container/deploy.log`。

容器部署失败时，服务器上常用排查命令：

```bash
tail -n 200 /opt/echonote-container/deploy.log
docker compose -f /opt/echonote-container/docker-compose.prod.yml ps
docker logs --tail=200 echonote-web
docker logs --tail=200 echonote-worker
docker logs --tail=200 echonote-migrate
curl -I http://127.0.0.1:8081/login
```

不要再通过反复放大 `scp` / `rsync` / SSH 传输超时时间解决部署问题。新的候选路径是镜像构建、镜像推送、服务器拉取镜像和 Docker Compose 激活；但在 2026-07-09 已暂停推进，下一次继续前必须先重新确认执行边界。

### 后续 HTTPS 正式方案

当前 `http://101.35.48.157:8081` 只是临时可用入口。稳定使用后建议切换到 HTTPS 域名入口：

1. 准备一个域名或子域名，例如 `note.example.com`。
2. 将域名 DNS A 记录指向 `101.35.48.157`。
3. 在腾讯云安全组放行 `80/tcp` 和 `443/tcp`。
4. 使用宝塔面板、Certbot 或 acme.sh 为该域名申请 Let's Encrypt 证书。
5. 新增独立 nginx HTTPS server，将 `443` 的该域名代理到 `127.0.0.1:3001`。
6. 将 `/etc/echonote/echonote.env` 中的 `SESSION_COOKIE_SECURE=false` 改为 `SESSION_COOKIE_SECURE=true`。
7. 重启服务：

```bash
systemctl restart echonote-web
/www/server/nginx/sbin/nginx -t
/www/server/nginx/sbin/nginx -s reload
```

切到 HTTPS 后，浏览器会正常保存 Secure Cookie，登录态也会比 HTTP 临时入口更安全。
