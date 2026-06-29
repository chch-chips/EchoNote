# EchoNote 设计系统

本设计系统基于 UI/UX Pro Max 查询结果和 EchoNote 的产品气质整理而成。工具输出倾向于深色、高可读、移动优先的私人生产力应用方向；本文档将其收敛为 EchoNote 的实际界面原则，而不是营销落地页。

## 产品气质

EchoNote 应该像一张夜晚的私人书桌：安静、直接、轻微诗意。它不是企业后台，不是复杂笔记管理器，也不是信息流产品。第一屏只服务一件事：现在写下，之后再整理。

## 视觉方向

- 风格：深色反思型工具，克制的诗性极简。
- 背景：深墨色为底，用琥珀色和灰绿色做细微强调。
- 卡片：只用于真实小记、捕获面板和必要工具，不做层层嵌套卡片。
- 圆角：捕获面板可稍柔和，列表项控制在 16px 左右。
- 动效：记忆雨可以持续流动，但不能抢走输入框的主导权。
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

## 字体

- 正文：Inter，保证长时间使用的清晰度。
- 品牌和诗性点缀：Noto Serif SC。
- 移动端正文不得低于 16px。
- 不使用负字距。
- 小记正文使用较高行高，让短句和长段都容易阅读。

## 移动端规则

- 使用 `min-h-dvh`，避免移动端地址栏导致高度错位。
- 触控目标不小于 44px。
- 软键盘弹出时，输入区必须仍然可用。
- 375px 宽度不能出现横向滚动。
- 历史页使用纵向流，不做桌面表格。

## 可访问性规则

- 输入框和按钮必须有清晰 focus 状态。
- 核心文字对比度至少满足 WCAG AA。
- 保存反馈使用 `aria-live`。
- 尊重 `prefers-reduced-motion`，用户减少动态时停用记忆雨。
- 图标按钮必须有可访问名称。

## UI/UX Pro Max 校验命令

```powershell
python "C:\Users\c'c'c'c'c'c'x\.agents\skills\ui-ux-pro-max\scripts\search.py" "productivity notes personal memory capture app reflective poetic mobile dashboard dark elegant" --design-system -p "EchoNote" -f markdown
python "C:\Users\c'c'c'c'c'c'x\.agents\skills\ui-ux-pro-max\scripts\search.py" "animation accessibility z-index loading mobile" --domain ux -n 5
python "C:\Users\c'c'c'c'c'c'x\.agents\skills\ui-ux-pro-max\scripts\search.py" "responsive app router mobile forms animation" --stack nextjs -n 5
```
