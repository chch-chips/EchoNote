# EchoNote 技术架构说明

本文档面向后续开发者和未来的自己，解释 EchoNote 当前 V1 的工程结构、前后端分层、数据流、AI 异步处理方式、移动端 UI 实现、部署边界和可扩展点。它不是产品介绍，而是技术交接文档。

## 1. 项目定位与工程边界

EchoNote 是一个私人瞬时记录系统。V1 的核心不是完整笔记管理，而是把“极快写入”和“后续回响”跑通：

- Web 端：打开页面即可写入一条小记。
- 微信入口：普通微信消息通过 cc-connect 到本机 Agent，再由 Agent 调用 EchoNote API。
- 数据层：所有小记进入 PostgreSQL，保留来源、时间、AI 状态等结构化信息。
- AI 层：后台 worker 异步领取待处理小记，调用 DeepSeek OpenAI-compatible API，生成结构化分析和记忆碎片。
- 展示层：首页用 24 小时快照 + Three.js 做可交互记忆雨；历史页提供完整时间流和搜索。

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
    page.tsx              # 首页捕获台与所有小记入口
  components/
    capture-panel.tsx     # 首页输入与保存交互
    edit-note-button.tsx   # 历史页编辑弹窗
    login-form.tsx        # 登录表单
    memory-rain.tsx       # Three.js 记忆雨
    recent-notes.tsx      # 旧首页小记列表服务端组件
  lib/
    ai.ts                 # AI 调用与分析落库
    memory-rain-snapshots.ts # 记忆雨 24 小时快照
    auth.ts               # session/capture token 校验
    notes.ts              # 小记创建、读取、列表、owner user 初始化
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
  Worker[scripts/process-ai.ts 常驻进程] --> AI[DeepSeek OpenAI-compatible API]
  Worker --> Prisma
  WebRoutes --> Rain[/api/memory-rain]
  Rain --> Prisma
```

- 页面层负责用户交互和展示。
- API 层负责 HTTP 边界、鉴权、参数归一化。
- Domain 层负责可复用业务逻辑，避免把数据库写入散落在各个 route handler 里。
- Prisma 层负责类型安全数据库访问。
- AI worker 是独立后台进程，不阻塞小记写入；本地可用 `npm run dev:all` 同时启动 Web 和 worker。记忆雨由 `MemoryFragment` 展示池和 `MemoryRainSnapshot` 每日快照共同驱动。

## 5. 数据模型

核心模型在 `prisma/schema.prisma`。V1 虽然是单用户产品，但数据模型已经按“原始记录、AI 分析、展示片段、记忆雨快照”拆开，避免把 AI 结果直接混回原文。

### User

V1 会自动 upsert 一个 `owner@echonote.local` 作为唯一使用者。保留 `User` 表是为了以后扩展多用户时不用重写 `Note` 的归属关系。

核心字段：

- `id`：主键，`cuid()`。
- `email`：唯一邮箱，目前固定为 `owner@echonote.local`。
- `displayName`：显示名，目前固定为 `EchoNote Owner`。
- `createdAt` / `updatedAt`：创建和更新时间。
- `notes`：与 `Note` 的一对多关系。

### Note

保存每条原始小记，是所有后续 AI 和记忆雨数据的源头。Web 和微信入口都只负责快速写入 `Note`，默认 `aiStatus=PENDING`，不等待模型返回。

核心字段：

- `id`：主键，`cuid()`。
- `userId`：归属用户，删除用户时级联删除小记。
- `content`：清洗后的正文。Web 输入会 trim，微信入口会额外去掉末尾 `#`。
- `source`：来源枚举，当前包括 `WEB`、`WECHAT_CC_CONNECT`、`API`、`IMPORT`。
- `rawMessage`：外部入口原始消息，比如带 `#` 的微信文本。
- `clientCreatedAt`：客户端提供的时间，用来保留外部发送时间。
- `contentUpdatedAt`：用户编辑正文的时间；从未编辑过的小记显示时回退到 `createdAt`。
- `aiStatus`：AI 状态机，`PENDING -> PROCESSING -> DONE`，失败时进入 `FAILED`。
- `aiError`：AI 失败或 worker 恢复旧任务时写入的说明。
- `createdAt` / `updatedAt`：数据库写入和更新时间；worker 用 `updatedAt` 判断旧 `PROCESSING` 是否超时。
- `analysis`：与 `NoteAiAnalysis` 的一对一关系。
- `fragments`：与 `MemoryFragment` 的一对多关系。

