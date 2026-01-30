## Why

当前任务编辑通过 Overlay Paper（遮罩层 + 浮层）完成，编辑时需要打断列表上下文并锁定背景交互。这在批量整理/快速扫一遍任务时节奏偏重，且与 Things 3 这类“原地展开编辑”的心智模型不一致。

我们希望把“编辑”拉回到列表现场：点击/回车后任务在原地展开，标题仍属于该任务条目，下面自然延伸出备注与检查事项，降低切换成本，提升连续编辑效率。

## What Changes

- 在任务列表中，任务编辑从“打开 Overlay Paper”调整为“任务条目原地展开（row expansion）”。
- 展开态布局与交互：标题行仍为任务条目本体；下方依次显示备注（无边框、与标题同字号/颜色，placeholder 为“备注”）与检查事项（Checklist）。
- 展开态右下角显示精简 Action Bar：`Schedule`、`Tags`、`Due` 三个按钮常驻；`Checklist` 仅在当前任务没有任何 checklist 项时显示，作为“最快新增 checklist”的入口（新增后隐藏；删到空则自动收起并重新出现）。
- 关闭语义从“关闭浮层”调整为“收起展开项”（不再使用 scrim/aria-modal 行为；不再锁定背景滚动）。

## Capabilities

### New Capabilities
- `task-inline-editor`: 在任务列表中提供 Things-like 的行内展开编辑体验（标题行 + 备注 + 检查事项 + 右下角精简动作按钮）。

### Modified Capabilities
- `task-editor-overlay-paper`: 任务编辑不再通过 Overlay Paper 呈现；打开/关闭/焦点恢复/背景锁定等需求随行内展开模型调整。
- `task-editor-auto-save`: 自动保存能力从“仅 Overlay Paper 内编辑”扩展为“任务编辑器（行内展开）”通用；保留去抖、串行化、flush、防丢稿等要求，但触发条件与 UI 呈现会随新形态更新。

## Impact

- Renderer UI：任务列表渲染与虚拟滚动需要支持可变高度的展开项；任务编辑器的呈现结构与样式需要适配行内布局。
- 状态与交互：`openTaskId`/selection 相关交互会从“打开浮层”迁移到“展开行”；Command Palette 的禁用策略也可能随 overlay 移除而调整。
- 受影响代码（预期）：`src/features/tasks/TaskList.tsx`、`src/features/tasks/UpcomingGroupedList.tsx`、`src/features/tasks/TaskEditorPaper.tsx`（或拆分出行内版）、`src/features/tasks/TaskEditorOverlayPaper.tsx`、`src/app/AppShell.tsx`、`src/index.css`。
