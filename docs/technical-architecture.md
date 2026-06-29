# EchoNote 技术架构说明

本文档面向后续开发者和未来的自己，解释 EchoNote 当前 V1 的工程结构、前后端分层、数据流、AI 异步处理方式、移动端 UI 实现、部署边界和可扩展点。它不是产品介绍，而是技术交接文档。

## 1. 项目定位与工程边界

EchoNote 是一个私人瞬时记录系统。V1 的核心不是完整笔记管理，而是把“极快写入”和“后续回响”跑通：

- Web 端：打开页面即可写入一条小记。
- 微信入口：普通微信消息通过 cc-connect 到本机 Agent，再由 Agent 调用 EchoNote API。
- 数据层：所有小记进入 PostgreSQL，保留来源、时间、AI 状态等结构化信息。
- AI 层：后台异步读取待处理小记，调用 DeepSeek OpenAI-compatible API，生成摘要和记忆雨片段。
- 展示层：首页用 Three.js 做记忆雨；历史页提供时间流和搜索。

当前不做公众号、企业微信、小程序、多用户注册、公开产品化，也不在 Web 应用内部直接集成微信协议。

## 2. 技术栈

- 应用框架：Next.js App Router，当前项目由 `create-next-app` 初始化。
- 语言：TypeScript。
- 样式：Tailwind CSS v4，使用 `src/app/globals.css` 中的 CSS-first token。
- 数据库：PostgreSQL。
- ORM：Prisma ORM 7，使用 `@prisma/adapter-pg` 和 `pg` 直连。
- AI SDK：`openai` Node SDK，配置 `baseURL=https://api.deepseek.com` 以接入 DeepSeek。
- 3D 背景：Three.js，封装在客户端组件 `MemoryRain`。
- 本地数据库连接：通过 SSH tunnel 到服务器本机绑定的 Postgres，不公网暴露 5432。

## 3. 目录结构

```text
src/
  app/
    api/                  # Route Handlers，提供 Web/API/Agent 写入入口
    history/              # 历史小记页面
    login/                # 登录页面
    globals.css           # Tailwind v4 token 与全局样式
    layout.tsx            # 字体、metadata、根布局
    page.tsx              # 首页捕获台
  components/
    capture-panel.tsx     # 首页输入与保存交互
    login-form.tsx        # 登录表单
    memory-rain.tsx       # Three.js 记忆雨
    recent-notes.tsx      # 最近小记服务端组件
  lib/
    ai.ts                 # AI 调用与分析落库
    auth.ts               # session/capture token 校验
    notes.ts              # 小记创建、列表、owner user 初始化
    page-auth.ts          # Server Component 页面级鉴权
    prisma.ts             # Prisma Client 单例
prisma/
  schema.prisma           # 数据模型定义
scripts/
  process-ai.ts           # 手动运行 AI worker 的入口
docs/
  cc-connect.md           # 微信/cc-connect 捕获指南
  deployment.md           # 服务器和数据库部署边界
  design-system.md        # UI 设计系统
  technical-architecture.md
```

`src/generated/prisma` 是 Prisma 生成代码，已在 `.gitignore` 中排除。需要通过 `npm run db:generate` 重新生成。

## 4. 运行时分层

EchoNote 当前可以分成五层：

```mermaid
flowchart TD
  Client[浏览器 / 手机 Web] --> WebRoutes[Next.js 页面与 API]
  WeChat[普通微信] --> CC[cc-connect]
  CC --> Agent[本机 Agent]
  Agent --> CaptureAPI[/api/inlets/agent-capture]
  WebRoutes --> Domain[lib/notes + lib/auth]
  CaptureAPI --> Domain
  Domain --> Prisma[Prisma Client]
  Prisma --> PG[(PostgreSQL)]
  Worker[scripts/process-ai.ts] --> AI[DeepSeek OpenAI-compatible API]
  Worker --> Prisma
  WebRoutes --> Rain[/api/memory-rain]
  Rain --> Prisma
```

- 页面层负责用户交互和展示。
- API 层负责 HTTP 边界、鉴权、参数归一化。
- Domain 层负责可复用业务逻辑，避免把数据库写入散落在各个 route handler 里。
- Prisma 层负责类型安全数据库访问。
- AI worker 是独立脚本，不阻塞小记写入。

## 5. 数据模型

核心模型在 `prisma/schema.prisma`。

### User

V1 是单用户产品，但仍保留 `User` 表，当前会自动 upsert 一个 `owner@echonote.local`。这样未来如果要做多用户或公开版本，不需要完全重构 `Note` 的归属关系。

### Note

保存每条原始小记。

关键字段：

