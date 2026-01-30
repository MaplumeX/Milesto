## MODIFIED Requirements

### Requirement: Inline editor expands under the task row
任务编辑器 MUST 以“行内展开”的方式呈现，但展开态 MUST 属于同一条任务条目（task row）本身：打开编辑后，该 task row 自身变为编辑器容器并增高（标题为输入框），而不是在其下方插入一条独立的 editor row。

#### Scenario: Open expands inline within the task row
- **WHEN** 用户对某条任务触发“打开编辑”（例如 Return 或双击）
- **THEN** 该任务在列表中原地展开编辑器，展开后的编辑内容位于同一条 task row 内（该 row 变高）
- **THEN** 标题区域显示为标题输入框，并获得焦点
- **THEN** 展开过程不打开新的 modal/overlay

#### Scenario: Expanded editor does not require a separate editor row
- **WHEN** 用户打开某条任务的行内编辑器
- **THEN** 渲染结构中 MUST NOT 依赖“额外插入一条 editor row（单独列表项）”来呈现编辑内容
- **THEN** 展开态的视觉层级 MUST 与 task row 融合（不出现第二层卡片/纸张容器感）

## ADDED Requirements

### Requirement: Inline editor header includes done toggle
当任务处于行内展开编辑状态时，系统 MUST 在编辑器头部提供完成/未完成的切换控件（checkbox 或等价交互），用于切换该任务的 done/open 状态。

#### Scenario: Toggle done while editor remains open
- **WHEN** 任务处于行内展开状态
- **WHEN** 用户在编辑器头部切换完成状态
- **THEN** 系统持久化该状态变更
- **THEN** 行内编辑器保持展开（不自动收起）

### Requirement: Click selects without opening (still applies)
在任何任务列表视图中，单击任务项仅改变 selection（高亮/焦点），系统 MUST NOT 因 selection 变化而自动打开任务编辑器。

#### Scenario: Click selects without opening
- **WHEN** 用户单击某条任务（例如点击任务标题区域）
- **THEN** 该任务成为当前选中项
- **THEN** 行内任务编辑器保持收起（不展开）
