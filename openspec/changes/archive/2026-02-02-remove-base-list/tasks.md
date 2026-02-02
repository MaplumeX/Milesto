## 1. Shared Schemas & Types

- [x] 1.1 删除 `BaseListSchema`，并从 shared schemas 中移除所有 `base_list` 字段（Task/TaskListItem/相关输入 schema）。
- [x] 1.2 为 Task/TaskListItem 增加 `is_inbox` / `is_someday` 字段，并在 Zod schema 中约束其类型与默认值策略。
- [x] 1.3 更新 `shared/window-api.ts`：移除 `task.listBase(baseList)`，新增 `task.listInbox()` / `task.listAnytime()` / `task.listSomeday()` 的类型签名。


## 2. DB Schema (SQLite)

- [x] 2.1 更新 `tasks` 表结构：删除 `base_list` 列，新增 `is_inbox`、`is_someday` 两列（INTEGER/BOOLEAN 语义）及默认值。
- [x] 2.2 添加/更新 DB 约束（CHECK）：
  - `is_someday=1` => `scheduled_at IS NULL`
  - `scheduled_at IS NOT NULL` => `is_someday=0`
  - `is_inbox=1` => `project_id IS NULL AND scheduled_at IS NULL AND is_someday=0`
- [x] 2.3 更新索引：删除 `idx_tasks_base_list`；按查询需求新增 `is_inbox` / `is_someday` 相关索引（如需要）。

## 3. DB Worker Actions

- [x] 3.1 更新 `task.create`：
  - 按输入设置 `is_inbox/is_someday/scheduled_at/project_id`
  - 应用归一化规则（设置 project/date/someday 时清除 is_inbox；设置 date 时清 is_someday；设置 someday 时清 scheduled_at）
- [x] 3.2 更新 `task.update`：同上，且保证 partial update 不会破坏不变量。
- [x] 3.3 替换 `task.listBase`：实现 `task.listInbox` / `task.listAnytime` / `task.listSomeday` 三个 action，并更新对应 SQL 筛选。
- [x] 3.4 更新所有返回 TaskListItem 的查询（today/upcoming/project/area/search 等）：
  - SELECT 列表不再包含 base_list
  - 返回值包含 `is_inbox` / `is_someday`（供 UI/CommandPalette 使用）

## 4. IPC / Preload / Window API

- [x] 4.1 在 `electron/main.ts` 中移除 `db:task.listBase` handler，新增 `db:task.listInbox` / `db:task.listAnytime` / `db:task.listSomeday`。
- [x] 4.2 在 `electron/preload.ts` 中移除 `task.listBase` 暴露，新增对应的新方法，payload 设计为无参数（或最小参数）。

## 5. Renderer: 页面与导航

- [x] 5.1 更新 `/inbox` `/anytime` `/someday` 三个页面调用新 API。
- [x] 5.2 更新创建任务默认值逻辑（例如 `AppShell`）：
  - /inbox 默认 is_inbox=true
  - /someday 默认 is_someday=true
  - /today 默认 scheduled_at=today
  - /projects/:id 默认 project_id=id（Anytime 允许 project）
- [x] 5.3 更新 `CommandPalette` 跳转逻辑：
  - done -> logbook；scheduled(today) -> today；scheduled(>today) -> upcoming
  - project_id 存在 -> project（优先于 anytime）
  - 其余按 is_inbox/is_someday/anytime fallback

## 6. Task Editor UI (Schedule 三态)

- [x] 6.1 删除任务编辑器中的 Base list 下拉（overlay 编辑与 inline 编辑都不再编辑 base_list）。
- [x] 6.2 扩展 Schedule popover：支持 None / Date / Someday；选择 Someday 仅设置 `is_someday=true`（并清除 scheduled_at）。
- [x] 6.3 更新 Schedule chip 展示：当 `is_someday=true` 时显示 `Scheduled: Someday`，并支持 `×` 清除（清除 is_someday）。

## 7. Data Transfer (Export / Import)

- [x] 7.1 更新导出 SQL 与数据结构：Task 记录不再包含 base_list，改为包含 is_inbox/is_someday。
- [x] 7.2 决定并实现 export `schema_version` 策略（建议 bump 到 2）；import 侧按版本验证并拒绝旧版本（开发阶段可接受）。

## 8. Self Test / Verification

- [x] 8.1 更新 `src/app/selfTest.ts`：移除 base_list 的构造与断言，新增覆盖 is_inbox/is_someday/anytime 规则的用例。
- [x] 8.2 运行 `npx tsc -p tsconfig.json` 确保类型检查通过。
- [x] 8.3 运行自测模式（如已有）验证：Inbox/Someday/Anytime 列表、Schedule Someday 三态、CommandPalette 跳转优先级。
