# EchoNote 开发日志

本文档按每一次开发记录使用 Codex 进行 Vibe Coding 的沉淀。每条记录都是独立的一次开发，不按日期归档；日期只作为记录元信息，方便回溯。

## 开发记录 001：首页与交互记忆雨重构

记录时间：2026-07-01

### 需求

- 重构首页前端体验，移除首页下方首页小记列表。
- 保留并升级“落下的文字”创意，让记忆雨具备更强 3D 空间感。
- 点击记忆雨中的文字后，用现代、优雅、有诗意的形式显示对应小记原文。
- 首页仍保留一个查看所有小记的入口，但不恢复信息流式首页。
- 建立开发日志机制，用于每轮 Codex Vibe Coding 结束后的沉淀。

### 执行任务

- 将首页改为单一捕获主界面：`MemoryRain` 背景、中央 `CapturePanel`、右上角“所有小记”入口。
- 重做 `CapturePanel` 视觉层级：减少说明文案，保留自动聚焦、保存、清空、`Ctrl/⌘ + Enter` 和 `aria-live` 反馈。
- 将 `MemoryRain` 从不可点击背景升级为 Three.js 交互空间：文字 sprite、星点场、hover 高亮、raycaster 点击命中、详情浮层。
- 新增 `GET /api/notes/[id]`，登录后按小记 id 返回浮层需要的原文、来源、时间和分析摘要字段。
- 给记忆雨 fallback 片段补充 `noteId`，保证未生成 AI 片段时也可以点击回到原文。
- 更新 `src/app/globals.css` 的深色空间背景、颜色 token 和全局按钮 cursor 行为。
- 停止本地 3000 端口上异常的旧 dev server 进程，避免后续验证继续命中旧 worker 状态。

### 完成效果

- 首页不再显示首页小记列表，视觉焦点回到干净的输入框。
- “所有小记”作为轻量导航存在于右上角，进入现有 `/history` 页面。
- 记忆雨具备空间深度，文字可 hover、可点击，点击后显示对应小记的原文浮层。
- 历史页、登录页、cc-connect 捕获链路和数据库 schema 没有改动。

### 核心设计

- 首页不做笔记管理，只做快速捕获与记忆回响。
- 历史查看通过 `/history` 承担，避免首页重新变成列表页。
- 记忆雨只从 `/api/memory-rain` 获取片段和 seed；原文通过点击后再请求 `/api/notes/[id]`，避免一次性把所有原文塞进 3D payload。
- `GET /api/notes/[id]` 返回收敛后的 JSON 字段，不直接暴露完整 Prisma 对象。
- `prefers-reduced-motion` 下不启动 Three.js 动画，保留可用的静态输入体验。

### 问题修复

- 修复记忆雨 fallback 片段没有 `noteId` 导致无法回查原文的问题。
- 修复新增原文读取时旧导入数据可能不匹配 owner 过滤的问题，当前单用户产品边界下按 note id 读取。
- 修复本地旧 dev server 动态 worker 卡在 500 的验证问题：确认 route handler 逻辑本身可返回 401/200，并停止 3000 端口旧进程。

### 验证记录

- `npm run typecheck` 通过。
- `npm run lint` 通过。
- `npm run build` 通过。
- Playwright/Edge 检查过桌面、375px 移动端、平板视口：canvas 与输入框存在，无横向溢出，无控制台错误。
- 直接调用 `GET /api/notes/[id]` Route Handler：无 cookie 返回 401，有 session 返回 200，并能取回原文。

## 开发记录 002：服务器隔离部署与 HTTP 登录修复

记录时间：2026-07-01

### 需求

- 将 EchoNote 先部署到腾讯云服务器，日常可以直接通过服务器 IP 使用。
- 部署方式必须和服务器上已有前后端项目互不影响。
- 当前阶段先用 HTTP 临时入口跑起来，后续稳定后再切换 HTTPS 正式方案。
- 更新文档，记录部署事实、手动发布流程、HTTPS 后续方案和登录修复原因。

### 执行任务