索引：`createdAt`、`source`、`aiStatus`、`userId + createdAt`、`contentUpdatedAt`，分别服务历史排序、来源筛选、worker 领取、用户时间线查询和按更新时间排序。

### NoteAiAnalysis

保存 AI 对单条小记的结构化理解。它是“管理/检索/历史页展示”的分析层，不直接驱动记忆雨动画，但会提供 `poeticFragment` 给展示池。

核心字段：

- `id`：主键，`cuid()`。
- `noteId`：唯一外键，一条小记只保留一份当前分析；重新分析时使用 upsert 覆盖。
- `summary`：短摘要。
- `keywords`：关键词数组，默认空数组。
- `mood`：情绪或气质标签。
- `energy`：1-10 的能量值。模型返回“低/中/高”等文字时会归一化为 3/5/8。
- `kind`：小记类型枚举，当前包括 `THOUGHT`、`PLAN`、`REMINDER`、`QUOTE`、`OBSERVATION`、`INFO`、`OTHER`。
- `poeticFragment`：最适合进入记忆雨的短句，最长取 180 个字符。
- `model`：实际调用的模型名，默认来自 `AI_MODEL`。
- `processedAt`：分析完成时间，重新分析时更新。

### MemoryFragment

记忆雨的展示池。AI 成功处理一条小记后，会先删除这条小记旧的片段，再创建新的 `MemoryFragment`，这样重复处理不会让同一条小记在雨里越堆越多。

核心字段：

- `id`：主键，`cuid()`。
- `noteId`：来源小记，删除小记时级联删除片段。
- `text`：实际展示在记忆雨里的文字，来自 `poeticFragment`，没有时退回 `summary`，再没有时退回原文截断。
- `tone`：片段气质，来自 AI 的 `mood`。
- `weight`：抽样权重，AI 生成片段当前写入为 `2`；降级 fallback 片段按 `1` 处理。
- `createdAt`：片段创建时间。

索引：`createdAt` 用于按创建时间倒序取候选池，`weight` 为未来按权重查询或调优预留。

### MemoryRainSnapshot

记忆雨的 24 小时快照。它不保存渲染出来的位置和速度，只保存“这一天使用哪批片段”和“前端稳定随机用哪个 seed”。这样一天内刷新页面仍然有同一版记忆雨，过期后自动换一版。

核心字段：

- `id`：主键，`cuid()`。
- `seed`：前后端共享的随机种子。后端用它抽样排序，前端用它生成稳定位置、速度、透明度和漂移相位。
- `fragmentIds`：本次快照选中的 `MemoryFragment.id` 顺序。接口返回时会按这个顺序重新查回片段。
- `generatedAt`：快照生成时间。
- `refreshAfter`：快照过期时间，默认是 `generatedAt + MEMORY_RAIN_REFRESH_HOURS`，当前默认 24 小时。
- `forcedRefresh`：是否由测试刷新接口强制生成。

接口每次读取时优先找 `refreshAfter > now` 的最新快照。如果快照里的片段都还存在，就复用它；如果片段缺失或快照过期，就重新生成。系统只保留最新 12 个快照，避免表无限增长。

### InletMessage

预留给外部入口消息去重。当前 Agent capture 接口还没有强制要求外部消息 id，所以这张表暂时不是写入链路的必经步骤。

核心字段：

- `id`：主键，`cuid()`。
- `source`：消息来源，复用 `NoteSource`。
- `externalId`：外部系统消息 id。
- `noteId`：成功写入后关联的 `Note.id`，当前可为空。
- `raw`：外部原始 payload，JSONB。
- `createdAt`：入口消息记录时间。

唯一约束：`source + externalId`，后续 cc-connect 如果能提供稳定消息 id，就可以用它实现幂等写入。

## 6. API 设计

### `POST /api/notes`

Web 页面保存小记。要求网页登录 session。接口只写入原始 `Note`，不会等待 AI 分析。

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
- `take`：分页大小，最大 250。
- `cursor`：游标分页。
- `sort`：排序方式，`created` 按创建时间倒序，`updated` 按 `COALESCE(contentUpdatedAt, createdAt)` 倒序。

当前搜索使用 PostgreSQL `contains`，不是全文索引。后续数据量上来后可以增强为中文全文搜索或向量检索。

### `GET /api/notes/[id]`

登录后读取单条小记原文，供记忆雨点击后的详情浮层使用。接口返回的是收敛后的前端字段，不直接暴露完整 Prisma 对象。

