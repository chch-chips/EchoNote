# EchoNote 开发工作流规范

本文档定义 EchoNote 上线后继续迭代的默认工作流。目标不是增加仪式感，而是把本地开发、测试数据库、生产数据库、线上服务和发布验证分开，避免一次小改动误伤稳定环境。

## 1. 第一性原则

EchoNote 已经有线上稳定版本，因此后续每次开发都遵守四条底线：

1. 生产环境只承载稳定版本，不承载试验。
2. 数据库 schema 以 Git 中的 Prisma migration 为准，不以某台机器的临时状态为准。
3. 任何会影响生产服务、生产数据库、nginx、Tencent Cloud 安全组的动作，都必须先获得明确确认。
4. 本地开发可以失败、重置和重来；生产数据不能被当成本地开发素材。

## 2. 分支规范

- `main` / `release` 代表线上稳定版本。只有确认过、可发布的代码才能进入这些分支。
- 每个需求新开 `codex/...` 分支，例如 `codex/note-editing`、`codex/dev-workflow-docs`。
- 不在 `main` 上直接开发。发现当前在 `main` 且需要改代码时，先创建需求分支。
- 不经用户明确确认，不提交、不推送、不发布。
- 每次交付前先看 `git status` 和当前 diff，确认没有把 `.env`、密钥、私钥、数据库密码、服务器材料或无关文件带进变更。

推荐流程：

```powershell
git status
git switch -c codex/<feature-name>
# 开发与验证
git diff
```

如果用户明确要求提交，再进入提交流程；否则工作树保持未提交状态交付。

## 3. 环境分层

### 当前采用的最小企业级方案

EchoNote 当前先采用 `local-dev + production` 两层落地方式。它不是完整的四环境体系，但已经把开发测试数据和生产数据隔离开：

```text
local-dev:
  app: 本机 `localhost:3000`，运行 `npm run dev`
  database: 服务器 PostgreSQL 容器中的 `echo_note_dev`
  user: `echo_note_dev_user`
  tunnel: `127.0.0.1:15432`

production:
  app: `echonote-web` / `echonote-worker`
  database: `echo_note`
  user: `echo_note_user`
```

这个阶段不新建 Docker 容器、不重启生产服务、不改 nginx、不动 Tencent Cloud 安全组。后续如果需要更严格，可以继续演进为独立 `dev app server`、`staging` 和 `production` 三套服务器环境。

### local

local 是开发者机器上的环境，用来写代码、跑类型检查、跑 lint、启动 Web dev server 和做浏览器验证。

- 环境变量文件：本机 `.env`，从 `.env.example` 复制后填写。
- Web 端口：默认 `3000`，由 `npm run dev` 启动。
- 数据库：当前使用远程 dev 数据库 `echo_note_dev`，通过 SSH 隧道 `127.0.0.1:15432` 访问。
- AI worker：只在需要验证 AI 分析链路时启动；前端验证可只启动 Web，避免 worker 数据库连接错误干扰 UI。

禁止事项：

- 不把生产 `DATABASE_URL`、数据库主密码、服务器 secret 拉到本地。
- 不用生产数据库主账号做本地开发。
- 不把 `.env` 内容复制到聊天、文档、截图或 Git。

### dev / staging

dev/staging 用来验证新功能接近真实部署时的行为，但仍然不是生产。

- 环境变量：使用独立的 dev/staging secret，不能复用生产主 secret。
- 数据库：使用独立库或至少独立用户，权限按最小可用原则配置。
- 服务端口：避免与生产 `echonote-web` 端口冲突；如部署在同一台机器，必须使用独立 systemd 服务名、端口和 nginx 入口。
- 用途：跑 migration、验证数据修复脚本、做 smoke test 和 UI 回归。

### production

production 是线上稳定环境。

- 环境变量：服务器上的生产 secret 文件，例如 `/etc/echonote/echonote.env`。
- Web 服务：`echonote-web`。
- AI worker：`echonote-worker`。
- 数据库：生产 PostgreSQL 数据库和生产应用用户。
- 发布动作：只在确认 commit、确认步骤、确认回滚方案后执行。

生产环境不用于试验 `db push`、临时 schema 修改、前端调试或随手重启。

## 4. 数据库规范

已上线项目的 schema 变更必须进入 Prisma migration。`prisma db push` 只适合早期原型或一次性本地试验，不作为 EchoNote 常规开发、staging 或生产流程。

默认命令：

```powershell
npm run db:generate
npm run db:migrate   # 等价于 prisma migrate dev，用于本地/dev 生成并应用 migration
npm run db:deploy    # 等价于 prisma migrate deploy，用于 staging/production 应用已提交 migration
```

### schema 变更流程

1. 修改 `prisma/schema.prisma`。
2. 在 local/dev 数据库上生成 migration：

```powershell
npx prisma migrate dev --name <change-name>
```

3. 检查 `prisma/migrations/.../migration.sql`，确认 SQL 符合预期。
4. 将 migration 文件纳入 Git。
5. 执行 `npm run db:generate` 更新 Prisma Client。
6. 跑 `npm run typecheck`、`npm run lint`、`npm run build`。
7. 发布时在 production 执行 `npm run db:deploy`。

### 已手动改过生产库但 migration 还没补

这种情况属于 hotfix 后的迁移历史漂移。处理方式：

