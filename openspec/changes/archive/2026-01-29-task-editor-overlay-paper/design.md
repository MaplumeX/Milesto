## Context

当前任务编辑采用三栏（Sidebar + List + Detail）常驻布局：`src/app/AppShell.tsx` 的 `.content-grid` 同时渲染 `content-main` 与 `src/features/tasks/TaskDetailPanel.tsx`，并由 `src/index.css` 的 `.detail { width: 420px; ... }` 固定右侧编辑区宽度。该布局在长 notes/多字段编辑时会显著压缩可读空间。

交互上，当前“选中即打开详情”耦合在一起：`TaskSelectionContext` 只提供 `selectedTaskId`，`TaskDetailPanel` 在 `useEffect([selectedTaskId, revision])` 中拉取 `window.api.task.getDetail(...)` 并 `setDraft(...)`。

项目已有一个可参考的 overlay 模式：Command Palette（`src/app/CommandPalette.tsx` + `src/index.css` 的 `.palette-overlay`/`.palette`）。它使用 `position: fixed; inset: 0` 的 scrim，并通过 `Escape` 关闭与 `setTimeout(..., 0)` 聚焦输入框；目前没有通用的 focus trap 与显式的背景滚动锁定。

约束与风险：

- 性能：任务列表使用 `@tanstack/react-virtual` 虚拟滚动（例如 `src/features/tasks/TaskList.tsx`），不适合“行内展开导致动态高度”方案。
- 事件刷新：全局 `revision/bumpRevision` 广播会触发 `TaskDetailPanel` refetch 并覆盖本地 `draft`（自动保存会放大该问题）。
- 布局：底部栏高度由 `--bottom-bar-height` 控制（`src/index.css`），本变更要求“底部栏可见”。

本设计把任务编辑体验对齐 Things 3：在列表上下文中“原地打开”白纸浮层（Overlay Paper），背景锁定，Return 打开、Esc 关闭，且全字段自动保存。

## Goals / Non-Goals

**Goals:**

- 把任务编辑从三栏常驻右侧面板迁移为 Content 内 Overlay Paper（不挤压列表宽度），底部栏保持可见。
- 解耦 selection 与 open：单击仅选择；Return 打开当前选中任务；关闭后焦点回到原列表位置。
- 打开 Overlay Paper 时锁定背景列表交互（滚动/点击）。
- 任务编辑全字段自动保存（title/notes/base_list/project/section/area/scheduled/due），具备明确的保存状态与失败恢复。
- 不引入新的 IPC/API 形态；复用现有 `window.api.task.getDetail/update` 等。

**Non-Goals:**

- 不做“列表行内展开（accordion）”与动态高度虚拟化。
- 不在本变更内引入新的全局状态库（如 zustand/react-query）或重建 UI 组件体系。
- 不解决多窗口/多设备并发编辑与冲突合并问题（假设单用户本地编辑）。
- 不全面重做现有页面的滚动结构（仅在 Overlay 打开时做背景锁定）。

## Decisions

### 1) 分离 `selectedTaskId` 与 `openTaskId`

**Decision:** 保留 `selectedTaskId` 用于列表高亮/键盘导航；新增 `openTaskId` 表示 Overlay Paper 当前打开的任务。

**Rationale:**

- 解决“键盘上下移动 selection 导致编辑器跟着跳”的核心问题。
- 让 Return/Esc/Cmd+Return 成为清晰、可预测的编辑入口/退出手势。

**Alternatives considered:**

- 继续沿用“选中即打开”：与目标体验冲突。
- 用路由承载打开态（例如 `/task/:id`）：会把“原地展开”变成“跳页”，也引入更多导航状态与回退复杂度。

### 2) Overlay Paper 的挂载位置与覆盖范围

**Decision:** Overlay Paper 挂载在 `content-main` 内（而非全窗口 fixed overlay），覆盖 `content-scroll` 区域，但 `bottom` 预留 `--bottom-bar-height`，确保底部栏可见；Sidebar 不被覆盖。

**Rationale:**

- 符合“底部栏可见”的产品约束。
- 保持信息架构稳定：Sidebar 仍可见，符合桌面任务应用的空间感。

**Alternatives considered:**

- 全窗口 fixed overlay（类似 `.palette-overlay`）：会覆盖 Sidebar 与底部栏，且需要计算/挖洞才能满足 3A。

### 3) 背景锁定（交互与滚动）

**Decision:** Overlay 打开期间：

- 背景 `content-scroll` 与其内部列表交互不可用（pointer-events/点击/滚动被截断）。
- Overlay 自身成为唯一可滚动容器。
- `Esc`/关闭按钮可退出；点击 scrim 不退出（避免误触）。

**Rationale:**

- 你已选择“背景锁定”（2B），这是保持专注与避免误操作的关键。
- 当前应用的滚动发生在 `.content-scroll` 与页面内部容器上，单靠 `body { overflow: hidden }` 并不能可靠阻断背景滚动。

**Alternatives considered:**

- 仅用 scrim 覆盖：wheel 事件可能仍能穿透导致背景滚动（Command Palette 目前就没有显式锁定）。
- 允许背景交互：与目标体验不一致，也会引入 selection/open 混乱。

### 4) 焦点管理与可访问性

**Decision:**

- 打开 Overlay 时将焦点置于标题输入框；若为新建空标题任务，自动 select 文本（复用现有 TaskDetailPanel 的行为）。
- 关闭 Overlay 后将焦点恢复到触发打开的列表行（或其标题按钮）。
- 实现最小可用的 focus trap（Tab 循环在 Overlay 内），并将 Overlay 标记为 `role="dialog" aria-modal="true"`。

**Rationale:**