输出：

```json
{
  "note": {
    "id": "...",
    "content": "原始小记正文",
    "source": "WEB",
    "aiStatus": "DONE",
    "createdAt": "...",
    "contentUpdatedAt": null,
    "displayUpdatedAt": "...",
    "clientCreatedAt": null,
    "analysis": {
      "summary": "...",
      "poeticFragment": "...",
      "mood": "...",
      "keywords": []
    }
  }
}
```

### `PATCH /api/notes/[id]`

登录后编辑单条小记正文。接口会 trim 正文，要求长度 1..8000。保存成功后：

1. 更新 `Note.content`。
2. 设置 `contentUpdatedAt` 为当前修改时间。
3. 将 `aiStatus` 重置为 `PENDING` 并清空 `aiError`。
4. 删除旧 `NoteAiAnalysis` 和 `MemoryFragment`，避免旧摘要和旧记忆雨片段继续关联新正文。

### `POST /api/inlets/agent-capture`

给 cc-connect / 本机 Agent 使用。要求 `Authorization: Bearer <CAPTURE_TOKEN>`。接口会清洗内容、写入 `Note`，也不会等待 AI。

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

首页记忆雨数据接口。要求 Web session。它返回当前有效的 24 小时快照；没有快照或快照失效时自动生成新快照。返回结构包含：

```json
{
  "seed": 123,
  "generatedAt": "...",
  "refreshAfter": "...",
  "fragments": [
    { "id": "...", "noteId": "...", "text": "...", "tone": "...", "weight": 2, "createdAt": "..." }
  ]
}
```

如果还没有 AI 片段，则按创建时间倒序从小记中截取内容作为降级展示，并把 `noteId` 指向原始小记，保证 fallback 片段也能点击取回原文。

### `POST /api/memory-rain/refresh`

登录后可用的测试接口。它先处理一批 `PENDING` 小记，再强制生成新的记忆雨快照，避免开发时等待 24 小时。

可选查询参数：

- `limit`：本次最多处理多少条待分析小记；默认使用 `AI_WORKER_LIMIT`。

输出：

```json
{
  "processed": 1,
  "failed": 0,
  "seed": 123,
  "generatedAt": "...",
  "refreshAfter": "...",
  "fragments": []
}
```

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

AI 处理在 `src/lib/ai.ts` 和 `scripts/process-ai.ts`。设计目标是：保存小记立即结束，AI 紧接着在后台处理；即使手动刷新接口和常驻 worker 同时运行，也不能重复消费同一条小记。

### 为什么异步

保存小记必须尽可能快。如果每次保存都等待模型返回，用户体验会被网络延迟、模型排队和失败重试拖慢。所以 V1 采用：

1. Web 或微信入口只写入 `Note`，默认 `aiStatus=PENDING`。
2. AI worker 轮询数据库，原子领取 `PENDING` 小记。
3. worker 调用模型生成结构化分析。
4. 成功后写 `NoteAiAnalysis`，再写 `MemoryFragment`，最后把 `Note.aiStatus` 改成 `DONE`。
5. 失败则写 `Note.aiError`，状态改为 `FAILED`。

### Worker 运行方式

常驻执行：

```powershell
npm run worker:ai
```

手动处理一批：

```powershell
npm run worker:ai:once
```

本地同时启动 Web 和 worker：

```powershell
npm run dev:all
```

`worker:ai` 启动后会：

1. 调用 `recoverStaleProcessingNotes()`，把超过 `AI_WORKER_STALE_MINUTES` 仍停在 `PROCESSING` 的小记恢复为 `PENDING`。
2. 进入循环，每隔 `AI_WORKER_POLL_MS` 调用一次 `analyzePendingNotes()`。
3. 每批最多领取 `AI_WORKER_LIMIT` 条；代码层还有 50 条上限，防止配置过大导致单批处理时间过长。
4. 收到 `SIGINT` / `SIGTERM` 时断开 Prisma 连接。

### 如何避免重复处理

领取任务不是先 `findMany` 再逐条更新，而是在事务里用 PostgreSQL 锁：

```sql
SELECT "id"
FROM "Note"
WHERE "aiStatus" = 'PENDING'::"AiStatus"
ORDER BY "createdAt" ASC
LIMIT <limit>
FOR UPDATE SKIP LOCKED
```

