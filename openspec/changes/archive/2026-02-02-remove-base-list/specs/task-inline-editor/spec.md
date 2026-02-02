## MODIFIED Requirements

### Requirement: Action bar shows Schedule/Tags/Due and conditional Checklist add
展开态底部右侧 MUST 提供精简 Action Bar 按钮组：`Tags` 按钮常驻；`Schedule` 与 `Due` 按钮 MUST 仅在对应字段当前为空时显示，作为“添加入口”。

其中，Schedule 的“当前为空” MUST 按以下规则判断：
- `scheduled_at` 为空且 `is_someday=false` 时，Schedule 视为“为空”
- `scheduled_at` 有值或 `is_someday=true` 时，Schedule 视为“有值”

`Checklist` 按钮 MUST 仅在该任务当前没有任何 checklist 项时显示，并作为“最快新增 checklist”的入口。

同时，展开态底部左侧 MUST 提供摘要 chips 区域，用于展示当前已有的 `Scheduled`/`Due`/`Tags` 值（详见 ADDED Requirements）。

#### Scenario: Schedule and Due buttons hide when value exists
- **WHEN** 任务展开且（`scheduled_at` 有值或 `is_someday=true`）
- **THEN** Action Bar 不显示 `Schedule` 按钮
- **WHEN** 任务展开且（`scheduled_at` 为空且 `is_someday=false`）
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

### Requirement: Footer summary chips show existing Schedule/Due/Tags and support clear
展开态底部左侧 MUST 显示摘要 chips，用于展示已有值：

- 当（`scheduled_at` 有值或 `is_someday=true`）时，显示 `Scheduled` chip
- 当 `due_at` 有值时，显示 `Due` chip
- 当 tags 非空时，显示 `Tags` chip

当 `is_someday=true` 时，`Scheduled` chip 的展示文本 MUST 为 `Someday`（例如 `Scheduled: Someday`）。

每个 chip MUST 可点击以打开对应的 picker；每个 chip 右侧 MUST 提供 `×` 清除按钮。
点击 `×` MUST 清除对应值且 MUST NOT 打开 picker。

#### Scenario: Chip appears only when value exists
- **WHEN** 任务展开且（`scheduled_at` 为空且 `is_someday=false`）
- **THEN** 不显示 `Scheduled` chip
- **WHEN** 任务展开且（`scheduled_at` 有值或 `is_someday=true`）
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

#### Scenario: Clearing Scheduled chip clears date or Someday
- **WHEN** `Scheduled` chip 可见且 `scheduled_at` 有值
- **WHEN** 用户点击 `Scheduled` chip 的 `×`
- **THEN** 系统将 `scheduled_at` 清除为 null
- **WHEN** `Scheduled` chip 可见且 `is_someday=true`
- **WHEN** 用户点击 `Scheduled` chip 的 `×`
- **THEN** 系统将 `is_someday` 设为 false

### Requirement: Schedule/Due/Tags are edited via pickers without expanding editor height
`Schedule` / `Due` / `Tags` 的编辑 MUST 通过 picker（popover 或原生 date picker）完成，MUST NOT 通过在编辑器内插入展开区块来提供选择 UI。

Schedule picker MUST 支持设置 Someday 这一状态，并保持与 `scheduled_at` 互斥。

#### Scenario: Open picker does not expand the inline editor
- **WHEN** 任务展开
- **WHEN** 用户通过按钮或摘要 chip 打开 `Schedule`/`Due`/`Tags` picker
- **THEN** 行内编辑器的布局不会因为“展开选择区块”而发生额外增高
