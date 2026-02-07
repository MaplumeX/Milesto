## ADDED Requirements

### Requirement: Tags picker allows quick-create of new tags
当用户打开行内编辑器的 `Tags` picker 时，picker 面板顶部 MUST 显示一个用于创建新 tag 的输入框。

该输入框的行为 MUST 满足：

- 输入框仅用于创建：不做 tag 列表过滤/搜索；下方 tags 复选列表仍然完整可见。
- 当用户在输入框内按下 `Enter` 时：
  - 若输入内容为空（trim 后为空），系统 MUST 不执行创建。
  - 若已存在同名 tag（trim 后、大小写不敏感匹配），系统 MUST 不创建重复 tag，而是直接选中该 tag。
  - 否则系统 MUST 创建新 tag，并在创建成功后自动将其设为已选中。

#### Scenario: Tags picker shows create input
- **WHEN** 任务处于行内展开状态
- **WHEN** 用户打开 `Tags` picker
- **THEN** picker 面板顶部显示创建输入框
- **THEN** 下方仍显示 tags 复选列表（不因输入而过滤）

#### Scenario: Enter creates and selects a new tag
- **WHEN** 用户打开 `Tags` picker
- **WHEN** 用户在创建输入框中输入一个不存在的 tag 标题并按下 `Enter`
- **THEN** 系统创建该 tag
- **THEN** 系统自动将新 tag 选中（勾选）

#### Scenario: Enter selects existing tag instead of creating duplicate
- **WHEN** 用户打开 `Tags` picker
- **WHEN** 已存在标题为 "Work" 的 tag
- **WHEN** 用户在创建输入框中输入 " work " 并按下 `Enter`
- **THEN** 系统不创建新的 tag
- **THEN** 系统将标题为 "Work" 的 tag 设为已选中

## MODIFIED Requirements

### Requirement: Schedule/Due/Tags are edited via pickers without expanding editor height
`Schedule` / `Due` / `Tags` 的编辑 MUST 通过 floating picker 完成，MUST NOT 通过在编辑器内插入展开区块来提供选择 UI，从而避免行内编辑器高度因临时选择器而抖动。

其中：

- `Schedule` 与 `Due` picker MUST 在同一个 popover 面板内直接呈现可点击的日历（嵌入式 calendar），MUST NOT 依赖原生 `input[type="date"]` 的系统日期选择面板（避免“面板套日历面板”）。
- 日历的周起始 MUST 为周一。

Schedule picker MUST 支持设置 Someday 这一状态，并保持与 `scheduled_at` 互斥。

#### Scenario: Open picker does not expand the inline editor
- **WHEN** 任务展开
- **WHEN** 用户通过按钮或摘要 chip 打开 `Schedule`/`Due`/`Tags` picker
- **THEN** 行内编辑器的布局不会因为“展开选择区块”而发生额外增高

#### Scenario: Schedule picker shows embedded calendar and actions in one panel
- **WHEN** 用户打开 `Schedule` picker
- **THEN** popover 面板内可见嵌入式日历
- **THEN** popover 面板内可见 `Someday` / `Today` / `Clear` 操作按钮
- **THEN** 用户无需打开系统日期选择面板即可完成日期选择

#### Scenario: Due picker shows embedded calendar in one panel
- **WHEN** 用户打开 `Due` picker
- **THEN** popover 面板内可见嵌入式日历
- **THEN** 用户无需打开系统日期选择面板即可完成日期选择

#### Scenario: Calendar week starts on Monday
- **WHEN** 用户打开 `Schedule` 或 `Due` picker
- **THEN** 日历的第一列为周一
