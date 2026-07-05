# EchoNote 设计系统

本设计系统基于 UI/UX Pro Max 查询结果和 EchoNote 的产品气质整理而成。EchoNote 是私人瞬时记录工具，不是营销页、企业后台或信息流产品；第一屏必须服务“快速写下”和“让旧想法以回响方式回来”。

## 产品气质

EchoNote 应该像一张夜晚的私人书桌，也像一个有纵深的记忆空间：安静、直接、轻微诗意。它不追求管理功能的密度，核心价值是让用户不费力地写下当下，并在未来通过记忆雨重新遇见这些片段。

## 首页原则

- 第一屏主体只有捕获台，不展示首页小记列表。
- “所有小记”入口可以存在，但必须作为轻量导航放在边缘位置，不能抢输入框主导权。
- 捕获台必须自动聚焦，保存后清空，支持 `Ctrl/⌘ + Enter`。
- 首页背景可以有持续动效，但交互优先级低于输入和保存。
- 点击记忆雨文字时，以浮层显示对应小记原文，而不是把历史列表塞回首页。

## 视觉方向

- 风格：深色反思型工具，空间化、克制、诗性极简。
- 背景：深墨色为底，用琥珀、灰绿、低饱和玫瑰色做细微层次。
- 表面：捕获台和记忆浮层使用半透明深色表面、细边框和柔和阴影。
- 圆角：常规工具表面保持 `8px` 左右，圆形按钮仅用于明确的 icon action。
- 动效：记忆雨可以缓慢流动和产生 3D 深度，但不能造成眩晕或干扰输入。
- 图标：统一使用 Lucide，不用 emoji 作为结构图标。

## 颜色 Token

定义在 `src/app/globals.css`：

- `--ink`：主背景
- `--ink-soft`：抬升表面
- `--paper`：主文字
- `--paper-muted`：次级文字
- `--amber`：主强调色
- `--mist` / `--moss` / `--rose`：辅助强调色
- `--line`：细边框
- `--ease-echonote`：全局动效节奏

## 字体

- 正文：优先使用系统中的 Inter 或系统无衬线字体，保证长时间使用的清晰度。
- 品牌和诗性点缀：优先使用系统中的 Noto Serif SC、Source Han Serif SC、宋体类中文衬线字体。
- 字体实现使用系统字体栈，不依赖 `next/font/google` 在构建时下载 Google Fonts，避免网络环境影响发布构建。
- 移动端正文不得低于 16px。
- 不使用负字距。
- 小记正文使用较高行高，让短句和长段都容易阅读。

## 记忆雨交互

- `MemoryRain` 是客户端 Three.js 组件，负责空间化文字、星点场、hover 高亮和点击命中。
- 文字片段来自 `/api/memory-rain` 的 24 小时快照；片段带 `noteId` 时可点击取回原文。
- 点击后通过 `GET /api/notes/[id]` 拉取原始小记，只显示当前浮层需要的字段。
- 无关联原文或接口失败时显示局部错误，不影响捕获台继续使用。
- 必须尊重 `prefers-reduced-motion`，用户减少动态时不启动 Three.js 动画。

## 移动端规则

- 使用 `min-h-dvh`，避免移动端地址栏导致高度错位。
- 触控目标不小于 44px。
- 软键盘弹出时，输入区必须仍然可用。
- 375px 宽度不能出现横向滚动。
- 记忆雨在小屏上降低数量、透明度和像素比，保证输入优先。
- 历史页使用纵向流，不做桌面表格。

## 可访问性规则

- 输入框和按钮必须有清晰 focus 状态。
- 核心文字对比度至少满足 WCAG AA。
- 保存反馈使用 `aria-live`。
- 记忆雨 hover 文本用屏幕阅读器友好的 live region 描述。
- 图标按钮必须有可访问名称。

## UI/UX Pro Max 校验命令

```powershell
python "C:\Users\c'c'c'c'c'c'x\.agents\skills\ui-ux-pro-max\scripts\search.py" "productivity notes personal memory capture app reflective poetic mobile dashboard dark elegant" --design-system -p "EchoNote" -f markdown
python "C:\Users\c'c'c'c'c'c'x\.agents\skills\ui-ux-pro-max\scripts\search.py" "animation accessibility z-index loading mobile" --domain ux -n 5
python "C:\Users\c'c'c'c'c'c'x\.agents\skills\ui-ux-pro-max\scripts\search.py" "responsive app router mobile forms animation" --stack nextjs -n 5
```
