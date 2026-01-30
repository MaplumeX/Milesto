## Context

当前 Milesto 的任务编辑采用 Overlay Paper（`src/features/tasks/TaskEditorOverlayPaper.tsx` + `src/features/tasks/TaskEditorPaper.tsx`）：

- 通过 `openTaskId` 打开编辑器（`src/app/AppShell.tsx`），并在打开期间锁定背景内容区滚动/点击（`.content-scroll.is-locked`）。
- Overlay wrapper 负责焦点陷阱与关闭手势（`Escape`、`Cmd/Ctrl+Enter`），并在关闭前调用 `flushPendingChanges()` 防止丢稿。
- 任务列表（`src/features/tasks/TaskList.tsx`、`src/features/tasks/UpcomingGroupedList.tsx`）使用 `@tanstack/react-virtual`，目前以固定高度估算（任务行 44px、Upcoming header 34px）+ `position:absolute`/`translateY` 布局。

本变更将任务编辑从“遮罩浮层”切换为“列表行内展开（row expansion）”，让用户在列表上下文内完成标题/备注/检查事项的编辑，并以更轻量的右下角动作栏提供 Schedule/Tags/Due（以及 checklist 为空时的快速新增入口）。

约束与原则：

- 性能：任务列表必须维持虚拟滚动能力（目标规模 10k 任务）；行内编辑不能引入嵌套滚动区域。
- 交互：键盘优先；编辑期间不能被列表级键盘导航“抢键”（例如在 textarea 里按空格不应触发列表 toggle）。
- 数据安全：必须保留现有自动保存与 flush 语义（去抖、串行化、防丢稿、失败可重试）。

## Goals / Non-Goals

**Goals:**

- 在 `TaskList` 与 `UpcomingGroupedList` 中支持单任务行内展开编辑（与当前 `openTaskId` 模型一致，一次只展开一个任务）。
- 展开态 UI：标题仍是任务条目本体；下方显示：
  - Notes：无边框/无底色，视觉上与标题属于同一内容块；placeholder 为“备注”（提示色）。
  - Checklist：展示/编辑检查事项列表。
- 展开态右下角 Action Bar：
  - `Schedule`、`Tags`、`Due` 三个按钮常驻。
  - `Checklist` 按钮仅在 checklist 为空时显示，作为“最快新增 checklist”的入口；新增后隐藏；删除到空则自动收起并重新出现。
- 虚拟滚动支持可变高度展开内容，且尽量避免展开/编辑过程中的滚动跳动。
- 保持现有自动保存 + `flushPendingChanges` 关闭/收起语义：收起前必须 flush；失败则阻止收起并保留展开态让用户处理错误。

**Non-Goals:**

- 不在本变更中引入/迁移到 shadcn/ui + Tailwind（当前仓库仍以 `src/index.css` 为主；本变更优先保持改动聚焦）。
- 不在行内展开中提供 Project/Area/Section/Base list 等所有字段编辑（仍可后续通过其他入口补齐）。
- 不支持同时展开多个任务编辑器。
- 不在本阶段彻底移除旧 Overlay 相关代码（允许先完成行内展开后再清理）。

## Decisions

### 1) 行内展开的“虚拟行模型”：插入 editor 行（而非让 task 行自增长）

**Decision:**
采用“行模型（rows）+ 插入 editor 行”的方式实现展开：当 `openTaskId === 某任务` 时，在该任务行之后插入一个 `editor` 行，该行承载 Notes/Checklist/Action Bar 的可变高度内容。

**Rationale:**

- 将可变高度集中在单一 `editor` 行，降低对大量 task 行的测量/重排压力；大多数 task 行仍可保持接近固定高度。
- 任务标题行保持现有 `.task-row` 结构与交互语义（selection、checkbox、双击/Enter 打开）。
- 避免在“列表项（listbox option）”内部混入大量表单控件，降低键盘语义与事件冒泡冲突。

**Alternatives considered:**

- 让 task 行本身展开变高：更容易做“单卡片外观”，但会把输入控件嵌入列表项并增加键盘事件冲突面，且每次内容变化都需要对该 task 行做动态测量。
- 右侧 Inspector 面板：实现简单且不影响虚拟滚动，但不符合本变更的产品方向（明确要求原地展开）。