- 在腾讯云 `chips-server` 上安装 Node.js 20.20.0 与 npm 10.8.2。
- 将仓库克隆到 `/opt/echonote`，生产环境变量写入 `/etc/echonote/echonote.env`，并用符号链接暴露为 `/opt/echonote/.env`。
- 复用现有 `gewu-postgres` 容器，但只创建 EchoNote 独立数据库 `echo_note` 和独立用户 `echo_note_user`，不重启、不覆盖原容器。
- 新增 `echonote-web` 与 `echonote-worker` 两个 systemd 服务，分别运行 Next.js standalone Web 和 AI worker。
- 为避免影响服务器上已有的 `yu-picture-frontend`，EchoNote Web 只监听 `127.0.0.1:3001`，nginx 新增独立 `8081` 入口代理到该端口。
- 新增 `SESSION_COOKIE_SECURE` 环境变量，让生产环境默认仍使用 Secure Cookie，但允许 HTTP 临时部署显式关闭。
- 在部署文档中记录当前隔离端口、服务名、手动发布命令、HTTP Cookie 模式和后续 HTTPS 正式方案。

### 完成效果

- EchoNote Web 服务已由 `echonote-web` 守护，监听 `127.0.0.1:3001`。
- AI worker 已由 `echonote-worker` 守护，持续处理待分析小记。
- nginx 通过独立 `8081` 入口代理 EchoNote，没有改动既有 `80` 端口项目。
- 公网安全组放行 `8081/tcp` 后，可通过 `http://101.35.48.157:8081` 打开 EchoNote。
- HTTP 临时入口设置 `SESSION_COOKIE_SECURE=false` 后，浏览器可以保存登录 cookie；后续切换 HTTPS 域名时改回 `true`。

### 核心设计

- 部署目录、环境变量、数据库、systemd 服务和 nginx 入口全部独立，避免与既有项目耦合。
- PostgreSQL 继续只暴露在服务器本机，EchoNote 使用独立库和独立用户。
- HTTP 入口只作为临时可用方案；正式方案应使用域名、证书、`443` 和 Secure Cookie。

### 问题修复

- 公网放行 `8081` 后，HTTP 入口能打开登录页，但浏览器无法保持登录态。
- 根因是生产环境默认给 `echonote_session` 设置 `Secure` Cookie，而 `http://101.35.48.157:8081` 不是 HTTPS，浏览器会拒绝保存该 cookie。
- 登录接口在服务器本机测试中返回 `200 OK`，且 `Set-Cookie` 带 `Secure`，确认问题不是密码错误，而是 HTTP 下浏览器拒收 Secure Cookie。

### 验证记录

- 服务器本机 `curl -I http://127.0.0.1:8081/login` 返回 `200 OK`。
- `systemctl is-active echonote-web echonote-worker` 均返回 `active`。
- `ss -ltnp` 显示 `127.0.0.1:3001` 和 `0.0.0.0:8081` 已监听。
- 本地 `npm run lint` 通过。
- 本地 `npm run typecheck` 通过。

## 开发记录 003：GitHub Actions 自动部署准备

记录时间：2026-07-02

### 需求

- 在已有手动部署基础上，为 EchoNote 增加 GitHub Actions 自动部署。
- 用户手动将部署私钥保存到 GitHub Repository Secret，Codex 负责服务器公钥、部署脚本、workflow 和文档。

### 执行任务

- 用户生成 `github-actions-echonote` 专用 SSH key，并将私钥保存到 GitHub Secret `SERVER_SSH_KEY`。
- 将对应公钥追加到服务器 root 用户 `~/.ssh/authorized_keys`。
- 在服务器创建 `/opt/echonote/deploy.sh`，封装拉取代码、安装依赖、Prisma 同步、Next.js 构建、静态资源复制、systemd 重启和健康检查流程。
- 新增 `.github/workflows/deploy.yml`，配置 push 到 `main` 和手动触发时通过 SSH 调用服务器部署脚本。
- 更新部署文档，记录需要的 Repository Secrets、部署脚本职责和验证状态。

### 当前状态

- GitHub Actions workflow 文件已在本地准备，等待提交/推送后触发。
- 首次手动执行 `/opt/echonote/deploy.sh` 时卡在 GitHub SSL 连接并导致 SSH 会话超过工具超时，随后服务器短时响应变慢。
- 重启服务器后，替换为资源友好的部署脚本：按文件变更决定是否执行 `npm ci`、Prisma 同步、Next.js 构建和服务重启。
- 部署脚本使用 `nice`、`ionice`、`timeout` 和 `flock` 降低资源冲击、限制卡住时间并避免并发部署。
- 发现重启后 `echonote-worker` 因 `tsx: command not found` 反复重启，原因是生产依赖安装未包含 devDependency；已用 `npm ci --include=dev` 修复，并将 deploy.sh 的依赖安装策略同步为 `--include=dev`。
- 最终手动验证 `/opt/echonote/deploy.sh` 通过：无运行时代码变更时跳过重任务，只执行 Git 检查和健康检查。

