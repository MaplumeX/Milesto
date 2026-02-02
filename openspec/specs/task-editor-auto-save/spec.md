# task-editor-auto-save Specification

## Purpose
TBD - created by archiving change task-editor-overlay-paper. Update Purpose after archive.
## Requirements
### Requirement: Full-field auto-save
在任务编辑器中，任务编辑 MUST 对所有任务字段进行自动保存，包括但不限于：title、notes、is_inbox、is_someday、project_id、section_id、area_id、scheduled_at、due_at。

#### Scenario: Edit a field and it is persisted
- **WHEN** 用户在任务编辑器中修改任意任务字段
- **THEN** 系统在无需显式点击 Save 的情况下，将变更持久化到数据库

### Requirement: Debounced and serialized saving
系统 MUST 使用去抖与串行化保存来避免写放大与乱序：任意时刻最多允许一个保存请求 in-flight；若保存中又发生编辑，系统 MUST 在当前保存完成后用最新快照继续保存。

#### Scenario: Rapid edits do not spawn concurrent saves
- **WHEN** 用户快速连续修改多个字段
- **THEN** 系统不会并发发起多个保存请求
- **THEN** 最终数据库状态与用户最后一次输入一致

### Requirement: Save state is visible
任务编辑器 MUST 向用户展示保存状态（例如 Saving / Saved / Error），并在保存失败时明确告知。

#### Scenario: User sees saving feedback
- **WHEN** 系统正在执行自动保存
- **THEN** UI 显示“Saving”（或等价状态）
- **THEN** 保存成功后 UI 显示“Saved”（或等价状态）

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

### Requirement: Failed auto-save never discards user input
任何自动保存失败（包括 API/IPC/DB 错误）都 MUST NOT 丢弃用户当前编辑内容；系统 MUST 保留本地草稿，并提供重试路径。

#### Scenario: Error keeps draft and allows retry
- **WHEN** 自动保存失败
- **THEN** 用户已输入的内容仍然保留在编辑器中
- **THEN** UI 显示错误状态并允许重试

### Requirement: Editor draft is not overwritten during an open session
在任务编辑器处于打开（展开）状态期间，系统 MUST NOT 因全局刷新信号（例如 revision/bumpRevision）而用远端/数据库数据覆盖本地 `draft`。

#### Scenario: External refresh does not clobber draft
- **WHEN** 任务编辑器处于打开状态且用户正在编辑（存在本地 draft）
- **WHEN** 应用发生其他操作触发全局刷新信号
- **THEN** 编辑器不会用 refetch 的结果覆盖当前 draft

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

### Requirement: Title Return close is treated as a close gesture and must flush
当标题输入框聚焦时，`Enter/Return` MUST 被视为一种收起手势（关闭编辑器），并遵循相同的 flush 语义。

#### Scenario: Return on title closes after flush
- **WHEN** 标题输入框聚焦
- **WHEN** 用户按下 `Enter/Return`
- **THEN** 系统先执行 flush 保存（包含字段草稿与 tags）
- **THEN** flush 成功后收起编辑器；若失败则阻止收起