### 2) 虚拟滚动：启用动态测量（`measureElement`）并控制滚动锚定

**Decision:**

- 在 `TaskList` 与 `UpcomingGroupedList` 的虚拟化实现中启用动态测量：对渲染出的每个虚拟行挂载 `rowVirtualizer.measureElement` ref，并设置 `data-index={virtualRow.index}`。
- 为减少滚动跳动：
  - `estimateSize` 仍作为初始估算（task=44/header=34/editor=一个保守值），最终高度由测量覆盖。
  - 滚动容器上设置 `overflow-anchor: none`，避免浏览器 scroll anchoring 与虚拟化计算冲突。
  - 展开/收起后，必要时使用 `scrollToIndex(index, { align: 'auto' | 'start' })` 保证正在编辑的条目可见。

**References:**

- TanStack Virtual v3 动态尺寸示例（measureElement + data-index）：
  - https://github.com/TanStack/virtual/blob/main/examples/react/dynamic/src/main.tsx
- Virtualizer API（measureElement/scrollToIndex 等）：
  - https://tanstack.com/virtual/latest/docs/api/virtualizer

**Alternatives considered:**

- 放弃虚拟滚动：不满足规模要求。
- 仅对 editor 行测量：可做但会增加“部分测量/部分估算”的复杂度；优先全量挂载测量以保持一致性（仅对可见行生效）。

### 3) 打开/收起：保持单一 openTaskId，会话内阻止切换到另一任务

**Decision:**

- 保持当前全局 `openTaskId` 语义：一次只允许一个任务处于编辑展开状态。
- 当 `openTaskId` 非空时，新的 open 请求不自动切换到另一任务（避免在缺乏跨组件 editor ref 的情况下发生“未 flush 就卸载”的丢稿风险）。
- 收起手势：`Escape`、`Cmd/Ctrl+Enter` 与显式点击标题行/再次 Enter（具体以实现选择为准），收起前必须 `flushPendingChanges()`。

**Rationale:**

- 复用既有 Overlay 的“单一编辑会话”约束，可显著降低状态协调复杂度。
- 不引入跨页面/跨列表组件的 editor handle 注册协议，减少架构扩散。

**Alternatives considered:**

- 允许切换并自动 flush：需要在 `openTask()` 能访问当前 editor handle 的前提下实现（例如注册全局 ref 或事件总线），复杂度与风险更高，可在后续迭代补齐。

### 4) 键盘事件与焦点：输入优先，列表导航不抢键

**Decision:**

- 行内 editor 区域必须拦截并阻止冒泡的键盘事件（至少包括：ArrowUp/Down、Enter、Space），防止被列表容器的 `onKeyDown` 处理（`TaskList` 当前会对 Space/Enter/Arrow 做全局导航与 toggle）。
- 收起后焦点恢复到触发点（沿用现有 `[data-task-focus-target]` 机制），保证键盘可连续导航。

## Risks / Trade-offs

- **[滚动跳动/重排]** 行内 editor 高度变化（输入 notes、增删 checklist）可能导致可视区域抖动 → 启用 `measureElement` + 合理 `estimateSize`；必要时在展开后用 `scrollToIndex(..., align:'auto')` 纠正视口；滚动容器设置 `overflow-anchor:none`。
- **[键盘冲突]** 编辑区按键被列表捕获（Space 误切 done、Arrow 改 selection）→ editor 区域使用 `onKeyDownCapture`/`stopPropagation`，或在列表 handler 中忽略来自输入控件的事件。
- **[任务移动导致消失]** 保存规则可能改变任务归属（例如 Inbox 自动转 Anytime、schedule 改变 list）→ 收起时触发一次刷新（沿用 `bumpRevision` 思路），并在列表刷新后若 openTaskId 不再可见，自动收起并恢复焦点。
- **[样式一致性]** 现阶段未引入 shadcn/ui，行内编辑样式需要在现有 `src/index.css` 中谨慎扩展，避免与未来迁移冲突 → 新增样式尽量局部、语义化命名，避免全局覆写 `.input`/`.button` 基类。
- **[可访问性]** 从 modal 迁移到 inline 后，不再使用 aria-modal/focus trap → 需要明确 editor 区域的可访问名称与焦点恢复策略；按钮必须有 `aria-label`（若仅图标）。