### 后续动作

- 提交并推送 `.github/workflows/deploy.yml` 与文档。
- 触发一次 GitHub Actions 自动部署并检查运行结果。

## 开发记录 004：历史页编辑功能与上线后迁移工作流

记录时间：2026-07-05

### 需求

- 在历史页支持编辑已保存的小记正文。
- 编辑后不能继续展示旧 AI 摘要和旧记忆雨片段。
- 历史页需要区分创建时间和内容更新时间，并能按更新时间排序。
- 项目已经上线，数据库变更要从 `db push` 转为 Prisma migration 流程。
- 解决 Google Fonts 构建时网络依赖导致 `next build` 不稳定的问题。

### 执行任务

- 新增 `src/components/edit-note-button.tsx`，在 `/history` 列表中提供编辑弹窗。
- 新增 `PATCH /api/notes/[id]`，登录后可更新单条小记正文。
- `src/lib/notes.ts` 新增更新小记逻辑：写入 `contentUpdatedAt`，重置 `aiStatus=PENDING`，清空 `aiError`，删除旧 `NoteAiAnalysis` 和 `MemoryFragment`。
- `GET /api/notes` 支持 `sort=created|updated`，历史页增加创建时间/更新时间排序入口。
- 修复历史页和记忆雨详情弹窗的长内容滚动与关闭按钮可用性。
- 去掉 `next/font/google` 的构建时字体下载，改用系统字体栈。
- 为 Prisma 补充 baseline migration 和 `contentUpdatedAt` 幂等迁移，并新增 `npm run db:deploy`。
- 新增 `docs/development-workflow.md`，记录 local-dev/production 分层、migration 流程、验证和发布规范。

### 完成效果

- 历史页小记可以编辑；保存后原文立即更新。
- 被编辑的小记会重新进入 AI 待处理队列，旧摘要和旧记忆雨片段不会继续误导用户。
- 历史页可按创建时间或更新时间查看小记。
- 构建不再依赖 Google Fonts 网络请求。
- 生产数据库变更路径明确为已提交 migration + `npm run db:deploy`。

### 验证记录

- `npm run db:generate` 通过。
- `npm run typecheck` 通过。
- `npm run lint` 通过。
- `npm run build` 通过。

### 发布记录

- 本轮代码进入分支 `codex-note-editing-workflow`。
- 用户在 GitHub 手动创建 PR、审核并合并到 `main`。
- 合并后触发 GitHub Actions 自动部署，但部署在服务器执行脚本阶段失败，见开发记录 005。

## 开发记录 005：PR 合并后自动部署超时待修

记录时间：2026-07-05

### 现象

- PR 合并到 `main` 后触发 `Deploy EchoNote` GitHub Actions。
- job `Deploy to Tencent Cloud` 在 `Run deployment script` 步骤失败。
- 日志最后停在服务器脚本输出：`[deploy] fetching origin/main`。
- GitHub Actions 返回 `Error: Process completed with exit code 124.`，截图显示该步骤约 1 分 33 秒后结束。

### 初步判断

- 失败发生在服务器 `/opt/echonote/deploy.sh` 执行 `git fetch origin/main` 附近。
- 这更像服务器到 GitHub 的网络或脚本内 `timeout` 触发，而不是 workflow 顶层 20 分钟超时。
- 只增加 GitHub Actions 的总超时时间不能解决根因；需要同时检查服务器侧 `git fetch`、`deploy.log` 和远程仓库访问链路。

### 待处理

- 检查服务器 `/opt/echonote/deploy.log` 中 `fetching origin/main` 后的详细错误。
- 确认服务器上 `git remote -v`、DNS、HTTPS 到 GitHub、凭据/免交互设置是否正常。
- 给 GitHub Actions 外层 SSH 调用补充显式连接超时和 step 超时，让失败更可诊断。
- 如需修改 `/opt/echonote/deploy.sh` 或服务器 Git 配置，必须先获得用户明确确认。