同一个事务随后把这些 id 更新为 `PROCESSING`。如果常驻 worker 和 `/api/memory-rain/refresh` 同时触发，后进入的进程会跳过已经被锁住的行，只领取还没被占用的小记。

### AI 如何分析一条小记

`analyzeClaimedNote()` 对已经处于 `PROCESSING` 的小记执行以下步骤：

1. 使用 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY` 创建 OpenAI-compatible client。
2. 使用 `AI_BASE_URL`，默认 `https://api.deepseek.com`。
3. 使用 `AI_MODEL`，默认 `deepseek-v4-flash`。
4. 发送 system prompt，要求模型返回严格 JSON，字段为 `summary`、`keywords`、`mood`、`energy`、`kind`、`poeticFragment`。
5. 用正则从模型回复中截取第一个 JSON 对象并解析。
6. 校正 `kind`，不在 `NoteKind` 枚举内就降级为 `OTHER`。
7. 校正 `energy`：数字会 clamp 到 1-10；“低/low/calm/quiet”归一为 3，“中/medium/moderate”归一为 5，“高/high/intense”归一为 8。
8. 生成 fragment 文本：优先 `poeticFragment`，其次 `summary`，最后原文，统一截断到 180 字符。

成功落库顺序：

1. upsert `NoteAiAnalysis`。
2. deleteMany 该 `noteId` 下旧的 `MemoryFragment`。
3. create 新 `MemoryFragment`，`text=fragment`，`tone=mood`，`weight=2`。
4. update `Note.aiStatus=DONE`。

失败时：

1. update `Note.aiStatus=FAILED`。
2. 把异常消息写入 `Note.aiError`。
3. 继续抛出异常，由批处理计入 `failed`。

### 记忆碎片如何进入记忆雨

AI 分析不会直接改前端。它只把适合展示的一句话写进 `MemoryFragment`。记忆雨接口再从 `MemoryFragment` 生成或读取 `MemoryRainSnapshot`。

这层拆分很重要：

- `Note` 保留原始记录。
- `NoteAiAnalysis` 保留 AI 对记录的理解。
- `MemoryFragment` 是可展示的短句池。
- `MemoryRainSnapshot` 决定 24 小时内展示哪一版雨。

### 手动刷新链路

`POST /api/memory-rain/refresh` 是测试用的受保护接口，要求网页登录 session。它会：

1. 调用 `analyzePendingNotes(limit)`，先处理一批还没分析的小记。
2. 调用 `generateMemoryRainSnapshot(true)`，强制生成新快照。
3. 返回 `processed`、`failed`、`seed`、`generatedAt`、`refreshAfter` 和 `fragments`。

这个接口不会暴露给 capture token。它的作用是让开发测试不必等 24 小时，就能看到新片段进入记忆雨。
## 9. 前端实现

### 首页

`src/app/page.tsx` 是 Server Component，先调用 `requirePageAuth()`，未登录时重定向到 `/login`。

首页当前由三部分组成：

- `MemoryRain`：客户端 Three.js 交互记忆雨，占据全屏背景层。
- `CapturePanel`：客户端输入面板，是首页视觉和交互主角。
- “所有小记”入口：右上角轻量导航，进入 `/history`，不在首页内展示首页小记列表。

首页设置：

```ts
export const dynamic = "force-dynamic";
```

首页不再渲染 `RecentNotes`，避免第一屏变成信息流。查看、搜索和删除小记都由历史页承担。

### CapturePanel

`src/components/capture-panel.tsx` 负责输入与保存：

- `textarea` 自动聚焦。
- `Ctrl/⌘ + Enter` 保存。
- 保存成功后清空输入框。
- 状态文案用 `aria-live`。
- API 返回 401 时自动跳 `/login`。
- 视觉上保持低干扰，只保留必要标题、输入区、状态反馈和保存按钮。

### MemoryRain

`src/components/memory-rain.tsx` 是客户端组件，因为 Three.js 依赖 DOM、Canvas、pointer events 和 `requestAnimationFrame`。它仍然不决定“当前快照显示哪批记忆”；这件事由 `/api/memory-rain` 和 `MemoryRainSnapshot` 完成。

#### 后端如何取片段

`GET /api/memory-rain` 要求 Web session。它调用 `getMemoryRainSnapshot()`：

1. 查找 `refreshAfter > now` 的最新快照。
2. 如果找到快照，按 `fragmentIds` 顺序读取对应 `MemoryFragment`。
3. 如果片段完整存在，直接返回原快照的 `seed`、`generatedAt`、`refreshAfter`、`fragments`。
4. 如果片段为空但快照仍有效，返回同一个 `seed`，片段按创建时间倒序从 `Note` 截断降级生成，确保空库或未分析时页面也有内容。
5. 如果没有有效快照，或快照片段已经不完整，则生成新快照。

