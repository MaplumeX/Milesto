## Context

- 当前任务与项目都只有二元状态：
  - `shared/schemas/common.ts` 仅定义 `open | done`
  - DB worker 查询、Logbook、项目折叠区、项目进度统计都把 `done` 当作唯一终态
- 现有“关闭”链路已经比较完整：
  - 任务通过 `task.toggleDone` 在 `open <-> done` 之间切换
  - 项目通过 `project.complete` 原子地把项目标记为 `done`，并批量完成仍为 `open` 的子任务
  - `completed_at` 已经被 Logbook 排序和终态恢复逻辑复用
- UI 入口已经分层明确：
  - 任务复选框承担快速完成/恢复
  - 项目进度控件承担完成项目/重新打开项目
  - 任务菜单、任务详情、项目菜单承载更丰富的元操作

约束：

- 不打破 `window.api.*`、Main、DB worker 的边界。
- 不引入单独的 Cancelled 页面或新的历史分组，继续复用当前 `Completed` / `Logbook`。
- 数据规模和现有查询性能约束不变，不能为了新状态把列表与搜索链路复杂化。
- 当前 SQLite 表未对 `status` 文本值做枚举级 `CHECK`，因此优先避免需要重建表结构的迁移。

## Goals / Non-Goals

**Goals:**

- 为任务和项目新增 `cancelled` 终态，语义上区别于 `done`。
- 保持 `done` 与 `cancelled` 共用同一条终态时间线与历史视图。
- 为任务和项目提供显式取消入口，同时保留现有复选框 / 进度控件的主语义不变。
- 让项目取消沿用当前项目完成的事务模型：项目与其 open 子任务一次提交。
- 让项目进度与 closed 列表把 `done + cancelled` 一并视为终态。
- 将实现限定在增量扩展，而不是重写全部状态接口。

**Non-Goals:**

- 不引入三态复选框交互，也不让列表复选框在 `done` / `cancelled` 间循环切换。
- 不新增 `cancelled_at`、`is_cancelled` 等并行字段。
- 不把现有所有 `done_*` / `listDone` / `countDone` 命名一次性重构为 `closed_*`。
- 不新增独立 Cancelled 页面、过滤器或统计面板。
- 不支持 `done <-> cancelled` 直接互转；用户必须先恢复到 `open`。

## Decisions

### Decision: 扩展 `status` 为三态，并继续复用 `completed_at`

Decision:

- 将任务与项目状态扩展为 `open | done | cancelled`。
- 继续使用 `completed_at` 表示“进入任一终态的时间”。
- `open` 时 `completed_at = null`；`done` 和 `cancelled` 都写入 `completed_at`。

Rationale:

- 这能复用现有 Logbook 排序、恢复逻辑和 closed 列表查询，不需要第二套时间字段。
- 表结构当前没有枚举级约束，增量引入新状态值即可，不需要高成本迁移。

Alternatives considered:

- 新增 `cancelled_at` / `is_cancelled`
  - Rejected，因为状态语义会分裂到多个字段，查询、同步、导入导出都要写双分支。
- 保持 `status=open|done`，把取消只做成 UI 标记
  - Rejected，因为这会让项目取消、搜索过滤、Logbook 归档都失去统一数据语义。

### Decision: 保留二元快捷控件，取消作为显式并列动作暴露

Decision:

- 任务复选框继续只处理 `open <-> done`。
- 项目进度控件继续只处理“完成项目 / 重新打开项目”。
- 取消通过显式动作进入：
  - `task.cancel`
  - `project.cancel`
  - UI 入口放在任务菜单、任务详情、项目菜单

Rationale:

- 复选框和进度控件已经形成了稳定心智模型，改成三态轮转会提高误操作概率。
- 明确的 `Cancel` 动作比含糊的三态切换更符合当前代码结构和用户预期。

Alternatives considered:

- 用一个通用 `setStatus(status)` 替换所有 done/open API
  - Rejected，本次目标是增量扩展，不值得把现有所有调用点一起重构。
- 让复选框参与三态切换
  - Rejected，会让最频繁的快捷操作失去可预测性。

### Decision: 将 `done` 与 `cancelled` 统一视为 closed 集合

Decision:

- 所有 closed 历史视图继续复用现有容器：
  - 项目页 `Completed` 折叠区
  - Logbook
- 查询层把 `done` 与 `cancelled` 统一视为终态集合。
- 项目进度统计把 `done + cancelled` 一并计入已关闭进度。

Rationale:

- 用户已经明确不需要新增 Cancelled 专区，复用现有 closed 容器能把变更范围压到最小。
- 统一 closed 集合可以让搜索、列表、进度、Logbook 保持一致。

Trade-off:

- 现有部分内部命名仍保留 `done` 字样，例如 `listDone`、`done_count`。
- 本次先保留这些名字以减少改动；实现时语义上按 closed 处理，后续若需要再做专门的术语清理。