- 键盘优先是 UI 规范硬要求（`docs/ui.md`）。
- 目前 Command Palette 没有 focus trap；Overlay Paper 是高频编辑入口，更需要可访问性保障。

**Alternatives considered:**

- 不做 focus trap：用户可能 Tab 到背景控件，造成“背景锁定”失效感。
- 引入第三方依赖（Radix/Dialog 等）：超出本变更范围（非目标）。

### 5) 自动保存：本地 draft 为真相源，串行化保存队列

**Decision:**

- Overlay 打开期间，编辑器的 `draft`（本地状态）是真相源；保存成功后仅更新本地“已保存快照”，不触发 refetch 覆盖 `draft`。
- 自动保存使用“串行化 + 去抖 + 关闭时 flush”的状态机：

  - title/notes：短去抖（例如 300-500ms）
  - select/date 等字段变更：可更短去抖或立即提交
  - 任何时刻只允许一个 `task.update` in-flight；若保存中又有改动，完成后用最新快照再提交一次
  - 关闭（Esc/Close/Cmd+Return）会触发 flush：成功后才关闭；失败则留在 Overlay 并提示错误

**Rationale:**

- `window.api.task.update` 支持 patch 语义（`shared/schemas/task.ts` 的 `TaskUpdateInputSchema` 字段均 optional；DB worker 只更新传入字段），适合增量保存。
- 避免写放大（每击键一次 DB write）与 UI 抖动。

**Alternatives considered:**

- 每次保存后 `bumpRevision()` 并 refetch：会触发 `TaskDetailPanel` 的 `useEffect([selectedTaskId, revision])` 重置 draft，导致输入丢失窗口。

### 6) 与 `revision/bumpRevision` 的关系：编辑态不随 revision refetch

**Decision:**

- Overlay 编辑态不订阅 `revision` 触发的 refetch；只在打开时（`openTaskId` 变化）拉取一次 detail。
- 自动保存过程中不调用 `bumpRevision()`；在关闭 Overlay 时统一调用一次 `bumpRevision()`，让列表/侧边栏在编辑结束后刷新。

**Rationale:**

- 规避“自触发覆盖”和“跨组件干扰”两类风险：任何 `bumpRevision()`（包括新建项目、标签操作等）都可能导致 refetch 覆盖草稿。
- 关闭时统一刷新，避免编辑过程中列表结构变动带来的空间跳跃。

**Alternatives considered:**

- 引入细粒度事件（如 `task:updated:{id}`）替代全局 revision：方向正确，但超出本变更范围；可作为后续优化。

### 7) Tags / Checklist 等子资源的处理

**Decision:**

- Tags/Checklist 的增删改操作仍然走现有 API（`task.setTags`、`checklist.*`），但在 Overlay 内以本地状态增量更新 UI，不依赖 refetch。
- 关闭 Overlay 后再统一 `bumpRevision()`，让其他页面在“编辑会话结束”时获取最新数据。

**Rationale:**

- 当前实现大量依赖 `bumpRevision()` + `getDetail` 来刷新 UI；在自动保存与 Overlay 编辑态下会导致草稿覆盖风险。

### 8) 新建任务的打开策略（避免体验回退）

**Decision:**

- 通过底部栏 `+ Task` 创建的“空标题任务”应自动打开 Overlay Paper 并聚焦标题（当前三栏模式下用户创建后会直接看到右侧详情并自动聚焦）。

**Rationale:**

- 若新建后仅选中不打开，会让用户多一次 Return 操作，属于明显回退。

## Risks / Trade-offs

- **[自动保存写放大]** → 去抖 + patch 更新 + 串行化队列；尽量只在字段稳定后提交。
- **[保存失败导致无法关闭]** → 关闭走 flush：失败时保持 Overlay 打开并提供重试；始终保留本地草稿。
- **[编辑中列表/视图不刷新（延迟一致性）]** → 关闭时统一 `bumpRevision()`；必要时可做轻量的本地 title 预览（非必须）。
- **[焦点/键盘处理复杂]** → 采用最小 focus trap；明确 Esc/Enter/Cmd+Return 行为；避免与 Command Palette 叠加。
- **[虚拟列表焦点回退不稳定]** → 打开时记录触发元素（或 task id），关闭时优先聚焦同一行；背景锁定可降低元素卸载概率。
- **[Overlay 与 Command Palette 层级冲突]** → 约定 z-index：Command Palette(50) 永远在最上；Overlay Paper 低于其层级。

## Migration Plan

1. 在 `AppShell` 层引入 `openTaskId` 管理与 Overlay 容器（保持 Sidebar 与底部栏结构不变）。
2. 将 `TaskDetailPanel` 的编辑 UI 提取为可复用的“TaskEditorPaper”组件，并适配为 overlay 形态。
3. 修改列表交互：点击只 select；`Enter` 打开 overlay；`Esc`/Close 关闭；新建空任务自动打开。
4. 实现自动保存状态机：本地 draft、串行化保存、去抖、flush-on-close、错误可恢复。
5. 调整刷新策略：编辑期间不 bumpRevision；关闭时 bumpRevision；确保列表刷新后 selection 合理（若任务移出当前列表则选择邻近项或清空）。
6. CSS：引入 overlay/scrim/paper 样式并移除三栏 `.detail` 的依赖；保证 z-index 与响应式行为一致。

## Open Questions

- Overlay 打开时是否禁用 `Cmd/Ctrl + K`（Command Palette）以避免双重 overlay？（建议：禁用或先关闭 overlay 再打开 palette）
- 鼠标用户如何打开（除 Return 外）：双击打开 / 再次点击已选中项打开 / 提供显式按钮？
- 关闭后刷新导致任务不在当前列表时，selection 的默认落点策略是否需要产品确认？
