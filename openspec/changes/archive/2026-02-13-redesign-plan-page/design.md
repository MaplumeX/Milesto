## Context

- 当前计划页路由为 `/upcoming`（侧边栏文案为“计划”），页面组件为 `src/pages/UpcomingPage.tsx`，列表组件为 `src/features/tasks/UpcomingGroupedList.tsx`。
- 数据来源：`window.api.task.listUpcoming(today)`，DB 侧过滤为 `scheduled_at > today` 且 `status=open` 且 `scheduled_at IS NOT NULL`。因此计划页天然不包含“今天”、不包含无计划日期任务。
- 列表使用 `@tanstack/react-virtual` 虚拟滚动；键盘导航在 listbox 容器上处理（ArrowUp/Down 选中任务，Enter 打开内联编辑）。
- 现状分组：仅按“有任务的日期”逐日分组，Header 直接渲染 `YYYY-MM-DD`。

约束：
- 必须保持虚拟列表与键盘优先交互（`docs/ui.md`）。
- 不改变 `task.listUpcoming` 的语义与接口；计划页仅做前端显示分组/过滤。

## Goals / Non-Goals

**Goals:**
- 将计划页分组重构为两段：
  - 未来 7 天（日分组，固定 7 个 Header，从明天开始），Header 文案为 `M.D 周X`（例：`2.13 周五`），无任务时只显示 Header。
  - 未来 5 个月（月分组，固定 5 个 Header，从第 8 天开始），第一个月若从月中开始显示范围（例：`2月（20-28）`），其余显示月份（例：`3月`）。无任务时只显示 Header。
- 月分组内不按天拆分；每条任务行展示日期前缀 `M.D`（例：`2.21`），以保留具体日期信息。
- 过滤掉超过未来 5 个月范围的任务（更远不显示）。
- 移除计划页顶部跳转按钮，保留标题与列表。
- 保持现有虚拟化渲染、键盘导航、内联编辑展开能力。

**Non-Goals:**
- 不引入“过期(Overdue)”分组（该页数据口径本就不包含过去日期）。
- 不把“今天”的任务纳入计划页（保持与 `scheduled_at > today` 一致）。
- 不新增/修改 IPC 或 DB 查询接口（不做按范围分页、按月聚合等）。
- 不改任务行的交互模型（勾选/双击/Enter 打开等保持现状）。

## Decisions

1) 分组算法：继续采用“展平 Row[] + 虚拟列表”

- 维持现有模式：先把任务按 key 分桶，再展平为 `Row[]`（Header/Task 交错）。
- 新增两类 Header：`day` 与 `month`。
- 由于 Header 数量固定（7 + 5 = 12），空分组也要插入 Header Row，但不插入空占位行。

2) 边界定义：避免日分组与月分组重叠

- 定义 `D0 = today + 1 day`（明天）。
- 日分组覆盖：`D0..D0+6`。
- 月分组起点 `M0 = D0+7`（第 8 天）。
- 月分组覆盖自然月序列：`M0` 所在月开始连续 5 个自然月。
- 任务分配规则：
  - `scheduled_at` 在日范围内 -> 进入对应日分组。
  - `scheduled_at` 在月范围内且 `>= M0` -> 进入对应月分组。
  - 其他（更远）-> 不渲染。

3) 日期与本地时区：只用“本地午夜”语义

- 所有日期运算基于 `YYYY-MM-DD` 的本地日期语义（复用/扩展 `src/lib/dates.ts`，避免 `new Date('YYYY-MM-DD')` 触发 UTC 偏移）。
- 需要的最小能力：
  - 将 `YYYY-MM-DD` 转为本地 Date（已有 `parseLocalDate`）。
  - 从本地 Date 生成 `YYYY-MM-DD`（已有 `formatLocalDate`）。
  - 基于本地 Date 做 addDays、取当月最后一天、取月份 key（`YYYY-MM`）。

4) 文案与本地化策略

- 目标格式在 zh-CN 为：
  - 日 Header：`M.D 周X`（例：`2.13 周五`）
  - 月 Header：`2月（20-28）` / `3月`
  - 月内任务前缀：`M.D`
- App 支持 `en` 与 `zh-CN`。为避免把中文格式硬编码到英文：
  - 使用 `i18n.language`（或 i18n locale state）选择不同的 formatter。
  - zh-CN：严格按上述格式。
  - en：采用等价但更自然的显示（例如 `2/13 Fri`、`Feb (20-28)`、`Mar`），具体格式在 specs 中固定。

5) 结构调整：移除顶部跳转按钮但保留 page-header

- 保持 `.page` / `.page-header` / `.page-title` 布局；删除 button row。
- 保持 listbox 容器与 `onKeyDown` 行为不变，Header Row 仍为不可选元素。

## Risks / Trade-offs

- [英文/其他 locale 的日期展示不一致] → 在 specs 中明确各 locale 的格式；实现时使用 formatter 封装并配合 i18n parity 检查。
- [固定 Header 导致“空白看起来像 bug”] → 保留现有底部/标题附近的轻提示（例如“仅显示未来 5 个月”或“暂无计划任务”），但不在每个分组插入占位行。
- [虚拟列表高度估算偏差导致初次滚动跳动] → Header 行高度保持与现有 `.upcoming-header` 接近（目前估算 34px），必要时在 measureElement 处继续测量。
- [过滤更远任务仅在前端完成，数据仍会拉取全部 future] → 现阶段接受；如未来出现性能问题，再考虑新增 range 查询接口（非本次范围）。
