# task-editor-overlay-paper Specification

## Purpose
TBD - created by archiving change task-editor-overlay-paper. Update Purpose after archive.
## Requirements
### Requirement: Selection does not open the editor
在任何任务列表视图中，单击任务项仅改变 selection（高亮/焦点），系统 MUST NOT 因 selection 变化而自动打开任务编辑器。

#### Scenario: Click selects without opening
- **WHEN** 用户单击某条任务（例如点击任务标题按钮）
- **THEN** 该任务成为当前选中项
- **THEN** 行内任务编辑器保持收起（不展开）

### Requirement: Overlay Paper opens from selection
系统 MUST 支持从当前选中任务“原地打开”任务编辑器（行内展开）。

#### Scenario: Press Return to open
- **WHEN** 列表获得焦点且存在 `selectedTaskId`
- **WHEN** 用户按下 `Return`
- **THEN** 系统打开该任务的行内编辑器（在列表中原地展开）

### Requirement: Overlay Paper opens on double-click
系统 MUST 支持使用鼠标双击打开任务编辑器（行内展开）。

#### Scenario: Double-click a task row
- **WHEN** 用户在任务行上双击（双击标题区域/行主体）
- **THEN** 系统打开该任务的行内编辑器（在列表中原地展开）

### Requirement: Close behavior and focus restoration
系统 MUST 支持通过键盘 `Escape` 或关闭手势收起行内编辑器，并在收起后将键盘焦点恢复到触发打开的任务行（或其标题按钮）。

系统 MUST 支持以下关闭手势：

- `Escape`
- `Cmd/Ctrl+Enter`
- 标题输入框聚焦时的 `Enter/Return`
- 点击编辑器外区域（click-away）

系统 MUST NOT 依赖显式 `Collapse`/`Close` 按钮作为唯一关闭路径。

#### Scenario: Escape closes and restores focus
- **WHEN** 行内编辑器处于展开状态且用户按下 `Escape`
- **THEN** 行内编辑器收起
- **THEN** 焦点回到先前触发打开的任务行（或其标题按钮）

#### Scenario: Click-away closes and restores focus
- **WHEN** 行内编辑器处于展开状态
- **WHEN** 用户点击编辑器外区域
- **THEN** 系统尝试收起行内编辑器（遵循 flush 语义）
- **THEN** 收起成功后焦点回到先前触发打开的任务行（或其标题按钮）

### Requirement: New task opens editor immediately
通过底部栏“+ Task”创建的新任务，系统 MUST 立即展开该任务的行内编辑器并将焦点置于标题输入框。

#### Scenario: Create task then editor opens
- **WHEN** 用户点击底部栏“+ Task”创建任务
- **THEN** 系统展开新任务的行内编辑器
- **THEN** 标题输入框获得焦点

### Requirement: Click-away closes pickers before attempting to close the editor
当行内编辑器存在浮层 picker（例如 Tags/Schedule/Due）打开时，click-away MUST 优先关闭 picker，而不是直接关闭编辑器。

#### Scenario: Click-away first closes picker
- **WHEN** 行内编辑器展开且某个 picker 处于打开状态
- **WHEN** 用户点击编辑器外区域
- **THEN** 系统关闭 picker
- **THEN** 行内编辑器保持展开