1. 在 `prisma/schema.prisma` 中补上与生产现状一致的模型定义。
2. 创建等价 migration，SQL 尽量写成幂等形式，例如 `ADD COLUMN IF NOT EXISTS`、`CREATE INDEX IF NOT EXISTS`。
3. 在 local/dev 验证 migration 可应用。
4. 如果 production 还没有记录该 migration，但实际 schema 已经手工改过，有两种安全路径：
   - migration SQL 是幂等的：可以让 `npm run db:deploy` 正常执行并记录迁移。
   - migration SQL 不能重复执行：先确认生产库已经具备同等结构，再在生产执行 `npx prisma migrate resolve --applied "<migration-folder-name>"`，只记录迁移已应用，不重复执行 SQL。
5. 记录本次处理原因，避免后续再次手改生产库。

### 字段、索引与数据修复

- 新增可空字段优先；需要非空字段时，先加可空字段并回填，再改为非空。
- 新增索引要评估表大小、锁表风险和查询收益；生产大表索引应在低峰期执行。
- 删除字段、表或枚举值属于高风险变更，必须先备份、确认回滚方案，并尽量分阶段发布。
- 数据修复脚本放在 `scripts/`，文件名说明用途和日期；脚本不得打印 secret，不得默认连接生产。
- 数据修复脚本应支持 dry-run 或至少先输出将影响的记录数。
- 执行生产数据修复前先备份，执行后记录验证结果。

## 5. 本地开发规范

安装依赖和生成客户端：

```powershell
npm install
Copy-Item .env.example .env
npm run db:generate
```

启动 Web：

```powershell
npm run dev
```

启动 Web 和 AI worker：

```powershell
npm run dev:all
```

`npm run dev` 只启动 Next.js Web，适合 UI、页面、API 基本验证。`npm run dev:all` 会同时启动 Web 和 AI worker，适合验证 AI 分析、记忆碎片和 worker 恢复逻辑。

如果 worker 报数据库连接错误，例如 Prisma `P1000 Authentication failed`，先判断当前任务是否需要 worker：

- 只测 UI、历史页、弹窗布局：先停掉 worker，只保留 `npm run dev`。
- 测 AI 链路：检查 `.env` 是否指向安全的 dev/staging 数据库，确认隧道和账号都属于 dev/staging，不要改用生产主凭据。

### 端口和残留进程

检查端口：

```powershell
netstat -ano | Select-String ":3000"
netstat -ano | Select-String ":15432"
```

停止残留进程：

```powershell
taskkill /PID <PID> /T /F
```

如果 Codex 桌面环境需要后台启动 dev server，把日志写到本地文件，并在交付前确认没有悬挂的旧进程继续占用端口。

## 6. 验证规范

每次交付前固定执行：

```powershell
npm run typecheck
npm run lint
npm run build
```

UI 改动必须至少检查：

- 375px 移动端。
- tablet 视口。
- desktop 视口。
- 空态、长内容、错误态、加载态。
- 移动端是否出现横向溢出。
- 弹窗是否可关闭，长内容是否在弹窗内部滚动。
- 触控目标是否不小于 44px。

如果 `npm run build` 因 Google Fonts、`fonts.gstatic.com` 或网络下载失败，应在汇报里明确标注为网络限制，不误判为业务代码失败。

如果浏览器自动化被安全审查拦截，不绕过审查；改为报告验证限制，并尽量用可用的手工检查、静态检查和构建结果补充说明。

## 7. 发布规范

发布前必须确认：

- 要发布的 commit hash。
- 当前 diff 为空或只包含已确认内容。
- migration 文件已经进 Git。
- 生产备份和回滚方案明确。
- 用户明确同意发布。

生产发布建议步骤：

```bash
cd /opt/echonote
git pull --ff-only origin main
npm ci
npm run db:generate
npm run db:deploy
npm run build
# 复制 standalone 静态资源
# 重启 echonote-web / echonote-worker
# health check
```

生产服务和数据库变更必须分步执行：先拉代码和安装依赖，再执行 migration，再构建，再重启服务，最后健康检查。

发布后 smoke test：

- 登录。
- 首页打开和保存小记。
- `/history` 小记列表。
- 新建、编辑、删除。
- 创建时间/更新时间显示。
- 长内容记忆雨弹窗可滚动，关闭按钮可点击。

未经确认，不重启生产服务、不改 nginx、不动 Tencent Cloud 安全组。

## 8. 当前小记编辑功能的 migration 处理

本项目早期上线时没有完整 Prisma migration 历史，因此现在补了两类 migration：

- `20260702000000_baseline_schema`：从空库创建当前完整 schema，用于新的 dev/staging 数据库。
- `20260703000000_add_note_content_updated_at`：幂等补充 `contentUpdatedAt` 字段和索引。

生产库已经存在完整历史表结构，因此生产首次切换到 migration 流程前，必须先确认生产 schema 与 baseline 等价，再把 baseline 标记为已应用，然后再执行 `db:deploy` 应用后续幂等迁移：

```bash
npx prisma migrate resolve --applied "20260702000000_baseline_schema"
npm run db:deploy
```

本轮 `Note.contentUpdatedAt` 字段曾在生产库中手动添加，索引也已手工创建。仓库必须补上对应 migration，确保以后环境可复现。

本次 migration 应使用幂等 SQL：

```sql
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "contentUpdatedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Note_contentUpdatedAt_idx" ON "Note"("contentUpdatedAt");
```

这样在尚未变更的 local/dev 数据库上可以正常添加字段；在已经手动添加过字段和索引的 production 上，`npm run db:deploy` 不会破坏现有结构，并会把迁移历史补齐。
