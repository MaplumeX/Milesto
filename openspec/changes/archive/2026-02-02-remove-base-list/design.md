## Context

当前任务“基础归属”通过 `base_list`（inbox/anytime/someday）持久化表达，并被多处链路依赖：

- DB schema（tasks.base_list + index）
- DB worker actions（task.create/update/listBase）
- IPC + preload + window.api（db:task.listBase / window.api.task.listBase）
- Renderer（/inbox /anytime /someday 页面、创建默认值、编辑器 Base list 下拉、CommandPalette 跳转）
- 导入导出（TaskSchema 包含 base_list）

需求变更：彻底删除 `base_list`，改用 `is_inbox` / `is_someday` 两个布尔字段表达明确归属；Anytime 变为派生筛选；Someday 通过 Schedule popover 设置并占用 schedule 显示位，但不写入 `scheduled_at`。

约束：项目仍在开发早期，可清空 DB；但导入导出格式仍应保持自洽，并尽量通过 schema_version 表达不兼容变更。

## Goals / Non-Goals

**Goals:**
- 完全移除 `base_list`（DB + shared schemas + IPC + UI）。
- 引入并统一以下字段语义：
  - `is_inbox`: 仅在 Inbox 视图创建时默认 true；一旦设置 project/scheduled/someday 自动置 false。
  - `is_someday`: Someday 归属标记；允许 project_id；不允许 scheduled_at。
- 重新定义列表语义并落到 DB 查询：
  - Inbox: open & is_inbox=true
  - Someday: open & is_someday=true（允许 project_id；Project 页也显示）
  - Anytime: open & scheduled_at IS NULL & is_inbox=false & is_someday=false（允许 project_id）
- Schedule 编辑支持三态：None / Date / Someday（Someday 与 scheduled_at 互斥）。
- CommandPalette 跳转优先级：done/today/upcoming 仍优先；否则 project 优先于 anytime；其余 fallback 到 inbox/someday/anytime。

**Non-Goals:**
- 不提供旧 DB 的迁移路径（开发阶段用户清库）。
- 不引入新的存储模型（例如多对多 list membership 表）。
- 不在本变更内调整任务排序/拖拽模型（与 task-dnd 等变更解耦）。

## Decisions

### Decision: 用显式布尔标记替代 base_list

选择 `is_inbox` + `is_someday`，把 “明确归属” 用布尔表达，避免把派生视图（Anytime/Today/Upcoming/Project）混入同一枚举字段。

**Alternatives considered**
- 继续使用枚举（base_list 改名/扩展）：仍会让 derived view 语义混杂。
- 用系统 project 代替 base_list：会污染项目模型，并需要 UI 隐藏/特殊处理。
- 引入通用 list membership 表：架构更通用，但超出当前变更范围。

### Decision: Schedule 三态，Someday 复用 schedule 显示位但不写 scheduled_at

`scheduled_at` 表示真实日期；Someday 是一种特殊“未定日期”的 schedule 状态，因此：
- `is_someday=true` 时 `scheduled_at` 必须为 null
- 选择日期时必须清除 `is_someday`

这允许 UI 用统一的 schedule 展示位：显示日期或显示 Someday。

### Decision: 约束/归一化双层保障（DB + 代码）

为避免出现不一致状态（例如 is_someday=true 但 scheduled_at 有值），同时在：
- DB schema 使用 CHECK 约束
- task.create/task.update 的归一化逻辑中强制修正

建议的不变量：
- `is_someday=1` => `scheduled_at IS NULL`
- `scheduled_at IS NOT NULL` => `is_someday=0`
- `is_inbox=1` => `project_id IS NULL AND scheduled_at IS NULL AND is_someday=0`

### Decision: listBase API 拆分为语义明确的 listInbox/listSomeday/listAnytime

`listBase(baseList)` 会在去除 base_list 后失去语义；拆分 API 可使调用方不再构造“伪枚举输入”，并为每个列表提供独立 payload（大多为空）。

### Decision: CommandPalette 默认跳转 Project（当 project_id 存在）

Anytime 允许 project_id 会导致同一任务可在 Project 与 Anytime 同时出现；将 Project 作为默认跳转可保持“更具体归属”优先。

## Risks / Trade-offs

- [重复展示] → Someday/Anytime 允许 project_id，任务可能在 Project 与 Someday/Anytime 同时出现 → 通过跳转优先级与 UI 文案明确这是“视图”而非互斥归属。
- [历史 spec 文本过时] → 现有 openspec/specs/* 中多处提及 base_list/scheduled_at 语义 → 通过 delta specs 精确修改受影响 requirement。
- [导入导出破坏] → TaskSchema 变更会影响 export/import → 通过 bump export `schema_version` 并在 import 侧明确仅支持新版本（开发阶段可接受）。
- [约束不一致] → 仅靠 UI 可能绕过（例如从其它入口写入） → DB CHECK + 服务端归一化双层防护。

## Migration Plan

1. 修改 shared schemas：移除 base_list，新增 is_inbox/is_someday；更新所有输入/输出 schema。
2. 修改 DB schema：删除 tasks.base_list 与相关索引；新增 is_inbox/is_someday 两列与 CHECK 约束、索引。
3. 修改 DB actions：
   - create/update 应应用归一化规则
   - listInbox/listSomeday/listAnytime 替代 listBase
4. 修改 IPC + preload + window.api：替换 listBase 接口。
5. 修改 Renderer：
   - /inbox /anytime /someday 页面调用新 API
   - 创建任务默认值按路由设置 is_inbox/is_someday/scheduled_at
   - Schedule popover 支持 Someday 三态
   - CommandPalette 跳转逻辑按新优先级
6. 修改导入导出：导出 schema_version 自增（建议 2）；import 仅支持新版本。

Rollback：开发阶段可通过重置用户数据目录/删除 DB 文件回退；导入导出不承诺兼容旧文件。

## Open Questions

- 导入导出是否需要向后兼容（读取旧 base_list 并转换为新字段）？当前默认不做。
- 是否需要在列表 UI 对“Anytime 中来自 Project 的任务”做轻量标记？当前不做。
