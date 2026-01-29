# task-editor-overlay-paper Specification

## Purpose
TBD - created by archiving change task-editor-overlay-paper. Update Purpose after archive.
## Requirements
### Requirement: Selection does not open the editor
在任何任务列表视图中，单击任务项仅改变 selection（高亮/焦点），系统 MUST NOT 因 selection 变化而自动打开任务编辑器。

#### Scenario: Click selects without opening
- **WHEN** 用户单击某条任务（例如点击任务标题按钮）
- **THEN** 该任务成为当前选中项
- **THEN** 任务编辑 Overlay Paper 保持关闭

### Requirement: Overlay Paper opens from selection
系统 MUST 支持从当前选中任务“原地打开”任务编辑 Overlay Paper。

#### Scenario: Press Return to open
- **WHEN** 列表获得焦点且存在 `selectedTaskId`
- **WHEN** 用户按下 `Return`
- **THEN** 系统打开该任务的 Overlay Paper

### Requirement: Overlay Paper opens on double-click
系统 MUST 支持使用鼠标双击打开任务的 Overlay Paper。

#### Scenario: Double-click a task row
- **WHEN** 用户在任务行上双击（双击标题区域/行主体）
- **THEN** 系统打开该任务的 Overlay Paper

### Requirement: Overlay Paper locks background interaction
Overlay Paper 打开期间，背景列表与内容区背景 MUST 被锁定：用户不能滚动或点击背景内容来改变 selection 或触发其他动作。

#### Scenario: Background is non-interactive while open
- **WHEN** Overlay Paper 处于打开状态
- **THEN** 用户滚轮/触控板滚动不会滚动背景列表
- **THEN** 用户点击背景任务行不会改变 selection

### Requirement: Bottom bar remains visible
Overlay Paper 打开期间，内容区底部栏（bottom bar）MUST 保持可见。

#### Scenario: Bottom bar is not covered
- **WHEN** Overlay Paper 打开
- **THEN** 底部栏仍可见（不被 overlay 覆盖）

### Requirement: Close behavior and focus restoration
系统 MUST 支持通过键盘 `Escape` 或显式关闭按钮关闭 Overlay Paper，并在关闭后将键盘焦点恢复到触发打开的任务行（或其标题按钮）。

#### Scenario: Escape closes and restores focus
- **WHEN** Overlay Paper 打开且用户按下 `Escape`
- **THEN** Overlay Paper 关闭
- **THEN** 焦点回到先前触发打开的任务行（或其标题按钮）

### Requirement: Command Palette is disabled while overlay is open
Overlay Paper 打开期间，系统 MUST 禁用 `Cmd/Ctrl + K` 打开 Command Palette（避免双重 overlay 堆叠）。

#### Scenario: Cmd/Ctrl+K does not open command palette
- **WHEN** Overlay Paper 处于打开状态
- **WHEN** 用户按下 `Cmd/Ctrl + K`
- **THEN** Command Palette 不会打开

### Requirement: Scrim click does not close
Overlay Paper 的 scrim（遮罩层）MUST NOT 作为关闭手势（避免误触关闭导致编辑中断）。

#### Scenario: Click scrim does not close
- **WHEN** Overlay Paper 打开
- **WHEN** 用户点击 scrim 区域
- **THEN** Overlay Paper 仍保持打开

### Requirement: New task opens editor immediately
通过底部栏“+ Task”创建的新任务，系统 MUST 立即打开该任务的 Overlay Paper 并将焦点置于标题输入框。

#### Scenario: Create task then editor opens
- **WHEN** 用户点击底部栏“+ Task”创建任务
- **THEN** 系统打开新任务的 Overlay Paper
- **THEN** 标题输入框获得焦点