## 开发记录 006：自动部署改为 artifact push 模式

记录时间：2026-07-05

### 背景

- GitHub Actions 合并触发部署后，服务器旧部署脚本多次停在 `fetching origin/main`。
- 腾讯云主机安全同时提示来自海外 GitHub-hosted runner 的 root SSH 登录告警。
- 旧链路包含两个外部网络动作：GitHub runner SSH 登录服务器，以及服务器再访问 GitHub 拉代码。
- 服务器到 GitHub 的 HTTPS 链路曾成功过，但存在 `SSL connection timeout`，不适合作为生产部署的稳定依赖。

### 决策

将部署从服务器 pull 模式改为 artifact push 模式：

```text
GitHub Actions checkout/build/package
-> scp 上传 release tarball
-> 服务器解包到 /opt/echonote/releases/<sha>
-> scripts/install-release.sh 激活 /opt/echonote/current
```

服务器不再执行 `git fetch` / `git pull` 作为自动部署的一部分。GitHub Actions 负责拉取仓库、安装依赖、类型检查、lint、构建 Next.js standalone 输出并打包 release。

### 执行任务

- 新增 `scripts/install-release.sh`，在服务器 release 目录内执行 `npm ci --include=dev`、`db:generate`、`db:deploy`、静态资源复制、systemd unit 更新、服务重启和健康检查。
- 重写 `.github/workflows/deploy.yml`，使用 checkout、setup-node、npm ci、typecheck、lint、build、tar、scp 和 SSH activate release。
- systemd 服务目标从 `/opt/echonote` 迁移为 `/opt/echonote/current`，由 release 脚本在部署时写入。
- `/opt/echonote/deploy.sh` 保留为旧 pull 模式回退脚本，不再由 GitHub Actions 调用。

### 风险与后续

- GitHub-hosted runner 仍会从动态海外 IP SSH 登录服务器，腾讯云主机安全可能继续告警。
- 后续更安全的演进是创建低权限 `deploy` 用户，并只允许其重启 `echonote-web` / `echonote-worker`。
- 也可以考虑 GitHub self-hosted runner 或固定出口 IP runner，进一步减少异常登录告警。

## 开发记录 007：发布上传阶段改为 rsync 增量同步

记录时间：2026-07-05

### 背景

- artifact push workflow 合并到 `main` 后，GitHub Actions 已经能够完成 checkout、依赖安装、Prisma client 生成、typecheck、lint、Next.js build 和发布内容汇总。
- 新的失败点出现在 `Upload release archive`：`scp` 上传 tarball 运行 10 分钟后被 step 级 `timeout-minutes` 终止。
- 这说明瓶颈已经不再是服务器执行 `git fetch origin main`，而是 GitHub-hosted runner 到腾讯云服务器之间的 SSH 文件传输链路。

### 决策

将发布上传阶段从单个 tarball 的 `scp` 改为 `rsync` 增量同步：

```text
GitHub Actions build
-> rsync .next/standalone、.next/static、public、src、scripts、prisma 和 package lock
-> /opt/echonote/releases/<sha>
-> scripts/install-release.sh <sha>
```

服务器已有 `/usr/bin/rsync`，版本为 `3.2.7`。workflow 在服务器存在 `/opt/echonote/current` 时使用 `--link-dest=/opt/echonote/current`，让新 release 可以复用上一个 release 中未变化的文件，减少重复上传量。

### 执行任务

- 移除 `.github/workflows/deploy.yml` 中的 `.release/*.tar.gz` 打包、`scp` 上传和远端解包步骤。
- 新增 `Upload release files` 步骤，使用 `rsync -azR --partial --info=stats2,progress2` 上传发布目录。
- 激活阶段继续调用 `scripts/install-release.sh <sha>`，不再依赖 `/tmp/echonote-<sha>.tar.gz`。
- 将 `.github/workflows/*.yml` 固定为 LF 换行，避免 Windows 本地编辑影响 CI 文件格式。
- 增加同 SHA 重跑保护：如果 `/opt/echonote/current` 已经指向目标 release，上传步骤不会删除当前正在运行的 release 目录。

### 后续观察

- 如果 `Upload release files` 仍然超时，优先查看 rsync 日志中的总大小、速度和卡住文件，而不是回到服务器 `git fetch` 排查方向。
- 腾讯云主机安全仍可能因为 GitHub-hosted runner 的海外动态 IP SSH 登录而告警；这是当前链路的安全告警特征，不等于部署一定失败。