返回片段包含 `noteId`。AI 片段的 `noteId` 来自 `MemoryFragment.noteId`，fallback 片段的 `noteId` 使用原始 `Note.id`。

#### 前端如何构造雨

前端请求 `/api/memory-rain` 后拿到：

```ts
type MemoryRainResponse = {
  seed?: number;
  fragments?: { id: string; noteId?: string; text: string; tone?: string | null; weight?: number }[];
};
```

然后执行：

1. 如果接口失败或没有片段，使用三条内置 fallback 文案。
2. 用后端返回的 `seed` 初始化线性同余随机数发生器。
3. 创建 Three.js `Scene`、`PerspectiveCamera`、透明 `WebGLRenderer`、星点场和文字 `Sprite`。
4. 每条文字先画到 1024x180 的 Canvas，再转成 `THREE.CanvasTexture`。
5. 用 texture 创建 `THREE.SpriteMaterial`，再创建 `THREE.Sprite`。
6. 用 seeded random 生成每个 sprite 的初始位置、scale、opacity、speed、phase 和漂移参数。
7. sprite 数量在移动端和桌面端分别限制，避免背景过重。

#### 前端如何交互和刷新

动画循环里每帧会：

1. 用单个 `THREE.Raycaster` 检测 pointer 与文字 sprite 的交点。
2. hover 命中文字时提高 opacity、放大 scale、切换 cursor，并通过 `aria-live` 更新当前回响文本。
3. 点击命中文字时读取该片段的 `noteId`，调用 `GET /api/notes/[id]` 拉取原文。
4. 详情浮层展示记忆片段、原始小记正文、摘要、时间、来源和 mood。
5. 让每个 sprite 按自己的速度向下移动，并用正弦漂移和 group rotation 形成空间感。
6. y 小于阈值时回到顶部，形成循环下落。
7. 调用 `renderer.render(scene, camera)` 并继续 `requestAnimationFrame`。

刷新策略分三层：

- 自然刷新：`MemoryRainSnapshot.refreshAfter` 到期后，下一次请求 `/api/memory-rain` 会生成新快照，默认 24 小时。
- 手动刷新：开发测试时调用 `POST /api/memory-rain/refresh`，会先处理待分析小记，再强制生成新快照。
- 页面刷新：浏览器重新加载页面会重新请求 `/api/memory-rain`；如果快照未过期，拿到同一个 seed 和片段顺序。

如果用户系统设置 `prefers-reduced-motion: reduce`，组件不会启动 Three.js 动画。组件卸载时会移除 pointer/resize listener，释放 texture、material、geometry、renderer，并清空宿主节点，避免热更新或路由切换后残留 WebGL 资源。

### 历史页

`src/app/history/page.tsx` 是动态 Server Component。它读取 `q`、`sort` 参数进行搜索和排序，使用纵向列表展示，不做表格，适合手机阅读。首页右上角“所有小记”入口会导航到这里。

历史页当前承担轻量管理能力：

- 按内容搜索小记。
- 按创建时间或更新时间倒序查看。
- 展示创建时间、内容更新时间、来源和 AI 状态。
- 通过 `EditNoteButton` 打开编辑弹窗，保存时调用 `PATCH /api/notes/[id]`。
- 编辑成功后刷新当前路由，让列表时间和内容保持一致。

编辑弹窗使用 portal 渲染到 `document.body`，避免被列表卡片的滤镜、层叠上下文或 overflow 裁切。长内容在弹窗内部滚动，页面本身不被撑出横向溢出。

### 登录页

`src/app/login/page.tsx` + `src/components/login-form.tsx`。登录成功后写入 session cookie，并跳回首页。
## 10. 数据库、迁移与服务器连接

EchoNote 已经有线上稳定版本，schema 变更必须通过 Prisma migration 管理。本地/dev 使用 `npm run db:migrate` 生成并应用 migration；staging/production 使用 `npm run db:deploy` 应用已经提交的 migration。`prisma db push` 只用于早期原型或一次性本地试验，不作为常规生产流程。

当前已确立的最小企业级环境是 `local-dev + production`：

