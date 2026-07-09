# EchoNote / 回声笺

EchoNote 是一个私人瞬时记录工具，用来快速收下生活、工作、学习里突然出现的念头、提醒、计划、摘句和细碎信息。

它的核心不是把笔记管理得更复杂，而是让记录尽量轻：打开网页即可写入，保存后立即回到空白输入状态；普通微信消息也可以通过 cc-connect 和本机 Agent 写入。后台 AI 会异步生成摘要、关键词和记忆碎片，首页再用可交互的记忆雨把旧想法带回来。

## 当前能力

- Web 快速记录：登录后在首页输入并保存小记。
- 微信捕获：普通微信消息末尾加 `#`，通过 cc-connect + Agent 写入 EchoNote。
- 历史页：查看、搜索、删除和编辑小记，支持按创建时间或更新时间排序。
- AI 分析：后台 worker 异步生成摘要、关键词、情绪、类型和诗性片段。
- 记忆雨：首页使用 Three.js 展示 24 小时记忆快照，点击片段可查看原文。
- 私有部署：当前运行在腾讯云服务器，Web 与 AI worker 分离；部署链路正在切换为腾讯云容器镜像仓库 + Docker Compose。

## 技术栈

- Next.js App Router + TypeScript
- Tailwind CSS v4 CSS-first tokens
- Prisma ORM 7 + PostgreSQL
- OpenAI-compatible SDK，默认指向 DeepSeek
- Three.js 交互式记忆雨
- Docker / Docker Compose
- GitHub Actions + 腾讯云容器镜像服务 CCR/TCR

## 本地开发

安装依赖：

```powershell
npm install
```

创建本地环境变量文件：

```powershell
Copy-Item .env.example .env
```

生成 Prisma Client：

```powershell
npm run db:generate
```

启动 Web 开发服务：

```powershell
npm run dev
```

启动 Web 和 AI worker：

```powershell
npm run dev:all
```

常用检查：

```powershell
npm run typecheck
npm run lint
npm run build
```

## 数据库

项目使用 PostgreSQL。当前本地开发采用隔离 dev 数据库，通过 SSH 隧道连接服务器上的 PostgreSQL 容器：

```powershell
ssh -N -L 15432:127.0.0.1:5432 chips-server
```

本地 `.env` 指向：

```env
DATABASE_URL="postgresql://echo_note_dev_user:<password>@127.0.0.1:15432/echo_note_dev?schema=public"
```

生产数据库是 `echo_note`，只供服务器上的 `echonote-web` 和 `echonote-worker` 使用。不要让本地 `.env` 指向生产库，也不要把 PostgreSQL 5432 暴露到公网。

schema 变更以 `prisma/migrations/` 为准：

```powershell
npm run db:migrate   # local/dev 生成并应用 migration
npm run db:deploy    # staging/production 应用已提交 migration
```

`prisma db push` 不作为上线后的常规生产流程。

## 捕获 API

Agent/cc-connect 写入接口：

```http
POST /api/inlets/agent-capture
Authorization: Bearer <CAPTURE_TOKEN>
Content-Type: application/json
```

请求体：

```json
{
  "content": "记录不是整理，是给灵感留门 #",
  "source": "wechat-cc-connect",
  "clientCreatedAt": "2026-06-27T12:00:00+08:00",
  "rawMessage": "记录不是整理，是给灵感留门 #"
}
```

接口会去掉末尾 `#` 和空白，成功后返回 `已收下`。

## AI Worker

常驻处理待分析小记：

```powershell
npm run worker:ai
```

手动处理一批待分析小记：

```powershell
npm run worker:ai:once
```

默认 AI 配置：

- `AI_BASE_URL=https://api.deepseek.com`
- `AI_MODEL=deepseek-v4-flash`
- `DEEPSEEK_API_KEY=...`

## 部署

生产发布使用容器镜像。GitHub Actions 在合并到 `main` 后构建镜像，并推送到腾讯云私有镜像仓库：

```text
ccr.ccs.tencentyun.com/<namespace>/echonote:sha-<git-sha>
ccr.ccs.tencentyun.com/<namespace>/echonote:main
```

服务器通过 `docker-compose.prod.yml` 运行两个容器：

- `echonote-web`：Next.js Web 服务。
- `echonote-worker`：AI worker。

两者使用同一个镜像，连接服务器上已有的 PostgreSQL 容器。生产数据库变更仍然通过 `npm run db:deploy` 应用已提交的 Prisma migrations。

## 文档

- [开发工作流规范](docs/development-workflow.md)
- [技术架构说明](docs/technical-architecture.md)
- [设计系统](docs/design-system.md)
- [cc-connect 接入指南](docs/cc-connect.md)
- [部署说明](docs/deployment.md)
- [开发日志](docs/development-log.md)
