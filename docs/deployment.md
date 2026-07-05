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

### 手动发布更新

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

### GitHub Actions 自动部署

自动部署使用仓库内的 workflow：

```text
.github/workflows/deploy.yml
```

触发条件：

- push 到 `main`
- 在 GitHub Actions 页面手动运行 `Deploy EchoNote`

默认发布协作方式：

1. Codex 在功能分支完成代码、文档、验证和 commit。
2. 需要发布时，Codex 将功能分支推送到 GitHub，并在交付说明中写清楚变更摘要、验证结果、migration 和部署注意事项。
3. 用户在 GitHub 页面创建 PR、检查 diff、填写或调整描述。
4. 用户点击合并 PR。
5. 合并到 `main` 后，GitHub Actions 自动部署到腾讯云。

除非用户明确要求，Codex 不直接创建 PR、不点击 merge、不推送 `main`。

当前自动部署采用 artifact push 模式，不再让服务器执行 `git fetch` 或 `git pull`：

```text
GitHub Actions checkout
-> npm ci
-> npm run db:generate
-> npm run typecheck
-> npm run lint
-> npm run build
-> 打包 .next/standalone、.next/static、public、src、scripts、prisma 和 package lock
-> scp 上传 /tmp/echonote-<sha>.tar.gz
-> SSH 解包到 /opt/echonote/releases/<sha>
-> scripts/install-release.sh <sha>
-> 切换 /opt/echonote/current
-> 重启 echonote-web / echonote-worker
-> health check
```

仓库需要配置以下 Repository Secrets：

```text
SERVER_HOST=101.35.48.157
SERVER_USER=root
SERVER_PORT=22
SERVER_SSH_KEY=<github-actions-echonote 私钥完整内容>
```

服务器端已经添加专用公钥：

```text
github-actions-echonote
```

服务器上的 systemd 服务由 `scripts/install-release.sh` 管理，目标路径为：

```text
/opt/echonote/current
```

release 目录结构：

```text
/opt/echonote/releases/<commit-sha>/
/opt/echonote/current -> /opt/echonote/releases/<commit-sha>
```

服务器激活 release 时仍会执行：

- `npm ci --include=dev`：安装 AI worker 需要的 `tsx` 和运行依赖。
- `npm run db:generate`：根据服务器生产环境变量生成 Prisma Client。
- `npm run db:deploy`：应用已提交的 Prisma migrations。
- 复制 `.next/static` 和 `public` 到 `.next/standalone`。
- 更新 systemd unit 指向 `/opt/echonote/current`。
- 重启 `echonote-web` / `echonote-worker` 并检查 `127.0.0.1:8081/login`。

为了降低 2GB 服务器压力，脚本使用：

```bash
nice -n 10
ionice -c2 -n7
timeout
flock
```

分别用于降低 CPU/IO 优先级、限制卡住时间、避免并发部署。部署日志写入：

```text
/opt/echonote/deploy.log
```

旧的 `/opt/echonote/deploy.sh` 属于服务器 pull 模式，只作为回退脚本保留；新的 GitHub Actions 不再调用它。

### GitHub Actions 部署失败排查

新 workflow 的失败点按步骤判断：

- `Checkout` / `Install dependencies` / `Build` 失败：这是 CI 构建问题，先看 GitHub Actions 日志，不会影响服务器当前版本。
- `Upload release archive` 失败：通常是 GitHub runner 到服务器 SSH/SCP 链路问题，也会触发腾讯云主机安全“异常登录”告警。
- `Activate release` 失败：代码包已到服务器，继续看 GitHub Actions 日志和服务器 `/opt/echonote/deploy.log`。

旧 pull 模式如果在 `Run deployment script` 步骤失败，并出现：

```text
[deploy] fetching origin/main
Error: Process completed with exit code 124.
```

优先判断为服务器侧旧部署脚本中的命令超时，尤其是 `/opt/echonote/deploy.sh` 里的 `git fetch origin main` 或其外层 `timeout`，而不是 GitHub Actions 顶层 `timeout-minutes: 20`。新 artifact workflow 不再执行这一步。

排查顺序：

1. 在 GitHub Actions 日志里确认失败停在哪一行。
2. SSH 到服务器后查看：

```bash
tail -n 200 /opt/echonote/deploy.log
cd /opt/echonote
git remote -v
GIT_TERMINAL_PROMPT=0 timeout 120 git fetch origin main
```

3. 如果 `git fetch` 卡住，继续检查服务器到 GitHub 的 DNS、HTTPS 网络、代理、凭据和远程仓库 URL。
4. 如果 `git fetch` 正常，再检查脚本后续的 `npm ci`、`db:deploy`、`npm run build`、systemd 重启和健康检查。
5. GitHub Actions 外层 SSH 调用应设置 `BatchMode=yes`、`ConnectTimeout`、`ServerAliveInterval`、`ServerAliveCountMax` 和 step 级 `timeout-minutes`，保证失败时可诊断。

不要通过反复重跑或单纯放大 GitHub Actions 总超时时间来掩盖服务器侧卡住的问题。修改服务器 Git 配置、nginx、systemd 或 Tencent Cloud 安全组前，必须再次获得确认。

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
