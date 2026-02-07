## Why

当前任务与项目界面在多个位置持续展示保存状态和数字统计（open/done/total），信息密度偏高，会分散用户对当前编辑与执行动作的注意力。我们需要将界面信号精简为“默认安静、仅异常打断”，以降低认知负担并保持关键可靠性语义。

## What Changes

- 移除任务编辑器中的持续性保存状态文案（`Saving` / `Saved` / `Unsaved`），改为成功静默。
- 保留失败可见与恢复路径：保存失败时继续显示错误与 `Retry`，并保持关闭前 flush / 失败阻止关闭的语义。
- 移除任务与项目相关页面中的数字统计展示（含 `open` / `done` / `total` / `Completed N` / `Mark Done (N)` 等计数文案）。
- 调整相关自测断言，避免依赖已移除的保存状态与计数字符串。
- 更新受影响规范条款，使行为定义与新交互一致。

## Capabilities

### New Capabilities
- _None._

### Modified Capabilities
- `task-editor-auto-save`: 将“保存状态必须持续可见”调整为“成功静默、失败可见且可重试”，并保持防丢稿与 flush 语义不变。
- `project-page`: 移除项目页及项目分组任务区的数字统计展示；Completed 控件不再要求显示总数。

## Impact

- 受影响前端实现：
  - `src/features/tasks/TaskEditorPaper.tsx`
  - `src/pages/ProjectPage.tsx`
  - `src/features/tasks/TaskList.tsx`
  - `src/features/tasks/ProjectGroupedList.tsx`
  - `src/index.css`
- 受影响测试：`src/app/selfTest.ts`（保存状态与计数文案相关断言）。
- 受影响规范：
  - `openspec/specs/task-editor-auto-save/spec.md`
  - `openspec/specs/project-page/spec.md`
- IPC/数据库/外部 API 不变；主要为 UI 行为与规范层调整。
