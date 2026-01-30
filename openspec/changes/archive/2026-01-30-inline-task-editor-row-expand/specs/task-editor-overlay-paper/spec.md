# task-editor-overlay-paper Specification

## MODIFIED Requirements

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
系统 MUST 支持通过键盘 `Escape` 或显式关闭手势收起行内编辑器，并在收起后将键盘焦点恢复到触发打开的任务行（或其标题按钮）。

#### Scenario: Escape closes and restores focus
- **WHEN** 行内编辑器处于展开状态且用户按下 `Escape`
- **THEN** 行内编辑器收起
- **THEN** 焦点回到先前触发打开的任务行（或其标题按钮）

### Requirement: New task opens editor immediately
通过底部栏“+ Task”创建的新任务，系统 MUST 立即展开该任务的行内编辑器并将焦点置于标题输入框。

#### Scenario: Create task then editor opens
- **WHEN** 用户点击底部栏“+ Task”创建任务
- **THEN** 系统展开新任务的行内编辑器
- **THEN** 标题输入框获得焦点

## REMOVED Requirements

### Requirement: Overlay Paper locks background interaction
**Reason**: 任务编辑器不再以遮罩浮层呈现；行内展开编辑期间，列表滚动与背景交互不再被整体锁定。
**Migration**: 使用行内展开编辑；不再依赖 `.content-scroll.is-locked` 或等价的背景锁定机制。

#### Scenario: Background remains interactive during inline editing
- **WHEN** 行内编辑器处于展开状态
- **THEN** 用户仍可滚动列表
- **THEN** 用户仍可改变 selection（但系统 MUST NOT 因 selection 变化而自动切换展开项）

### Requirement: Bottom bar remains visible
**Reason**: 行内展开不再覆盖内容区；底部栏不再存在“被 overlay 覆盖”的问题域。
**Migration**: 行内展开编辑器 MUST 不遮挡底部栏（自然满足）。

#### Scenario: Bottom bar remains visible during inline editing
- **WHEN** 行内编辑器处于展开状态
- **THEN** 内容区底部栏保持可见

### Requirement: Command Palette is disabled while overlay is open
**Reason**: 行内展开不再引入 modal/overlay 堆叠风险；禁用命令面板会降低键盘优先体验。
**Migration**: 行内展开编辑期间，`Cmd/Ctrl + K` 行为不应被全局禁用（若存在冲突，应由焦点/事件处理局部解决）。

#### Scenario: Cmd/Ctrl+K remains available
- **WHEN** 行内编辑器处于展开状态
- **WHEN** 用户按下 `Cmd/Ctrl + K`
- **THEN** 系统允许打开 Command Palette（或执行其等价行为）

### Requirement: Scrim click does not close
**Reason**: 行内展开不再使用 scrim（遮罩层）。
**Migration**: 移除 scrim 点击相关行为；收起手势以键盘/显式关闭为主。

#### Scenario: No scrim exists in inline mode
- **WHEN** 行内编辑器处于展开状态
- **THEN** UI 不存在 scrim 区域可供点击