## 开发记录 008：部署链路切换为腾讯云容器镜像 + Docker Compose

记录时间：2026-07-09

### 背景

- rsync 增量同步方案在 GitHub Actions 中仍然失败，日志显示上传速度约 `47kB/s`，20 分钟后 `Upload release files` 超时。
- 这说明问题不是单个上传命令参数，而是 GitHub-hosted runner 到腾讯云服务器之间的长时间 SSH 文件传输链路不适合作为生产部署主路径。
- 用户已在腾讯云容器镜像服务个人版创建 EchoNote 私有镜像仓库。

### 决策

将部署链路改为容器镜像发布：

```text
GitHub Actions
-> docker build
-> docker push ccr.ccs.tencentyun.com/<namespace>/echonote:sha-<git-sha>
-> 服务器 docker compose pull
-> docker compose run --rm migrate
-> docker compose up -d web worker
```

GitHub Actions 不再向服务器上传完整 release 目录。服务器只接收很小的 `docker-compose.prod.yml` 和 `scripts/deploy-container.sh`，应用代码、依赖、Next.js standalone 输出、worker 脚本和 Prisma migrations 都封装在镜像里。

### 执行任务

- 新增 `Dockerfile`，使用 Next.js `output: "standalone"` 构建生产镜像，并复制 `public` 与 `.next/static` 到运行镜像。
- 新增 `.dockerignore`，排除 `.env`、`.git`、`.next`、`node_modules`、日志和本地临时文件。
- 新增 `docker-compose.prod.yml`，用同一个镜像运行 `web`、`worker` 和临时 `migrate` 服务。
- 新增 `scripts/deploy-container.sh`，负责服务器侧拉取镜像、运行 migration、启动容器和健康检查。
- 重写 `.github/workflows/deploy.yml`：PR 只做 CI + Docker build；`main` 才推送腾讯云镜像并触发服务器部署。

### 关键设计

- 生产容器暂时使用 `network_mode: host`，以复用现有 `127.0.0.1:5432` PostgreSQL 暴露方式和 `127.0.0.1:3001` nginx 代理入口。
- 首次容器部署会停止并禁用旧 `echonote-web` / `echonote-worker` systemd 服务，避免与容器抢占端口。
- 镜像 tag 使用不可变的 `sha-<短 git sha>`，同时更新移动 tag `main`。服务器部署使用 SHA tag。

### 后续观察

- 如果 GitHub Actions 推送腾讯云镜像仍然慢，下一步不再回到 SSH 文件传输，而是把构建也迁到腾讯云侧 runner 或 CODING DevOps。
- 镜像仓库需要定期清理旧 `sha-*` tag，保留最近 5-10 个版本用于回滚即可。

## 开发记录 009：部署链路暂停，作为待推进事项保留

记录时间：2026-07-09

### 背景

- 容器镜像方案进入 GitHub Actions 后，`Build and push container image` 步骤在向腾讯云 CCR/TCR 推送镜像层时运行约 35 分钟并超时。
- 这意味着此前三类链路均遇到超时：服务器从 GitHub 拉代码、GitHub-hosted runner 向服务器传 release 文件、GitHub-hosted runner 向腾讯云镜像仓库推送 Docker 镜像。
- 用户对继续切换部署方案、安装 self-hosted runner 或继续打补丁产生安全和稳定性顾虑，决定暂停部署链路推进。

### 当前结论

- 暂时不继续修复、重跑或替换部署链路。
- 不安装 GitHub self-hosted runner。
- 不执行服务器侧容器化部署脚本。
- 不停止或禁用旧的 `echonote-web` / `echonote-worker` systemd 服务。
- 当前容器化文件和 workflow 只能视为候选方案沉淀，不代表已确认上线。

### 待推进事项

后续如果重新启动部署链路改造，需要先在方案层重新确认，而不是直接继续执行现有脚本。候选方向：

1. 安全版 GitHub self-hosted runner：PR 仍跑 GitHub-hosted runner；只有 `main` 部署 job 才跑腾讯云侧 runner，并使用专用 label 限定。
2. 腾讯云 CODING DevOps / 腾讯云侧流水线：在腾讯云网络内构建镜像并推送 CCR/TCR。
3. 镜像瘦身：减少最终镜像体积，降低传输压力；该方向只能作为优化，不应继续掩盖跨网络链路问题。

