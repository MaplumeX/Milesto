## MODIFIED Requirements

### Requirement: Inline editor expands under the task row
任务编辑器 MUST 以“行内展开”的方式呈现，但展开态 MUST 属于同一条任务条目（task row）本身：打开编辑后，该 task row 自身变为编辑器容器并增高，而不是在其下方插入一条独立的 editor row。

展开态的第一行（header）MUST 呈现为 row-like：在同一行内同时提供 done toggle 与标题输入框；标题输入框 MUST 与任务列表的标题区域对齐，视觉上保持“原 row 展开的样子”。

#### Scenario: Open expands inline within the task row
- **WHEN** 用户对某条任务触发“打开编辑”（例如 Return 或双击）
- **THEN** 该任务在列表中原地展开编辑器，展开后的编辑内容位于同一条 task row 内（该 row 变高）
- **THEN** 第一行 header 包含 done toggle 与标题输入框，且标题输入框与原任务行标题区域对齐
- **THEN** 标题输入框获得焦点
- **THEN** 展开过程不打开新的 modal/overlay

#### Scenario: Expanded editor does not require a separate editor row
- **WHEN** 用户打开某条任务的行内编辑器
- **THEN** 渲染结构中 MUST NOT 依赖“额外插入一条 editor row（单独列表项）”来呈现编辑内容
- **THEN** 展开态的视觉层级 MUST 与 task row 融合（不出现第二层卡片/纸张容器感）

### Requirement: Action bar shows Schedule/Tags/Due and conditional Checklist add
展开态底部右侧 MUST 提供精简 Action Bar 按钮组：`Tags` 按钮常驻；`Schedule` 与 `Due` 按钮 MUST 仅在对应字段当前为空时显示，作为“添加入口”。

`Checklist` 按钮 MUST 仅在该任务当前没有任何 checklist 项时显示，并作为“最快新增 checklist”的入口。

同时，展开态底部左侧 MUST 提供摘要 chips 区域，用于展示当前已有的 `Scheduled`/`Due`/`Tags` 值（详见 ADDED Requirements）。

#### Scenario: Schedule and Due buttons hide when value exists
- **WHEN** 任务展开且 `scheduled_at` 有值
- **THEN** Action Bar 不显示 `Schedule` 按钮
- **WHEN** 任务展开且 `scheduled_at` 为空
- **THEN** Action Bar 显示 `Schedule` 按钮
- **WHEN** 任务展开且 `due_at` 有值
- **THEN** Action Bar 不显示 `Due` 按钮
- **WHEN** 任务展开且 `due_at` 为空
- **THEN** Action Bar 显示 `Due` 按钮

#### Scenario: Tags button is always visible
- **WHEN** 任务展开（无论 tags 是否为空）
- **THEN** Action Bar 显示 `Tags` 按钮

#### Scenario: Checklist button only appears when checklist is empty
- **WHEN** 任务展开且 checklist 项数量为 0
- **THEN** Action Bar 显示 `Checklist` 按钮
- **WHEN** checklist 项数量大于 0
- **THEN** Action Bar 不显示 `Checklist` 按钮

## ADDED Requirements

### Requirement: Footer summary chips show existing Schedule/Due/Tags and support clear
展开态底部左侧 MUST 显示摘要 chips，用于展示已有值：

- 当 `scheduled_at` 有值时，显示 `Scheduled` chip
- 当 `due_at` 有值时，显示 `Due` chip
- 当 tags 非空时，显示 `Tags` chip

每个 chip MUST 可点击以打开对应的 picker；每个 chip 右侧 MUST 提供 `×` 清除按钮。
点击 `×` MUST 清除对应值且 MUST NOT 打开 picker。

#### Scenario: Chip appears only when value exists
- **WHEN** 任务展开且 `scheduled_at` 为空
- **THEN** 不显示 `Scheduled` chip
- **WHEN** 任务展开且 `scheduled_at` 有值
- **THEN** 显示 `Scheduled` chip
- **WHEN** 任务展开且 `due_at` 为空
- **THEN** 不显示 `Due` chip
- **WHEN** 任务展开且 `due_at` 有值
- **THEN** 显示 `Due` chip
- **WHEN** 任务展开且 tags 为空
- **THEN** 不显示 `Tags` chip
- **WHEN** 任务展开且 tags 非空
- **THEN** 显示 `Tags` chip

#### Scenario: Chip click opens picker, close button clears without opening
- **WHEN** 用户点击 `Scheduled`/`Due`/`Tags` chip 的主体区域
- **THEN** 系统打开对应的 picker
- **WHEN** 用户点击 chip 右侧的 `×`
- **THEN** 系统清除该字段/集合的值
- **THEN** 系统不打开 picker

### Requirement: Schedule/Due/Tags are edited via pickers without expanding editor height
`Schedule` / `Due` / `Tags` 的编辑 MUST 通过 picker（popover 或原生 date picker）完成，MUST NOT 通过在编辑器内插入展开区块来提供选择 UI。

#### Scenario: Open picker does not expand the inline editor
- **WHEN** 任务展开
- **WHEN** 用户通过按钮或摘要 chip 打开 `Schedule`/`Due`/`Tags` picker
- **THEN** 行内编辑器的布局不会因为“展开选择区块”而发生额外增高