- `content`：原文。
- `source`：来源，当前包括 `WEB`、`WECHAT_CC_CONNECT`、`API`、`IMPORT`。
- `rawMessage`：外部入口的原始消息，比如带 `#` 的微信文本。
- `clientCreatedAt`：客户端提供的时间。
- `aiStatus`：AI 处理状态，`PENDING`、`PROCESSING`、`DONE`、`FAILED`。
- `aiError`：AI 失败原因。

### NoteAiAnalysis

保存 AI 对单条小记的结构化分析。

关键字段：

- `summary`：短摘要。
- `keywords`：关键词数组。
- `mood`：情绪或气质标签。
- `energy`：1-10 的能量值。
- `kind`：小记类型，如 `PLAN`、`QUOTE`、`REMINDER`。
- `poeticFragment`：适合展示在记忆雨或历史页里的短片段。
- `model`：实际调用的模型名。

### MemoryFragment

用于首页记忆雨的展示池。它可以来自 AI 分析，也可以在没有 AI 分析时从原始小记降级生成。

### InletMessage

预留给外部入口消息去重。当前 Agent API 尚未强制要求 external id，后续如果 cc-connect 能提供稳定消息 id，可以在这里建立幂等写入。

## 6. API 设计

### `POST /api/notes`

Web 页面保存小记。要求网页登录 session。

输入：

```json
{
  "content": "一条小记",
  "clientCreatedAt": "2026-06-29T10:00:00+08:00"
}
```

输出：

```json
{
  "note": { "id": "..." }
}
```

### `GET /api/notes`

历史列表接口。支持：

- `q`：按内容模糊搜索。
- `source`：按来源筛选。
- `take`：分页大小，最大 100。
- `cursor`：游标分页。

当前搜索使用 PostgreSQL `contains`，不是全文索引。后续数据量上来后可以增强为中文全文搜索或向量检索。

### `POST /api/inlets/agent-capture`

给 cc-connect / 本机 Agent 使用。要求 `Authorization: Bearer <CAPTURE_TOKEN>`。

输入：

```json
{
  "content": "记录不是整理，是给灵感留门 #",
  "rawMessage": "记录不是整理，是给灵感留门 #",
  "clientCreatedAt": "2026-06-29T10:00:00+08:00"
}
```

处理逻辑：

1. 校验 capture token。
2. 从 `content` 或 `rawMessage` 中取文本。
3. 去掉末尾 `#` 和空白。
4. 写入 `Note`，来源为 `WECHAT_CC_CONNECT`。
5. 返回 `已收下`。

### `GET /api/memory-rain`

首页记忆雨数据接口。优先读取 `MemoryFragment`，如果还没有 AI 片段，则从最近小记中截取内容作为降级展示。

### `POST /api/login` / `POST /api/logout`

网页登录退出。登录成功后设置 HttpOnly session cookie。

## 7. 鉴权设计

当前有两种鉴权：

### Web Session

- 登录密码来自 `APP_PASSWORD`。
- session cookie 名为 `echonote_session`。
- cookie payload 使用 HMAC-SHA256 签名。
- 签名 secret 来自 `SESSION_SECRET`，没有配置时回退到 `APP_PASSWORD`。
- 页面级保护在 `src/lib/page-auth.ts`。
- API 保护在 `src/lib/auth.ts` 的 `isWebAuthenticated()`。

如果本地开发环境没有设置 `APP_PASSWORD`，会自动绕过 Web 登录，方便快速开发。但当前 `.env` 已设置密码，所以本地也需要登录。

### Capture Token

外部 Agent 写入使用 `CAPTURE_TOKEN`，不依赖浏览器 session。这样 cc-connect 调用 API 时不需要模拟网页登录。

## 8. AI 异步处理

AI 处理在 `src/lib/ai.ts` 和 `scripts/process-ai.ts`。

### 为什么异步

保存小记必须尽可能快。如果每次保存都等待模型返回，用户体验会被网络延迟、模型排队和失败重试拖慢。所以 V1 采用：

1. 小记先以 `PENDING` 状态写入数据库。
2. 后台 worker 扫描待处理小记。
3. worker 调用模型生成分析。
4. 成功后写 `NoteAiAnalysis` 和 `MemoryFragment`，并把 `aiStatus` 改成 `DONE`。
5. 失败则写 `aiError`，状态改为 `FAILED`。

### 当前 worker

手动执行：

```powershell
npm run worker:ai
```

脚本会调用：

```ts
analyzePendingNotes(limit)
```

`limit` 默认来自 `AI_WORKER_LIMIT`，用于限制单次处理数量。

### 模型配置

```env
AI_BASE_URL="https://api.deepseek.com"
AI_MODEL="deepseek-v4-flash"
DEEPSEEK_API_KEY="..."
```

代码使用 `openai` SDK，但通过 `baseURL` 指向 DeepSeek 的 OpenAI-compatible 接口。

### 输出鲁棒性

模型被要求返回 JSON：

