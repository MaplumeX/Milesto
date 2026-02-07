## Context

当前行内任务编辑器（`src/features/tasks/TaskEditorPaper.tsx`，`variant="inline"`）的 Schedule/Due picker 使用 `input[type="date"]` 并在 popover 打开时调用 `HTMLInputElement.showPicker()`。

结果是：用户先进入应用内 popover（含按钮/标题），随后系统再弹出原生日期选择器（第二层 UI），形成“面板 + 日历面板”的割裂体验；并且原生日期选择器在不同平台（macOS/Windows/Linux）表现差异较大。

Tags picker 目前仅支持勾选已有 tag（checkbox grid），缺少在同一面板内快速创建新 tag 的输入入口。

现有 popover 属于自研实现：`createPortal` 到 `document.body`，`position: fixed`，基于 `anchorEl.getBoundingClientRect()` 手动定位，并在 scroll/resize 时关闭。该容器样式类名 `.task-inline-popover` 同时被 Project 菜单复用（`src/pages/ProjectPage.tsx`）。

约束与关联：

- 存储层的日期字段为本地日期字符串 `YYYY-MM-DD`（见 `shared/schemas/common.ts` 的 `LocalDateSchema`）。
- 行内编辑器高度稳定是关键（虚拟滚动），picker MUST 不通过“插入展开面板”改变行高（由 `openspec/specs/task-inline-editor/spec.md` 约束）。
- 新增依赖需要说明用途、替代方案与供应链风险（见 `docs/standards.md` / `docs/redlines.md`）。

## Goals / Non-Goals

**Goals:**

- Schedule 与 Due 的 date picker 在同一 popover 内直接呈现日历 + 操作按钮（单层 UI），不再触发原生 `showPicker()`。
- 周起始为周一（Monday-first week）。
- Tags picker 增加顶部输入框，支持“输入 + 回车创建新 tag”，并在创建后自动选中该 tag（不做过滤/搜索）。
- 保持现有关闭/焦点/虚拟滚动稳定性：picker 仍然是浮层，不改变行内编辑器高度；`Escape` 可关闭 picker；click-away 优先关闭 picker。

**Non-Goals:**

- 不重做 overlay 版本（`variant="overlay"`）的日期输入交互（本次聚焦于行内 picker 的“嵌套面板”问题）。
- 不引入新的 IPC 通道或 DB schema 变更；复用现有 `window.api.*`。
- Tags picker 不做搜索/过滤/键盘导航增强（仅增加创建输入）。
- 不在本次引入完整的日期时间（time）选择。

## Decisions

### 1) 采用 `react-day-picker` 作为嵌入式日历组件

Decision:

- 引入 `react-day-picker`（MIT）用于在 popover 内渲染单选日历。

Rationale:

- 解决原生日期选择器的跨平台不一致与“二级面板”割裂。
- 组件成熟，支持 `weekStartsOn={1}`（周一）与良好的键盘可访问性（`autoFocus`）。

Alternatives considered:

- 手写 mini calendar：无依赖，但需要补齐日期计算、键盘导航、可访问性，成本与风险更高。
- 继续使用原生 `input[type=date]`：无法满足“日历与按钮一体、单层 UI”的目标。

### 2) 保持现有 portal popover 原语，不引入 Radix/shadcn popover

Decision:

- 延续现有 popover（`createPortal` + `fixed` + 手动定位），只替换内容区为日历 + footer。

Rationale:

- 现有 close 语义（scroll/resize 关闭、click-away 优先关闭 picker）与虚拟滚动约束已落地并有自测覆盖。
- 避免在同一变更中引入新的 overlay 原语与焦点陷阱复杂度。

### 3) 日期值转换：使用“本地日期”语义，避免时区偏移

Decision:

- 日历内部以 `Date` 表示选中值，但与持久化字段 `YYYY-MM-DD` 之间的转换使用 `new Date(year, monthIndex, day)` 与本地格式化（`formatLocalDate`），避免 `new Date('YYYY-MM-DD')` 的 UTC 解析导致的跨时区偏移。

Rationale:

- 现有 schema 明确 `scheduled_at/due_at` 是 local-date（无时区），UI 与 DB 需保持语义一致。

