## Context

- 现状（Area 页面）：`src/pages/AreaPage.tsx` 先渲染 `TaskList`（任务内容区），随后再渲染项目列表区块（包含 `sections-header/sections-title` 的“Projects/项目”标题，项目条目使用 `NavLink`）。
- 现状（TaskList 虚拟滚动）：`src/features/tasks/TaskList.tsx` 使用 `@tanstack/react-virtual`，并通过 `scrollMargin` 处理“滚动容器在列表外层（.content-scroll）”时的对齐问题。`scrollMargin` 通过 `getBoundingClientRect()` 计算，当前仅在 mount 与 window resize 时重算。
- 约束：遵循单一主滚动容器（`openspec/specs/task-list-single-scroll/spec.md`）与键盘优先（`docs/ui.md`）原则；不引入新的 IPC/DB 能力。
- 用户目标（本 change 范围）：
  - 标题左侧显示图标。
  - 项目列表位于任务内容区上方，不显示“项目/Projects”标题。
  - 项目条目交互与任务条目一致：单击仅高亮/聚焦；双击进入；整行高亮包含左侧圆形 `ProjectProgressControl`。

## Goals / Non-Goals

**Goals:**
- 在 `/areas/:areaId` 页面内，将“项目列表”放到任务列表之前（同一主滚动容器内），并移除“Projects/项目”分组标题。
- 为 Area 页面标题增加左侧图标，且不影响现有标题编辑与右侧 `...` 菜单。
- 项目条目采用与任务条目同款交互语义：单击选中（整行高亮、聚焦）；双击进入（导航至项目页）。
- 复用现有任务行样式（`.task-row`/`.task-row.is-selected` 等），确保选中高亮覆盖整行（包含 `ProjectProgressControl`）。
- 保证 TaskList 虚拟滚动对齐不因“列表上方可变高度内容（项目列表）”而失准（scrollMargin/scrollToIndex 仍正确）。

**Non-Goals:**
- 不改动项目完成/重新打开等业务语义（仍遵循 `project-progress-indicator`）。
- 不在 Area 页面引入新的嵌套滚动容器或固定高度卡片（保持单一主滚动）。
- 不新增“左侧竖条/active bar”之类的全新指示器（指示器即现有圆形 `ProjectProgressControl`）。
- 不做项目列表的分组、排序策略升级（沿用当前 title 排序逻辑）。

## Decisions

### Decision 1: 通过 TaskList 插槽在 header 与 listbox 之间渲染项目列表

**选择**：为 `src/features/tasks/TaskList.tsx` 增加一个可选插槽（例如 `topContent?: React.ReactNode`），插入位置为 header 之后、任务 listbox（`.task-scroll[role=listbox]`）之前。

**原因**：
- Area 页面当前是“一个 TaskList + 一个额外 `.page` 区块”。把项目列表纳入 `TaskList` 的 `.page` 容器，能保持页面结构一致，并避免出现两个 page stacking 的视觉与布局复杂度。
- 插槽允许 `TaskList` 在内部统一处理“列表上方布局变化对虚拟滚动对齐的影响”（见 Decision 2），而不是让 `AreaPage` 通过外部 hack 触发 `scrollMargin` 重算。

**备选方案**：仅在 `AreaPage` 内调整 JSX 顺序（把项目列表 `<div className="page">` 移到 `<TaskList />` 之前）。
- **未选原因**：项目列表高度会在数据加载后变化，导致 `.task-scroll` 的 top 偏移发生变化；而 `TaskList` 当前 `scrollMargin` 仅在 mount/resize 重算，容易出现虚拟列表 translateY 错位与 scrollToIndex 对齐误差。

### Decision 2: 当 TaskList 上方插槽高度变化时，重算 scrollMargin

**选择**：在 `TaskList` 内部为插槽容器维护一个 ref，并用 `ResizeObserver` 观察其尺寸变化；变化时触发 `compute()` 重算 `scrollMargin`。

**原因**：
- `scrollMargin` 依赖 listbox top 与 scroll host top 的差值。插槽内容（项目列表）是最主要的“会在 mount 后变化高度”的来源；其高度变化将直接改变 listbox 的 top。
- 仅监听 window resize 不足以覆盖“数据加载导致高度变化”。

**备选方案**：通过 `useLayoutEffect` 依赖 `projects.length`、`tasks.length` 等在外层驱动重算。
- **未选原因**：该依赖与 TaskList 组件的复用边界耦合过强；且无法覆盖其他导致布局变化的因素（字体渲染、标题换行等）。

### Decision 3: 项目条目用“占满行的 button”替代 NavLink，实现“单击选中、双击进入”

**选择**：在 `AreaPage` 的项目列表中，用任务行同款 `button` 作为主要点击面（参考 `src/features/tasks/TaskRow.tsx` 的 `task-title task-title-button`）。

行为：
- `onClick`: 设置 `selectedProjectId`（仅高亮/聚焦，不导航）。
- `onDoubleClick`: `navigate(`/projects/${projectId}`)`。
- `onKeyDown`: `Enter` 作为双击的键盘等价（导航进入）；`Space`/`Enter` 的默认行为不应触发“只选中不进入”的歧义。

**原因**：
- 现有 `NavLink` 的默认语义是“单击即导航”，与目标交互冲突。
- 使用 `<button>` 可获得清晰的键盘可达性基础（focus、aria label 等），并使整行点击面更易与任务条目对齐。

**备选方案**：保留 `NavLink`，通过阻止默认事件来区分单击/双击。
- **未选原因**：易引入事件时序与导航副作用（dblclick 之前会触发 click）；并且 `NavLink` 的 active/visited 语义与“仅选中高亮”不匹配。

### Decision 4: 复用 `.task-row.is-selected` 作为项目行选中样式

**选择**：项目行外层 `<li className="task-row ...">` 根据 `selectedProjectId` 拼接 `is-selected`，复用 `src/index.css` 的 `.task-row.is-selected` 规则。

**原因**：
- 用户要求“整条聚焦，包括指示器（圆形进度控件）”。将选中状态挂在 `<li>` 能自然覆盖其所有子元素。
- 复用现有样式降低 UI drift，符合“同一套列表行”的一致性。

## Risks / Trade-offs

- [虚拟列表对齐错位] 插槽高度变化导致 listbox top 变化，而 `scrollMargin` 未及时更新 → 任务行 translateY 计算错误 / scrollToIndex 偏移。
  - Mitigation: 采用 `ResizeObserver` 观察插槽容器尺寸并触发 `compute()`；并保持 compute 内对 refs 未就绪的重试逻辑。
- [键盘等价不足] 项目行如果仅靠双击进入，对键盘用户不可用 → 与 `docs/ui.md` 的“Enter 打开详情”冲突。
  - Mitigation: 为项目行按钮实现 `Enter` 导航进入；保持单击仅选中。
- [自测脆弱] `src/app/selfTest.ts` 目前依赖 `.sections-title` 文本 “Projects” 来定位 Area 项目区块 → 去掉标题会导致自测失败。
  - Mitigation: 改用更稳定的结构化选择器（例如 data attribute 或更明确的容器 class）。
