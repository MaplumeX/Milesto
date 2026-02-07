## Why

当前任务编辑器的 Checklist 交互仍是“独立新增输入框 + Add 按钮 + Delete 按钮 + prompt 重命名”，会打断键盘连续编辑流，也让 inline 与 overlay 的使用心智不一致。

我们需要把 Checklist 调整为统一的行内编辑模型：点击即可创建空项并直接编辑，Enter 连续创建下一项，清空标题即可删除，降低操作摩擦并提升批量整理效率。

## What Changes

- 将 `TaskEditorPaper` 中的 Checklist 统一为“每行可编辑 input”的交互模型（inline + overlay 共用）。
- 空 Checklist 时点击 Action Bar 的 `Checklist` 按钮，创建一条空 checklist 行并立即进入编辑状态。
- 在 checklist 行内按 `Enter`：提交当前行，并在其后创建下一条空行继续编辑。
- 当 checklist 标题提交为空时：已持久化项执行删除；临时空项直接丢弃。
- 移除独立的 checklist 新增输入框与 `Add` / `Delete` 按钮；不再使用 `prompt` 进行重命名。
- 保留现有 `window.api.checklist.create/update/delete` 与 schema 约束（`title` 非空），不新增 IPC 通道。
- 更新自测与 spec 文案，使其验证新的 Checklist 交互与焦点行为。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `task-inline-editor`: Checklist 入口、创建、编辑、删除与键盘行为从“独立新增控件/删除按钮”调整为“行内编辑流”。
- `task-editor-overlay-paper`: Overlay 中 Checklist 交互与 inline 对齐为同一行内编辑模型。

## Impact

- Renderer UI：主要影响 `src/features/tasks/TaskEditorPaper.tsx` 的 Checklist 组件及 inline/overlay 挂接逻辑，`src/index.css` 的 checklist 样式结构会同步调整。
- 自测与规格：`src/app/selfTest.ts` 与 `openspec/specs/task-inline-editor/spec.md` 中旧选择器/旧行为断言需要迁移。
- 数据与 API：不变更 DB schema、不变更 preload/main IPC 路由，继续使用 `checklist.create/update/delete`。
- 风险点：键盘事件冒泡冲突、输入法组合键（IME）下 Enter 误触发、删除后焦点恢复与虚拟列表高度稳定性。
