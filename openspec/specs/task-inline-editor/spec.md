# task-inline-editor Specification

## Purpose
TBD - created by archiving change inline-task-editor-row-expand. Update Purpose after archive.
## Requirements
### Requirement: Inline editor expands under the task row
任务编辑器 MUST 以“行内展开”的方式呈现，但展开态 MUST 属于同一条任务条目（task row）本身：打开编辑后，该 task row 自身变为编辑器容器并增高，而不是在其下方插入一条独立的 editor row。

展开态的第一行（header）MUST 呈现为 row-like：在同一行内同时提供 done toggle 与标题输入框；标题输入框 MUST 与任务列表的标题区域对齐，视觉上保持“原 row 展开的样子”。

展开态 MUST 提供轻微的“聚焦卡片”视觉反馈：编辑器容器 MUST 具有可见边框与轻微阴影，并且在该任务与相邻任务行之间 MUST 留出上下空间，以便用户清晰识别当前正在编辑的条目。

#### Scenario: Open expands inline within the task row
- **WHEN** 用户对某条任务触发“打开编辑”（例如 Return 或双击）
- **THEN** 该任务在列表中原地展开编辑器，展开后的编辑内容位于同一条 task row 内（该 row 变高）
- **THEN** 第一行 header 包含 done toggle 与标题输入框，且标题输入框与原任务行标题区域对齐
- **THEN** 标题输入框获得焦点
- **THEN** 展开过程不打开新的 modal/overlay

#### Scenario: Expanded editor does not require a separate editor row
- **WHEN** 用户打开某条任务的行内编辑器
- **THEN** 渲染结构中 MUST NOT 依赖“额外插入一条 editor row（单独列表项）”来呈现编辑内容
- **THEN** 展开态 MUST 呈现轻微聚焦卡片（可见边框 + 轻微阴影 + 上下留白），但其视觉层级 MUST 仍被理解为“该 task row 的展开态”，而不是独立的第二层弹层/模态

### Requirement: Notes are borderless and visually part of the title block
展开态的 Notes 输入 MUST 无边框、无底色，视觉上与标题区域属于同一个内容块；Notes placeholder MUST 显示为“备注”，且以提示色呈现。

#### Scenario: Notes looks like inline text
- **WHEN** 任务展开编辑器
- **THEN** Notes 区域没有明显边框/输入框背景
- **THEN** Notes placeholder 显示“备注”且与正文可区分（提示色）

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

### Requirement: Checklist button focuses add-item input
当 checklist 为空且用户点击 `Checklist` 按钮时，系统 MUST 创建一条空 checklist 行并立即进入编辑状态。

系统 MUST 将焦点置于该新行的标题输入框，且 MUST NOT 依赖独立的“新增输入区域”。

#### Scenario: Click Checklist creates and focuses first checklist row
- **WHEN** 任务展开且 checklist 为空
- **WHEN** 用户点击 `Checklist` 按钮
- **THEN** 系统创建一条空 checklist 行并显示标题输入框
- **THEN** 焦点移动到该行标题输入框
- **THEN** UI 不显示独立的 checklist 新增输入框

### Requirement: Checklist section collapses when it becomes empty
当 checklist 的最后一项被删除后，系统 MUST 自动收起 checklist 区域，并重新显示 `Checklist` 按钮作为再次新增入口。

#### Scenario: Clearing and submitting the last item collapses checklist
- **WHEN** 任务展开且 checklist 仅剩最后一项
- **WHEN** 用户将该项标题清空并提交（`Enter` 或失焦）
- **THEN** 系统删除该 checklist 项
- **THEN** checklist 区域被自动收起
- **THEN** Action Bar 重新显示 `Checklist` 按钮

### Requirement: Virtualized list supports dynamic editor height without overlap
在虚拟滚动列表中，展开态 editor 的高度变化（例如输入 notes、增删 checklist 项）MUST 不导致列表项重叠或错位；滚动与键盘导航 MUST 仍保持可用。

#### Scenario: Expanding and editing does not break list layout
- **WHEN** 用户在虚拟滚动列表中展开某任务并持续编辑（导致 editor 高度变化）
- **THEN** 列表其他任务条目不会与 editor 重叠
- **THEN** 用户仍可滚动列表并保持选择/焦点行为正常

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

### Requirement: Checklist rows are edited inline without separate add or delete controls
行内编辑器中的 checklist MUST 采用“每行可编辑”的结构：每项包含完成勾选与标题输入框。

系统 MUST NOT 渲染独立的 `Add` 输入框、`Add` 按钮或显式 `Delete` 按钮；标题编辑 MUST NOT 通过 `prompt` 弹窗完成。

#### Scenario: Checklist renders row-level inputs only
- **WHEN** 用户打开任务行内编辑器并查看 checklist
- **THEN** 每个 checklist 项以行内输入框形式可直接编辑标题
- **THEN** UI 不显示 `Add` 按钮与 `Delete` 按钮
- **THEN** 标题编辑不会触发浏览器 `prompt`

### Requirement: Enter submits current checklist row and creates next row
在 checklist 标题输入框中按下 `Enter`（非输入法组合态）时，系统 MUST 提交当前行，并在其后创建下一条空行继续编辑。

#### Scenario: Enter on non-empty row creates next editable row
- **WHEN** 用户正在编辑一个非空 checklist 项标题
- **WHEN** 用户按下 `Enter`
- **THEN** 系统持久化当前行变更
- **THEN** 系统在其后创建一条空 checklist 行
- **THEN** 焦点移动到新行标题输入框

#### Scenario: Enter during IME composition does not submit
- **WHEN** 用户正在使用输入法组合输入 checklist 标题
- **WHEN** 用户按下 `Enter` 用于候选确认
- **THEN** 系统不会提交当前 checklist 行
- **THEN** 系统不会创建下一条 checklist 行

### Requirement: Submitting an empty checklist title removes that row
当 checklist 标题在提交时为空时，系统 MUST 视为删除该行。

对已持久化项，系统 MUST 调用删除语义并从列表移除；对仅本地临时项，系统 MUST 直接丢弃且 MUST NOT 创建空标题持久化记录。

#### Scenario: Submit empty title deletes persisted row
- **WHEN** 某 checklist 项已存在于持久化数据中
- **WHEN** 用户将其标题清空并提交（`Enter` 或失焦）
- **THEN** 系统删除该 checklist 项并从 UI 移除

#### Scenario: Submit empty title discards temporary row
- **WHEN** 某 checklist 行为未持久化的临时空行
- **WHEN** 用户提交空标题（`Enter` 或失焦）
- **THEN** 系统直接移除该临时行
- **THEN** 系统不会产生新的空标题 checklist 记录

