# task-bucket-flags Specification

## Purpose
TBD - created by archiving change remove-base-list. Update Purpose after archive.
## Requirements
### Requirement: Tasks use explicit bucket flags instead of base_list
任务 MUST 不再持久化 `base_list`。

任务 MUST 使用以下字段表达基础归属：
- `is_inbox: boolean`
- `is_someday: boolean`

系统 MUST 保持不变量：
- `is_someday=true` 时 `scheduled_at` MUST 为 null
- `scheduled_at` 非空时 `is_someday` MUST 为 false
- `is_inbox=true` 时 `project_id` MUST 为 null，且 `scheduled_at` MUST 为 null，且 `is_someday` MUST 为 false

#### Scenario: base_list is not part of task model
- **WHEN** 系统读取/写入 Task 记录（DB/IPC/export）
- **THEN** Task 数据结构不包含 `base_list`
- **THEN** Task 使用 `is_inbox` / `is_someday` 表达基础归属

### Requirement: Creating tasks sets bucket flags based on current view
系统 MUST 按当前视图（route）设置新建任务的默认归属：

- 在 `/inbox` 视图创建任务时：`is_inbox` MUST 为 true
- 在 `/someday` 视图创建任务时：`is_someday` MUST 为 true
- 在其他视图创建任务时：`is_inbox` MUST 为 false 且 `is_someday` MUST 为 false

#### Scenario: Create in Inbox defaults to inbox
- **WHEN** 用户在 `/inbox` 视图创建任务
- **THEN** 新任务的 `is_inbox` 为 true
- **THEN** 新任务的 `is_someday` 为 false

#### Scenario: Create in Someday defaults to someday
- **WHEN** 用户在 `/someday` 视图创建任务
- **THEN** 新任务的 `is_someday` 为 true
- **THEN** 新任务的 `scheduled_at` 为 null

#### Scenario: Create elsewhere is not inbox or someday
- **WHEN** 用户在非 `/inbox`、非 `/someday` 的视图创建任务
- **THEN** 新任务的 `is_inbox` 为 false
- **THEN** 新任务的 `is_someday` 为 false

### Requirement: Inbox flag is cleared when task becomes scheduled, someday, or assigned to a project
当任务被赋予更明确的计划/归属时，系统 MUST 自动将其移出 Inbox：

- 当 `project_id` 从 null 变为非 null 时，系统 MUST 将 `is_inbox` 设为 false
- 当 `scheduled_at` 从 null 变为非 null 时，系统 MUST 将 `is_inbox` 设为 false
- 当 `is_someday` 被设置为 true 时，系统 MUST 将 `is_inbox` 设为 false

#### Scenario: Setting project clears inbox
- **WHEN** 任务的 `project_id` 被设置为非 null
- **THEN** 系统将该任务的 `is_inbox` 设为 false

#### Scenario: Setting scheduled date clears inbox
- **WHEN** 任务的 `scheduled_at` 被设置为非 null
- **THEN** 系统将该任务的 `is_inbox` 设为 false

#### Scenario: Setting someday clears inbox
- **WHEN** 任务的 `is_someday` 被设置为 true
- **THEN** 系统将该任务的 `is_inbox` 设为 false

### Requirement: Anytime is a derived view and allows project tasks
Anytime 视图 MUST 是派生筛选，而不是任务的持久化归属字段。

Anytime 列表 MUST 展示满足以下条件的 open tasks：
- `scheduled_at` 为 null
- `is_inbox` 为 false
- `is_someday` 为 false

Anytime 列表 MUST 允许 `project_id` 非 null（项目任务可出现在 Anytime）。

#### Scenario: Project task can appear in Anytime when unscheduled
- **WHEN** 存在 open task 且 `project_id` 非 null
- **WHEN** 且该任务 `scheduled_at` 为 null
- **WHEN** 且 `is_inbox=false` 且 `is_someday=false`
- **THEN** 该任务出现在 Anytime 列表中

### Requirement: Someday is edited via Schedule control and occupies schedule display slot
系统 MUST 将 Someday 作为一种 schedule 状态，由 Schedule 控件编辑，并占用与日期排期相同的展示位。

Schedule 状态 MUST 支持三态：
- None：`scheduled_at=null` 且 `is_someday=false`
- Date：`scheduled_at=<date>` 且 `is_someday=false`
- Someday：`scheduled_at=null` 且 `is_someday=true`

#### Scenario: Choose Someday clears scheduled_at
- **WHEN** 用户在 Schedule 控件中选择 Someday
- **THEN** 系统将 `is_someday` 设为 true
- **THEN** 系统将 `scheduled_at` 设为 null

#### Scenario: Choose date clears Someday
- **WHEN** 用户在 Schedule 控件中选择某个日期
- **THEN** 系统将 `scheduled_at` 设为该日期
- **THEN** 系统将 `is_someday` 设为 false

### Requirement: Command Palette navigation prefers Project over Anytime
当任务同时满足“属于项目”与“可出现在 Anytime”时，Command Palette 的默认跳转 MUST 优先进入 Project。

#### Scenario: Jump prefers project when project_id exists
- **WHEN** 用户在 Command Palette 中选择某条任务
- **WHEN** 且该任务 `project_id` 非 null
- **THEN** 系统默认导航到该 Project 页面（优先于 Anytime）