### 4) Schedule/Due picker 的结构与行为

Decision:

- Schedule popover 内容结构：
  - 标题 `Scheduled`
  - `DayPicker`（`mode="single"`，`weekStartsOn={1}`，建议 `fixedWeeks` + `showOutsideDays` 降低布局抖动）
  - footer：`Someday` / `Today` / `Clear`
- Due popover 内容结构：
  - 标题 `Due`
  - `DayPicker`（同上）
  - footer：`Clear`
- 选择日期后立即写入 draft 并触发现有 debounced 保存，然后关闭 popover。

Rationale:

- 与现有行为对齐（选择后关闭），并保持 `src/app/selfTest.ts` 对 `.task-inline-popover` 与 `Someday` 按钮文案的依赖尽量不变。

### 5) Tags picker 顶部创建输入（无过滤）

Decision:

- Tags popover 顶部新增输入框；用户输入后按 Enter：
  - 若输入为空（trim 后）则不动作。
  - 若与现有 tag 标题重复（建议 trim + case-insensitive）则不创建新 tag，直接选中已有 tag。
  - 否则调用 `window.api.tag.create({ title })` 创建，成功后刷新本地 tags 列表并自动选中。
- 不改变下方 checkbox 列表的呈现与排序（仍按现有列表渲染）。

Rationale:

- 仅满足“快速添加”目标，不引入搜索/过滤的额外交互复杂度。

### 6) Popover 定位增强：为更高的日历内容增加“向上翻转”策略

Decision:

- 现有定位逻辑默认在 anchor 下方展开（`rect.bottom + 8`），对日历高度可能不够。
- 引入简单的 flip：当下方剩余空间不足以容纳 popover 高度（或超过阈值）时，popover 优先放置在 anchor 上方。

Rationale:

- 避免日历被 viewport 底部截断，提升可用性。

## Risks / Trade-offs

- [新增依赖的供应链/体积风险] → Mitigation: 选择 MIT 且维护活跃的 `react-day-picker`；在 PR 中说明用途/替代方案/风险；避免并存同类日历库。
- [Popover 变高导致出屏/遮挡] → Mitigation: 实现向上 flip；必要时调大宽度并限制最大高度；保持 `position: fixed`。
- [样式污染]（`.task-inline-popover` 也被 ProjectMenu 复用）→ Mitigation: 日历相关样式尽量作用域化（包一层 className），避免修改通用容器的全局规则。
- [焦点与键盘交互回归] → Mitigation: 使用 `DayPicker` 的 `autoFocus`（或 `initialFocus`）并保留现有 `Escape` 关闭逻辑；关闭后焦点回到触发按钮（延续现有行为）。
- [local-date 与 Date 互转的 off-by-one] → Mitigation: 明确采用本地构造与格式化，不使用 `Date.parse('YYYY-MM-DD')`。
- [scroll/resize 自动关闭 picker] → Mitigation: 保持现有策略（避免定位陈旧）；后续如有 UX 反馈再调整。

## Migration Plan

1. 添加依赖：`react-day-picker`（及其依赖链），并引入样式（`react-day-picker/style.css`）。
2. 在 `TaskEditorPaper` 的 inline `renderPopover()` 中替换 Schedule/Due 内容为 `DayPicker` + footer；移除 `showPicker()` 相关逻辑。
3. Tags popover 增加顶部输入框与 Enter 创建流程；创建成功后更新 tags 并选中。
4. 完成 popover flip 定位增强，验证在窗口底部也可用。
5. 回归自测（`src/app/selfTest.ts`）与手动验证：Schedule/Due 不再触发系统日历面板，week starts Monday。

Rollback:

- 若出现严重回归，可回退到 `input[type=date]` 实现（保留同一 popover 结构与按钮），或临时关闭日历嵌入（恢复原逻辑）。

## Open Questions

- Tags 重名判定是否需要严格区分大小写/空格（当前设计采用 trim + case-insensitive 防重复）。
- DayPicker 的样式策略：使用官方 `style.css` 还是通过 `classNames` 做更强的项目风格对齐（实现阶段再落地）。
