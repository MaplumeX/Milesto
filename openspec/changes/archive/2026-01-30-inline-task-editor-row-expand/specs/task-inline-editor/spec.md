# task-inline-editor Specification

## ADDED Requirements

### Requirement: Inline editor expands under the task row
任务编辑器 MUST 以“行内展开”的方式呈现：任务条目（task row）作为标题区域保留在列表中，编辑器内容区域在该任务条目下方展开。

#### Scenario: Open expands inline under the selected task
- **WHEN** 用户对某条任务触发“打开编辑”（例如 Return 或双击）
- **THEN** 该任务在列表中原地展开编辑器
- **THEN** 展开内容显示在该任务条目下方，而不是打开新的 modal/overlay

### Requirement: Notes are borderless and visually part of the title block
展开态的 Notes 输入 MUST 无边框、无底色，视觉上与标题区域属于同一个内容块；Notes placeholder MUST 显示为“备注”，且以提示色呈现。

#### Scenario: Notes looks like inline text
- **WHEN** 任务展开编辑器
- **THEN** Notes 区域没有明显边框/输入框背景
- **THEN** Notes placeholder 显示“备注”且与正文可区分（提示色）

### Requirement: Action bar shows Schedule/Tags/Due and conditional Checklist add
展开态右下角 MUST 显示精简 Action Bar：`Schedule`、`Tags`、`Due` 三个按钮常驻。

`Checklist` 按钮 MUST 仅在该任务当前没有任何 checklist 项时显示，并作为“最快新增 checklist”的入口。

#### Scenario: Checklist button only appears when checklist is empty
- **WHEN** 任务展开且 checklist 项数量为 0
- **THEN** Action Bar 显示 `Checklist` 按钮
- **WHEN** checklist 项数量大于 0
- **THEN** Action Bar 不显示 `Checklist` 按钮

### Requirement: Checklist button focuses add-item input
当 checklist 为空且用户点击 `Checklist` 按钮时，系统 MUST 展示 checklist 的新增输入区域，并将焦点置于“新增 checklist item”的输入框。

#### Scenario: Click Checklist focuses add input
- **WHEN** 任务展开且 checklist 为空
- **WHEN** 用户点击 `Checklist` 按钮
- **THEN** UI 展示 checklist 新增输入区域
- **THEN** 焦点移动到“Add checklist item…”输入框

### Requirement: Checklist section collapses when it becomes empty
当用户删除最后一个 checklist 项后，系统 MUST 自动收起 checklist 区域，并重新显示 `Checklist` 按钮（作为再次新增入口）。

#### Scenario: Delete last checklist item collapses checklist
- **WHEN** 任务展开且 checklist 仅剩最后一项
- **WHEN** 用户删除该项
- **THEN** checklist 区域被自动收起
- **THEN** Action Bar 重新显示 `Checklist` 按钮

### Requirement: Virtualized list supports dynamic editor height without overlap
在虚拟滚动列表中，展开态 editor 的高度变化（例如输入 notes、增删 checklist 项）MUST 不导致列表项重叠或错位；滚动与键盘导航 MUST 仍保持可用。

#### Scenario: Expanding and editing does not break list layout
- **WHEN** 用户在虚拟滚动列表中展开某任务并持续编辑（导致 editor 高度变化）
- **THEN** 列表其他任务条目不会与 editor 重叠
- **THEN** 用户仍可滚动列表并保持选择/焦点行为正常
