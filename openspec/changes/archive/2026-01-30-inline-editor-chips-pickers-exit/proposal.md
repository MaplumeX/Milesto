## Why

当前行内任务编辑器在交互与视觉上仍偏“表单/扩展面板”：编辑器内会用展开区块承载 Schedule/Due/Tags，且存在显式 Collapse 按钮。它会导致虚拟列表中打开行高度频繁变化、视线焦点漂移、以及“如何退出编辑器”的路径不一致。

本变更将行内编辑器收敛为“像原任务行展开”的形态：值以左下角摘要 chips 呈现、编辑通过浮层 picker 完成，并提供一致的键盘/点击退出手势，同时保证退出/切换任务时不会丢失 tags 等异步保存。

## What Changes

- 行内编辑器头部改为 row-like：Done toggle + Title 输入框与原任务行对齐（标题处于原 row 展开位置），移除显式 `Collapse` 按钮。
- 行内编辑器底部新增左下角摘要 chips：`Scheduled` / `Due` / `Tags` 仅在有值时显示；chip 可点击打开对应 picker；chip 右侧 `×` 用于清除该项。
- `Schedule` / `Due` / `Tags` 操作改为浮层 picker（popover / 原生 date picker），不再通过在编辑器内插入展开区块来选择。
- 右下角按钮显示规则调整：`Schedule`/`Due` 仅在无值时显示为“添加入口”；`Tags` 按钮常驻；`Checklist` 仍保持“仅在为空时显示”。
- 退出编辑器手势统一：
  - `Enter/Return`：仅在标题输入框聚焦时退出
  - `Escape` 与 `Cmd/Ctrl+Enter`：任意位置退出
  - 点击编辑器外区域（click-away）退出（若 picker 打开则先关闭 picker）
- tags 勾选即保存，同时退出/切换任务时 flush 必须等待 tags 保存完成；保存失败时阻止退出并将焦点引导回相关入口。

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `task-inline-editor`: 行内展开编辑器的布局与交互（header 标题位置、底部 chips、picker 行为、按钮显示规则、退出手势）发生变化。
- `task-editor-auto-save`: 退出/切换任务时的 flush 语义扩展到 tags 保存（必须等待 in-flight 的 setTags 完成，失败时阻止退出）。
- `task-editor-overlay-paper`: 关闭手势与焦点恢复的要求需要补充/对齐（移除显式关闭按钮、引入 click-away 与 title-return 退出）。

## Impact

- 影响代码：`src/features/tasks/TaskEditorPaper.tsx`, `src/features/tasks/TaskInlineEditorRow.tsx`, `src/app/AppShell.tsx`, `src/index.css`。
- 可能新增/调整小型 popover 组件与样式（用于 Tags picker 与 date picker fallback），但不引入新的第三方依赖为目标。
- 不涉及数据库 schema、IPC 通道或 `window.api` 形状变更；继续复用现有 `window.api.task.update` / `window.api.task.setTags`。
- 需要确保虚拟列表（@tanstack/react-virtual）在 editor 高度变化与 popover 打开/关闭时保持稳定测量与键盘导航体验。
