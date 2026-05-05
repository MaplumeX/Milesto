# AI对话底栏与其他界面对齐

## Goal

让 AI 对话面板的底栏（chat-composer）与主内容区的底栏（content-bottom-bar）在视觉高度上对齐，消除"偏高"的感觉。

## What I already know

* `.content-bottom-bar` 固定高度 `var(--bottom-bar-height)` = 56px，无垂直内边距，`align-items: center`
* `.chat-composer` 无固定高度，`padding: 10px 12px`（上下各 10px），`align-items: flex-end`
* `.content-bottom-bar` 有 `backdrop-filter: blur(10px)`，chat-composer 无
* 两者在 `content-grid` 中是兄弟元素，底部边缘对齐，但由于 chat-composer 高度较小 + 内容靠底，视觉上显得"偏高"
* chat-composer 内 textarea 高度自适应（单行时约 30px），加上 10px × 2 padding ≈ 50px，小于 56px

## Requirements

* chat-composer 单行输入时高度与 content-bottom-bar 一致（56px）
* 多行输入时可自适应增长
* 内容垂直居中对齐（与 content-bottom-bar 一致）

## Acceptance Criteria

- [ ] chat-composer 单行状态下高度 = 56px（与其他底栏齐平）
- [ ] 多行输入时高度可自适应增长
- [ ] 内容垂直居中
- [ ] 不影响 chat-composer 其他功能（发送、停止、禁用态）

## Definition of Done

* Lint / typecheck 通过
* 视觉验证：AI 对话底栏与主内容底栏底部对齐、高度一致

## Out of Scope

* 底栏按钮功能变更
* 毛玻璃效果（backdrop-filter）——聊天面板无需透明效果，因为消息不会滚动到底栏后面

## Technical Notes

* 文件：`src/index.css`（`.chat-composer` 样式，约 L3830）
* CSS 变量：`--bottom-bar-height: 56px`（L3）
* 修复方向：加 `min-height: var(--bottom-bar-height)` + 改 `align-items: center`