### 交接提醒

下一次继续前，先读 `docs/deployment.md` 的“部署链路暂停状态”。不要直接 rerun 失败的 GitHub Actions，也不要只通过增加超时时间推进生产发布。

## 开发记录 010：补充人工直连发布路径

记录时间：2026-07-09

### 背景

- 用户希望以后可以自主选择发布方式：继续推进容器化自动部署，或明确授权 Codex 直接连接服务器发布当前版本。
- 2026-07-09 已验证保守人工路径可行：Codex 通过 SSH 连接 `chips-server`，沿用 `/opt/echonote` 与 `echonote-web` / `echonote-worker` systemd 服务，将生产更新到 `main@4f50d2f`，本机和公网 `/login` 均返回 `200 OK`。

### 文档结论

- `docs/deployment.md` 新增“Codex 直连 systemd 发布”，记录适用场景、执行边界、发布前确认、常规命令和验证方式。
- 当前用户可以在发布前明确选择：
  1. 自动部署 / 容器化候选路径：用于恢复长期自动化发布。
  2. Codex 直连 systemd 发布：用于先把当前 `main` 保守发布到现有生产服务。

## 开发记录 011：自动部署迁移为 GitHub CI + CNB + TCR

记录时间：2026-07-10

### 决策

- 不购买额外服务器，不使用生产 CVM 作为 GitHub self-hosted 构建机。
- 不新购已进入退市周期的 CODING DevOps，改用下一代 CNB 社区版免费额度。
- GitHub Actions 只执行 CI 和可开关的小体积 Git 同步，不再推送镜像或持有生产 root SSH 私钥。
- CNB 在腾讯云侧构建 runtime/migrate 镜像并推送现有 TCR 个人版。
- 现有 2GB CVM 只拉取和运行不可变镜像，不再 `git pull`、`npm ci` 或 `next build`。

### 仓库改造

- 旧 `.github/workflows/deploy.yml` 替换为 CI-only `.github/workflows/ci.yml`。
- 新增 `.cnb.yml`，使用完整 commit SHA 构建、推送 runtime/migrate tag；`DEPLOY_ENABLED=false` 时只做 build-only POC。
- Dockerfile 拆为 `runtime` 和 `migrate` targets；runtime 只复制 Next.js standalone、静态资源和 worker bundle。
- AI worker 增加 esbuild 生产 bundle，容器内改为 `node worker/process-ai.mjs`，不再复制完整 `node_modules` 和 TypeScript 源码。
- 新增 `scripts/deploy-cnb.sh`：旧版本在线时拉镜像和执行向后兼容 migration，切换后检查 `3001` 与 nginx `8081`，失败恢复旧 systemd/上一容器镜像。
- 新增 `scripts/bootstrap-cnb-deploy.sh`：创建非 root `echonote-deploy`、安装 root-owned 脚本、镜像仓库白名单和受限 sudo 规则；bootstrap 本身不切换服务。
- 新增 `docs/cnb-setup.md` 与 KeyStore 示例。

### 安全边界

- CNB build-only POC、服务器 bootstrap、首次切换和回滚演练分开确认。
- POC 前不修改生产服务器；首次部署成功前 systemd 继续提供服务。
- TCR 密码只进入 CNB KeyStore 和服务器 root Docker credential store。
- CNB 使用专用 `echonote-deploy` SSH key，不复用 root key 或 `chips.pem`。

### 当前进度

- 已创建私有 CNB 代码仓库 [`chch_chips/echonote`](https://cnb.cool/chch_chips/echonote)，仓库与 KeyStore 白名单统一使用 slug `chch_chips/echonote`。
- `.cnb.yml` 已通过 CNB 官方 JSON Schema 校验；类型检查、Lint、worker bundle、Next.js production build、Compose 配置检查均通过。
- worker bundle 已在不携带 `node_modules` 的隔离目录启动到 Prisma 连接阶段，确认精简 runtime 镜像所需依赖已进入 bundle。
- 本机 Docker target 构建因 C 盘空间耗尽而停在 Docker Desktop containerd 写入阶段，不属于 Dockerfile 编译错误；以 CNB build-only POC 作为最终容器构建验收。
