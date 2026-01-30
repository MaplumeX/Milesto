## MODIFIED Requirements

### Requirement: Close flushes pending changes
用户收起任务编辑器（Esc/关闭手势/Cmd+Return 或等价操作）时，系统 MUST flush 所有未持久化的变更，包括：

- 任务字段草稿（title/notes/日期等）的去抖保存
- tags 选择的持久化（例如 setTags）

若 flush 成功，允许收起；若 flush 失败，系统 MUST 阻止收起并保留编辑器展开，以避免丢失输入/状态。

#### Scenario: Close waits for pending save
- **WHEN** 用户在有未保存变更时尝试收起任务编辑器
- **THEN** 系统先执行 flush 保存（包含字段草稿与 tags）
- **THEN** flush 成功后才允许收起任务编辑器

#### Scenario: Flush failure blocks close and preserves user state
- **WHEN** 用户尝试收起任务编辑器
- **WHEN** flush 失败（包括 task.update 或 tags 持久化失败）
- **THEN** 系统阻止收起并保持编辑器展开
- **THEN** 用户已输入的草稿与当前 tags 选择状态仍被保留

### Requirement: Tags and checklist updates integrate with auto-save
在任务编辑器中对 tags 与 checklist 的修改 MUST 被持久化并反映在 UI 中，且这些操作 MUST NOT 破坏当前任务字段的编辑草稿。

当用户尝试收起编辑器或切换到另一任务时，若存在 tags 持久化请求 in-flight，系统 MUST 等待其完成；若其失败，系统 MUST 阻止收起/切换。

#### Scenario: Tag and checklist changes do not reset fields
- **WHEN** 用户在任务编辑器中切换 tag 或编辑 checklist
- **THEN** 修改被持久化
- **THEN** 当前 title/notes/日期等字段的编辑内容不被重置

#### Scenario: Switching tasks waits for tags persistence
- **WHEN** 用户在任务编辑器中更改 tags（触发持久化）
- **WHEN** 用户尝试切换打开另一条任务
- **THEN** 系统在切换前等待 tags 持久化完成
- **THEN** 若持久化失败，系统阻止切换并保持当前编辑器展开

## ADDED Requirements

### Requirement: Title Return close is treated as a close gesture and must flush
当标题输入框聚焦时，`Enter/Return` MUST 被视为一种收起手势（关闭编辑器），并遵循相同的 flush 语义。

#### Scenario: Return on title closes after flush
- **WHEN** 标题输入框聚焦
- **WHEN** 用户按下 `Enter/Return`
- **THEN** 系统先执行 flush 保存（包含字段草稿与 tags）
- **THEN** flush 成功后收起编辑器；若失败则阻止收起
