## 1. Requirements & Utilities

- [x] 1.1 确认计划页使用的“today”语义为本地日期（`YYYY-MM-DD`），并在实现中统一使用 `parseLocalDate` / `formatLocalDate`
- [x] 1.2 扩展 `src/lib/dates.ts`：提供本地日期 addDays、取月份 key（`YYYY-MM`）、取当月最后一天等工具函数（不引入新依赖）
- [x] 1.3 实现计划页专用的 label formatter（按 locale 输出：zh-CN `2.13 周五` / `2月（20-28）`，en `2/13 Fri` / `Feb (20-28)` 等）并封装为可测试的纯函数

## 2. Plan Page 分组与过滤（核心）

- [x] 2.1 更新 `src/pages/UpcomingPage.tsx`：移除不再需要的 `nextWeekStart/nextMonthStart` 计算与透传，仅保留 `today` 与任务刷新逻辑
- [x] 2.2 重写 `src/features/tasks/UpcomingGroupedList.tsx` 的分组逻辑：构造固定 7 个日 Header + 固定 5 个月 Header，并确保日/月分组不重叠
- [x] 2.3 在 `UpcomingGroupedList` 中加入“更远不显示”的过滤（仅渲染未来 5 个月范围内任务）
- [x] 2.4 月分组内任务行渲染：在标题旁添加 `M.D` 日期前缀（仅月分组；日分组不显示前缀）
- [x] 2.5 删除计划页顶部跳转按钮行（保留 `.page-header` 与标题）

## 3. 交互与可访问性保持一致

- [x] 3.1 确保 listbox 键盘导航仍只在 task 行间移动（跳过 header 行），Enter 仍能打开 inline editor
- [x] 3.2 确保虚拟列表 key 稳定且可区分：day/month header 与 task 行 key 不冲突（避免滚动/展开错位）
- [x] 3.3 为月分组的日期前缀补齐样式（低噪声、可读、不会挤压标题；窄窗下仍能显示）

## 4. 测试与回归验证

- [x] 4.1 更新 `src/app/selfTest.ts`：修正对 `.upcoming-header` 的断言与滚动定位逻辑（当前依赖 header 文本等于 `YYYY-MM-DD`）
- [x] 4.2 覆盖关键场景：无任务的日/月份仍渲染 Header；跨月时日分组覆盖到下月且月分组从第 8 天开始；更远月份不显示
- [x] 4.3 运行 `npm run test` 并确保通过（记录任何与本变更无关的既有失败）
- [x] 4.4 运行 `npx tsc -p tsconfig.json` 确保类型检查通过
