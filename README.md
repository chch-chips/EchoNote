# EchoNote / 回声笺

EchoNote 是一个私人瞬时记录工具，用来收下生活、工作、学习里突然出现的念头、提醒、计划、摘句和细碎信息。V1 先服务个人自用：网页快速记录、移动端适配、普通微信通过 cc-connect + 本机 Agent 写入。

## V1 目标

- 打开网页即可输入，保存后立即清空，不要求标题、标签或分类。
- 普通微信消息末尾加 `#`，通过 cc-connect 转给本机 Agent，再调用 EchoNote API 保存。
- 所有小记写入 PostgreSQL，保留来源和时间信息。
- AI 后台异步生成摘要、关键词、诗性片段和记忆雨素材。
- 首页用轻量 Three.js 呈现“记忆雨”，让旧想法以回声的方式回来。

## 技术栈

- Next.js App Router + TypeScript
- Tailwind CSS v4 CSS-first tokens
- Prisma ORM 7 + PostgreSQL
- OpenAI-compatible SDK，默认指向 DeepSeek
- Three.js 桌面端记忆雨
- Docker Compose 自托管部署预案

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

启动开发服务（仅 Web）：

```powershell
npm run dev
```

启动开发服务和 AI 常驻 worker：

```powershell
npm run dev:all
```

## 数据库

项目使用 PostgreSQL。当前机器不需要本地安装 PostgreSQL，推荐通过 SSH 隧道连接腾讯云服务器上的本机绑定数据库端口：

```powershell
ssh -N -L 15432:127.0.0.1:5432 chips-server
```

然后在 `.env` 中把 `DATABASE_URL` 指向 `127.0.0.1:15432`。不要把 PostgreSQL 5432 端口暴露到公网。

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

AI 分析、记忆碎片、24 小时记忆雨快照和 Three.js 渲染链路见 [技术架构说明](docs/technical-architecture.md)。

## 文档

- [技术架构说明](docs/technical-architecture.md)
- [设计系统](docs/design-system.md)
- [cc-connect 接入指南](docs/cc-connect.md)
- [部署说明](docs/deployment.md)