- local-dev app：本机 `localhost:3000`，运行 `npm run dev`。
- local-dev database：服务器 PostgreSQL 容器中的 `echo_note_dev`，用户 `echo_note_dev_user`，通过本机 SSH 隧道 `127.0.0.1:15432` 访问。
- production app：`echonote-web` / `echonote-worker`。当前稳定版本仍由 systemd 守护；目标发布链路为 GitHub CI + CNB 构建 + TCR + Docker Compose，完成 POC 和回滚演练后再切换。
- production database：`echo_note`，用户 `echo_note_user`。

如果生产库曾经被手工 hotfix，需要补同等 migration。能重复执行的变更优先写成幂等 SQL；不能重复执行时，确认生产库已经具备同等结构后，用 `prisma migrate resolve --applied "<migration-folder>"` 对齐迁移历史。

当前本地开发不安装 PostgreSQL，通过 SSH tunnel 连接服务器容器内 dev 数据库：

```powershell
ssh -N -L 15432:127.0.0.1:5432 chips-server
```

本地 `.env` 使用 dev 数据库账号：

```env
DATABASE_URL="postgresql://echo_note_dev_user:<password>@127.0.0.1:15432/echo_note_dev?schema=public"
```

服务器上现有 `gewu-postgres` 容器保持不动。EchoNote 使用两套数据库和用户：

- dev 数据库：`echo_note_dev`
- dev 用户：`echo_note_dev_user`
- production 数据库：`echo_note`
- production 用户：`echo_note_user`

PostgreSQL 仍然只绑定服务器本机地址，不暴露公网。

目标生产容器使用精简 runtime 镜像运行两个长期进程：

```text
echonote-web     -> node server.js
echonote-worker  -> node worker/process-ai.mjs
```

AI worker 在构建阶段由 esbuild 打包成单个 ESM bundle，生产环境不再携带 TypeScript 源码、`tsx` 和 esbuild 常驻进程。Prisma migration 使用独立 target 生成的短生命周期镜像：

```text
echonote-migrate -> npm run db:deploy
```

CNB 为 runtime 和 migrate 镜像分别生成包含完整 commit SHA 的不可变 tag。部署脚本在旧版本仍在线时完成拉取和 migration，只有通过前置检查后才切换进程；健康检查失败时恢复上一容器镜像，首次迁移期则恢复原 systemd 服务。

Compose 暂时使用 `network_mode: host`。原因是生产 PostgreSQL 仍通过服务器本机 `127.0.0.1:5432` 暴露给应用，nginx 也继续代理 `127.0.0.1:3001`；host network 可以在不重建数据库容器、不改 nginx 入口的前提下完成应用容器化。后续如果要进一步 Docker 原生化，再把 EchoNote 和 PostgreSQL 接入同一个显式 Docker network。

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
AI_WORKER_POLL_MS="1000"
AI_WORKER_STALE_MINUTES="15"
MEMORY_RAIN_REFRESH_HOURS="24"
MEMORY_RAIN_FRAGMENT_LIMIT="80"
```

真实 `.env` 不进 Git。

## 12. 常用命令

```powershell
npm run dev          # 本地开发服务（仅 Web）
npm run dev:all      # 本地同时启动 Web 和 AI worker
npm run build        # 生产构建
npm run lint         # ESLint
npm run typecheck    # TypeScript 类型检查
npm run db:generate  # 生成 Prisma Client
npm run db:migrate   # 本地/dev 生成并应用 Prisma migration
npm run db:deploy    # staging/production 应用已提交 migration
npm run worker:ai    # 常驻处理待 AI 分析的小记
npm run worker:ai:once # 手动处理一批待 AI 分析的小记
```

## 13. 当前限制

- `InletMessage` 去重表已预留，但 Agent capture 接口还没有使用外部消息 id 做幂等。
- 搜索是简单 `contains`，还没有全文索引或语义搜索。
- 登录是单用户密码，不是完整账号体系。
- 还没有自动化端到端测试。

## 14. 后续演进建议

优先级较高的后续工作：

1. 为 Agent capture 增加外部消息 id，使用 `InletMessage` 做幂等去重。
2. 增加 `FAILED` 小记的重试入口。
3. 增加 pgvector 或独立 embedding 字段，支持语义召回。
4. 增加 Playwright 测试，覆盖登录、写入、历史搜索、移动端布局。
5. 做 PWA manifest 和移动端主屏安装体验。
6. 将当前 HTTP 临时入口升级为 HTTPS 域名入口，并把 `SESSION_COOKIE_SECURE` 改回 `true`。
