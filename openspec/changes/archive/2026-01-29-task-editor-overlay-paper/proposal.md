## Why

当前任务编辑采用三栏（Sidebar + List + Detail）常驻布局，编辑区被固定压缩到 420px，长 notes/多字段编辑时可读性与专注度差；同时“选中=打开详情”的耦合会导致键盘上下移动选择时编辑器频繁跳动，破坏键盘优先的流。

我们希望把任务编辑体验对齐 Things 3：在列表上下文中“原地打开”一张白纸（Overlay Paper）进行编辑，自动保存、可快速关闭并回到原位置。

## What Changes

- 任务编辑从“右侧常驻第三栏”改为“内容区内的 Overlay Paper（白纸浮层）”，不再挤压列表宽度；底部栏保持可见。
- 单击任务仅改变 selection（高亮/焦点），不再自动打开编辑器；按 Return 打开当前选中任务的 Overlay Paper。
- Overlay Paper 打开时锁定背景列表交互（滚动/点击），关闭后焦点回到原列表位置。
- 任务编辑改为全字段自动保存（title/notes/base_list/project/section/area/scheduled/due 等），并保留 Cmd+Return 作为“强制保存并关闭”的确定性操作。
- 失败处理：自动保存失败时保留本地草稿并提供明确的错误状态/重试，不丢用户输入。

## Capabilities

### New Capabilities
- `task-editor-overlay-paper`: 在任务列表上下文中打开/关闭 Overlay Paper 的行为规范（selection vs open、键盘操作、背景锁定、焦点回退、底部栏可见）。
- `task-editor-auto-save`: 任务编辑全字段自动保存的行为规范（触发策略、节流/去抖、串行化、关闭时 flush、失败与恢复）。

### Modified Capabilities
<!-- openspec/specs/ 当前为空；本变更不修改既有 capability 的需求契约。 -->

## Impact

- Renderer UI/交互：`src/app/AppShell.tsx`（移除三栏常驻 Detail，改为 Overlay 容器）、`src/features/tasks/TaskList.tsx` 与 `src/features/tasks/UpcomingGroupedList.tsx`（Enter 打开、click 仅 select）、`src/pages/SearchPage.tsx` / `src/app/CommandPalette.tsx`（选择/打开语义对齐）。
- Task 编辑组件：`src/features/tasks/TaskDetailPanel.tsx` 将从“右栏面板”演进为可复用的 Overlay Paper 编辑器（UI 外观/布局变化），并实现自动保存状态机。
- 样式：`src/index.css`（移除/弱化 `.detail` 三栏样式，引入 Overlay Paper + 背景遮罩 + 动画/层级样式）。
- API/IPC：预计不新增 IPC；复用 `window.api.task.getDetail` / `window.api.task.update` / `window.api.task.setTags` / checklist APIs。
- 风险：自动保存与现有 `revision/bumpRevision` 刷新机制可能冲突（避免保存导致 refetch 覆盖草稿）；需在设计中明确“编辑态本地为准”的数据流。