### Decision: 为项目取消复用当前 `project.complete` 的事务模式

Decision:

- 新增 `project.cancel`，其行为与 `project.complete` 平行：
  - 项目 `open -> cancelled`
  - 该项目下所有仍为 `open` 的任务批量 `open -> cancelled`
  - 已经 `done` 或 `cancelled` 的任务保持原状
- 重新打开项目时，仅把项目本身改回 `open`，不恢复任何子任务。

Rationale:

- 现有 `project.complete` 已经提供了事务边界和“无半套状态”的行为模型，取消应完全复用这条设计。
- 这能保证项目取消与项目完成的可预期性一致。

Alternatives considered:

- 取消项目时同时把所有子任务都强制改成 `cancelled`
  - Rejected，会错误覆盖已经 `done` 的历史语义。
- 重新打开项目时恢复所有已取消任务
  - Rejected，和当前 reopen 语义不一致，也会导致意外大量状态回滚。

### Decision: 用共享渲染语义区分 `done` 与 `cancelled`

Decision:

- `done` 继续使用对勾语义。
- `cancelled` 使用 `x` 语义。
- 取消态任务与项目标题使用删除线。
- Logbook 仍不对 `done` 标题使用删除线，但 `cancelled` 需要保留删除线。

Rationale:

- 用户要求这两类终态“基本一样，但可一眼区分”。
- 通过共享状态语义控制图标和文本样式，比在各个页面单独硬编码更稳。

Alternatives considered:

- 仅靠颜色区分 done/cancelled
  - Rejected，信息密度不够，且不符合现有低噪声 UI 风格。

### Decision: 搜索与 closed 过滤统一按终态集合处理

Decision:

- `include_logbook=false` 时，搜索结果只包含 `open`。
- `include_logbook=true` 时，搜索结果允许返回 `done` 和 `cancelled`。
- SearchPanel 选中 cancelled 任务时，和 done 任务一样跳转到 Logbook。

Rationale:

- 这与“done/cancelled 都进入 closed 历史视图”的总体语义保持一致。
- 能避免某些 cancelled 任务既不在 active 列表，也无法从搜索正确抵达的死角。

## Risks / Trade-offs

- [内部命名仍带 `done`] → 统计和列表 API 会出现“名字是 done，语义是 closed”的短期术语债。
  → Mitigation: 本次在 design/spec 中明确其 closed 语义；后续若继续扩展状态系统，再统一重命名。

- [终态条件分支扩散到多处查询] → Logbook、项目折叠区、搜索、进度统计都需要从 `status='done'` 改成终态集合判断。
  → Mitigation: 优先抽出共享终态条件或共享 helper，避免 SQL 与 renderer 条件分散漂移。

- [Logbook 样式例外更复杂] → 现有 Logbook 对 `done` 标题专门禁用了删除线，新加 `cancelled` 后需要额外分支。
  → Mitigation: 用显式状态类名而不是单纯复用 `is-done`，让 `done` 与 `cancelled` 在样式层可区分。

- [项目进度控件语义变宽] → 进度统计从“done 数量”变成“closed 数量”后，100% pie fill 不再只代表 done。
  → Mitigation: 保持项目自身 `status` 决定最终图标；open 且 100% closed 仍与真正 closed 项目保持视觉区分。

- [任务详情与菜单入口可能出现重复动作] → `Complete`、`Cancel`、`Restore` 需要在不同状态下保持一致，不然用户会看到冲突动作。
  → Mitigation: 统一状态机：
  - open: `Complete` + `Cancel`
  - done/cancelled: `Restore`

## Migration Plan

1. 扩展 shared schema 与 IPC 合同，允许 `cancelled` 状态穿透主进程、预加载和渲染层。
2. 在 DB worker 中补齐：
   - `task.cancel`
   - `project.cancel`
   - 所有 closed 列表 / Logbook / 搜索 / 进度统计查询的终态集合处理
3. 更新 renderer 的状态入口与 closed 呈现：
   - 任务菜单 / 详情 / 项目菜单
   - Logbook / Project page / SearchPanel / ProjectProgressControl
4. 补全自测与回归验证，重点覆盖：
   - open/done/cancelled/reopen
   - project.cancel 的事务性
   - closed 列表与搜索跳转一致性

Rollback:

- 代码回滚即可恢复二元状态逻辑。
- 本次不依赖表结构迁移；若回滚后数据库里已存在 `cancelled` 数据，旧版本无法识别，因此发布时应将该变更视为应用层状态升级并避免向旧版本回退运行同一用户数据目录。

## Open Questions

- None. 本次 explore 已经确认：
  - 项目取消会批量取消其下 open 任务
  - done/cancelled 都进入现有 Completed / Logbook
  - 复选框不做三态轮转
  - done 与 cancelled 之间不直接互转
