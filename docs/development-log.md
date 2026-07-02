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
