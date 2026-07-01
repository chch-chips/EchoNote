# EchoNote 开发日志

本文档按时间记录每一轮使用 Codex 进行 Vibe Coding 的开发沉淀。它不按功能模块重新整理，只记录当轮需求、执行任务、完成效果、核心设计与问题修复。

## 2026-07-01

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