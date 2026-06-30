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

```powershell
ssh -N -L 15432:127.0.0.1:5432 chips-server
```

本机 `.env` 使用：

```env
DATABASE_URL="postgresql://echo_note_user:<password>@127.0.0.1:15432/echo_note?schema=public"
```

## 后续服务器建库计划

获得确认后：

1. SSH 到 `chips-server`。
2. 在不打印密码的前提下读取现有 Postgres 管理凭据。
3. 创建 `echo_note` 数据库和 `echo_note_user` 用户。
4. 保持 Postgres 只监听服务器本机地址。
5. 通过 SSH 隧道在本地执行迁移，或未来从应用容器执行迁移。

## EchoNote Web 与 AI worker

EchoNote 需要两个长期进程：

```powershell
npm run start
npm run worker:ai
```

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

新增 `MemoryRainSnapshot` 表后，需要在确认数据库连接安全的前提下执行：

```powershell
npm run db:push
```

不要把 AI worker 放进单个 Next.js Route Handler 长循环里；生产部署应使用 systemd、PM2、Docker Compose 或同等进程管理方式分别守护 Web 和 worker。