```json
{
  "summary": "...",
  "keywords": ["..."],
  "mood": "...",
  "energy": 3,
  "kind": "OBSERVATION",
  "poeticFragment": "..."
}
```

实际模型可能把 `energy` 返回为“低/中/高”等字符串，因此 `normalizeEnergy()` 会把它归一化为数字：

- 低 / low / calm / quiet -> 3
- 中 / medium / moderate -> 5
- 高 / high / intense -> 8

这避免轻微格式漂移导致整条分析落库失败。

## 9. 前端实现

### 首页

`src/app/page.tsx` 是 Server Component，先调用 `requirePageAuth()`，未登录时重定向到 `/login`。

页面由三部分组成：

- `MemoryRain`：客户端 Three.js 背景。
- `CapturePanel`：客户端输入面板。
- `RecentNotes`：服务端读取最近小记。

首页设置：

```ts
export const dynamic = "force-dynamic";
```

这样最近小记不会被静态预渲染固定住。

### CapturePanel

`src/components/capture-panel.tsx` 负责输入与保存：

- `textarea` 自动聚焦。
- `Ctrl/⌘ + Enter` 保存。
- 保存成功后清空输入框。
- 状态文案用 `aria-live`。
- API 返回 401 时自动跳 `/login`。

### MemoryRain

`src/components/memory-rain.tsx` 是客户端组件，因为 Three.js 依赖 DOM 和 Canvas。

实现方式：

1. 请求 `/api/memory-rain` 获取片段。
2. 用 Canvas 把文字画成 texture。
3. 用 `THREE.Sprite` 放进 3D 场景。
4. 每帧向下移动，低于视野后回到顶部。
5. 如果用户设置 `prefers-reduced-motion: reduce`，不启动动画。

移动端通过 CSS 降低透明度，减少干扰。后续可以进一步在移动端改成纯 CSS/Canvas 轻量版本。

### 历史页

`src/app/history/page.tsx` 是动态 Server Component。它读取 `q` 参数进行搜索，使用纵向列表展示，不做表格，适合手机阅读。

### 登录页

`src/app/login/page.tsx` + `src/components/login-form.tsx`。登录成功后写入 session cookie，并跳回首页。

## 10. 数据库与服务器连接

当前本地开发不安装 PostgreSQL，而是通过 SSH tunnel 连接服务器容器内数据库：

```powershell
ssh -N -L 15432:127.0.0.1:5432 chips-server
```

本地 `.env` 使用：

```env
DATABASE_URL="postgresql://echo_note_user:<password>@127.0.0.1:15432/echo_note?schema=public"
```

服务器上现有 `gewu-postgres` 容器保持不动，只在其中创建了 EchoNote 独立数据库和独立用户：

- 数据库：`echo_note`
- 用户：`echo_note_user`

PostgreSQL 仍然只绑定服务器本机地址，不暴露公网。

## 11. 环境变量

`.env.example` 记录了需要的变量：

```env
DATABASE_URL="postgresql://echo_note_user:change-me@127.0.0.1:15432/echo_note?schema=public"
APP_PASSWORD="change-me"
SESSION_SECRET="change-me-to-a-long-random-string"
CAPTURE_TOKEN="change-me-to-a-long-random-token"
AI_BASE_URL="https://api.deepseek.com"
AI_MODEL="deepseek-v4-flash"
DEEPSEEK_API_KEY=""
AI_WORKER_LIMIT="10"
```

真实 `.env` 不进 Git。

## 12. 常用命令

```powershell
npm run dev          # 本地开发服务
npm run build        # 生产构建
npm run lint         # ESLint
npm run typecheck    # TypeScript 类型检查
npm run db:generate  # 生成 Prisma Client
npm run db:push      # 推送 schema 到数据库
npm run worker:ai    # 手动处理待 AI 分析的小记
```

## 13. 当前限制

- AI worker 目前是手动脚本，不是常驻队列服务。
- `InletMessage` 去重表已预留，但 Agent capture 接口还没有使用外部消息 id 做幂等。
- 搜索是简单 `contains`，还没有全文索引或语义搜索。
- 登录是单用户密码，不是完整账号体系。
- 记忆雨每次从 API 取一批片段，不做客户端缓存策略。
- 还没有自动化端到端测试。

## 14. 后续演进建议

优先级较高的后续工作：

1. 让 AI worker 常驻化：用 cron、队列或后台进程定期处理 `PENDING` 小记。
2. 为 Agent capture 增加外部消息 id，使用 `InletMessage` 做幂等去重。
3. 增加 `FAILED` 小记的重试入口。
4. 增加 pgvector 或独立 embedding 字段，支持语义召回。
5. 增加 Playwright 测试，覆盖登录、写入、历史搜索、移动端布局。
6. 做 PWA manifest 和移动端主屏安装体验。
7. 将部署从文档预案推进到服务器 Docker Compose 实例。
