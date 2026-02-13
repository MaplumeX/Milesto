## Why

当前“计划(/upcoming)”页按 `scheduled_at` 逐日分组，只有“有任务的日期”才出现 Header，且 Header 直接展示 `YYYY-MM-DD`。当未来任务分散时，页面会被大量日期切碎，用户难以建立“近 7 天 + 远期按月”的计划视角。

我们需要把计划页的时间视窗与信息密度重新设计为：近 7 天以天为单位精细查看，远期以月为单位粗粒度浏览，同时保持现有的键盘优先与虚拟列表性能。

## What Changes

- 计划页分组改为两段：
- 未来 7 天：从“明天”开始固定展示 7 个日分组 Header（即使无任务也显示 Header），Header 文案格式为 `M.D 周X`（例：`2.13 周五`）。
- 未来 5 个月：从“第 8 天”（明天 + 7）开始，固定展示 5 个自然月分组 Header（即使无任务也显示 Header）。第一个月若从月中开始，Header 显示范围：`2月（20-28）`；其余月显示 `3月`、`4月` 等。
- 月分组内不再按天拆分；每条任务行在标题左侧展示日期前缀 `M.D`（例：`2.21`），以保留具体日期信息。
- 移除计划页顶部“明天/第8天/下月”等跳转按钮（页面仅保留标题与列表）。
- 仅展示未来 5 个月范围内的任务；更远日期的任务在该页不展示（不改变任务数据本身）。

## Capabilities

### New Capabilities
- `plan-page`: 计划页（/upcoming）任务分组、显示范围与日期文案格式的行为规范。

### Modified Capabilities

<!-- None. -->

## Impact

- Renderer：`src/pages/UpcomingPage.tsx`、`src/features/tasks/UpcomingGroupedList.tsx`（分组与标签生成逻辑、渲染结构保持虚拟列表）。
- 日期工具：可能扩展 `src/lib/dates.ts`（本地日期加减、weekday 生成、月份范围计算）。
- i18n：`shared/i18n/messages.ts` 可能新增计划页相关文案（如“周X”/月份范围的本地化策略）。
- 数据/IPC/DB：不引入新接口，不修改 `task.listUpcoming` 语义；计划页仅在前端做显示范围过滤与分组。
