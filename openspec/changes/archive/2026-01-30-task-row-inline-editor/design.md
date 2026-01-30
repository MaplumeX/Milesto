## Context

当前任务编辑采用“task row + editor row”的双行结构：

- `TaskList` / `UpcomingGroupedList` / `SearchPage` 会在 `openTaskId` 对应任务后插入一条 `task-editor-row`，其中渲染 `TaskInlineEditorRow`。
- `TaskInlineEditorRow` 负责关闭手势（Escape / Cmd(Ctrl)+Enter）与 `flushPendingChanges()`，并通过 `registerOpenEditor()` 让 `AppShell.openTask()` 在切换任务时先 flush。
- 行内编辑器内容由 `TaskEditorPaper variant="inline"` 提供，外层容器为 `.task-inline-paper`（带 border/radius/background），因此视觉上容易形成“第二层卡片”。

本变更将把“展开编辑”收敛到同一条任务行自身：打开后该 `task-row` 变高并承载 editor 内容；标题为输入框；done checkbox 位于 editor 头部；展开态去除第二层 card 皮肤。

约束：

- 列表虚拟滚动（`@tanstack/react-virtual`）必须保留，且支持动态高度变化不重叠。
- 键盘优先：编辑区按键不得触发 listbox 级的 Arrow/Enter/Space 处理。
- 数据安全：收起/切换任务前必须 flush；失败必须阻止收起以避免丢稿。
- done 切换不自动收起；列表刷新仍沿用现有机制（通常在收起或切任务时通过 `bumpRevision()` 触发）。

## Goals / Non-Goals

**Goals:**

- 将任务展开编辑从“插入 editor row”改为“task-row 本身展开变高并渲染 editor”。
- 展开态标题为输入框，头部提供 done checkbox（勾选/取消不触发自动收起）。
- 展开态样式去卡片化：不出现 `.task-inline-paper` 的独立边框/背景层级，整体看起来是同一条 row 展开。
- 保持现有打开/关闭与安全语义：
  - 单击仅 selection，不打开
  - Enter 或双击打开
  - Escape / Cmd(Ctrl)+Enter 收起
  - 收起/切换任务前 flush，失败则阻止
- 保持现有虚拟滚动稳定性与自测覆盖范围（不重叠、滚动跳动受控、焦点恢复）。

**Non-Goals:**

- 不引入新的 UI 库/依赖（继续使用现有 `src/index.css`）。
- 不改变 DB/IPC 结构与 schema（`task.update` / `task.toggleDone` 等保持不变）。
- 不在本次设计里优化“勾选 done 后立即从当前列表移除且 editor 仍保持打开”的复杂语义；本次接受“直到刷新前列表暂时不一致”。
- 不尝试一次解决所有字段编辑/布局重构（仅聚焦行内展开结构与头部 done checkbox + 视觉融合）。

## Decisions

### 1) 虚拟行模型从“插入 editor 行”切换为“单行自增长”

**Decision:**
在 `TaskList` 中不再构造 `Row = task | editor`，虚拟化 `count` 回到 `tasks.length`；当 `openTaskId === task.id` 时，同一个 `li.task-row` 内渲染 editor 内容并让该行高度自适应（通过 `measureElement` 跟踪）。

在 `UpcomingGroupedList` 中继续保留 `rows`（因为 header 行存在），但去掉 `editor` 行类型；展开态将 editor 内容渲染在对应 `task` 行内部。

在 `SearchPage` 中同样去掉 `editor` 行插入逻辑，改为 task 行内部展开。

**Rationale:**

- 满足产品目标：展开态是“同一条任务行”的状态，而不是“任务 + 额外一行”。
- 虚拟列表动态高度已经通过 `measureElement` 跑通（自测依赖这一点）；将测量点从 editor 行迁移到 task 行可以保留整体稳定性。
- 简化 `getItemKey`：无需再维护 `t:`/`e:` 两套 key，避免插入/移除行导致的滚动与测量抖动。

**Alternatives considered:**

- 维持 editor 行，但尝试在视觉上“融合”：虽然可减少代码改动，但结构上仍是两行，难以彻底实现“task-row 是 editor”的语义。

### 2) 关闭/flush 机制保持不变，继续通过 `TaskInlineEditorRow` 承接

**Decision:**
保留 `TaskInlineEditorRow` 作为 editor 容器与关闭控制点（Escape/Cmd+Enter、`flushPendingChanges()`、`registerOpenEditor()`），仅改变其挂载位置（从 `.task-editor-row` 移入 `.task-row.is-open`）。

**Rationale:**

- 复用现有防丢稿机制与任务切换 flush 逻辑（`AppShell.openTask()` 在切换时 flush）。
- 继续利用 `TaskInlineEditorRow` 的 `stopPropagation` 逻辑，避免编辑按键触发 listbox 级处理。

**Alternatives considered:**

- 将 flush/关闭逻辑搬到 `TaskEditorPaper` 或 `TaskList`：会让跨组件协作更紧耦合，并增加回归风险。

### 3) done checkbox 放在 inline header，直接调用 `window.api.task.toggleDone`

**Decision:**
在 `TaskEditorPaper variant="inline"` 的 header 区域加入 done checkbox：

- checked 状态基于当前任务 detail 的 status（done/open）。
- toggle 时调用 `window.api.task.toggleDone(taskId, nextDone)`。
- 成功后仅更新 editor 内部的 `detail.task`（不触发自动收起、不强制全局刷新）。

**Rationale:**

- 打开态不再渲染列表行 checkbox，因此 done 入口必须在 editor 内。
- 复用已有 DB action（`task.toggleDone`），避免新增 IPC API。
- 与本次范围一致：done 切换不自动收起，列表刷新仍由收起/切换任务触发。

**Alternatives considered:**

- 通过 `TaskList` 传入 `onToggleDone` 回调：需要把不同页面的 refresh 策略透传到 editor，耦合更强。

### 4) 视觉融合通过“父级 open 状态下去皮（de-skin）”实现

**Decision:**
不重写 inline editor 的结构，采用 CSS 覆盖实现去卡片化：

- 展开态 `li.task-row` 追加 `is-open` 状态样式，使其容纳整块 editor（从 `display:flex` 转为 column/block）。
- 在 `.task-row.is-open` 下，将 `.task-inline-paper` 的 border/radius/background/padding 置为透明/0，使 editor 视觉融入 row。
- 用 row 自身的 padding/border 作为唯一层级；保留 `.task-inline-section` 的轻分隔线用于内部区域（必要时降低对比度以避免“分割线叠加”）。

**Rationale:**

- 满足“不要第二层卡片”的体验，同时复用现有 DOM 与自测。
- CSS 改动可局部作用于 open 状态，降低对 overlay 模式的影响。

**Alternatives considered:**

- 新写一套纯 row 内联编辑器 UI：代价更大且更易引入行为差异（autosave、checklist、tags 等）。

## Risks / Trade-offs

- **[列表语义暂时不一致]** 打开态在 editor 内切换 done 后，当前页面列表数据不立即刷新 → 接受该行为；通过 editor 头部状态/checkbox 反馈让用户明确已切换；在收起/切换任务时 `bumpRevision()` 仍会把视图拉回一致。
- **[虚拟滚动测量抖动]** 动态高度从 editor 行迁移到 task 行后，测量/锚定可能变化 → 继续使用 `measureElement`；在展开/内容增长（notes/checklist）时确保不重叠；必要时保持保守的 `estimateSize`。
- **[键盘事件冲突]** editor 内 Space/Arrow/Enter 被 listbox handler 捕获 → 依赖 `TaskInlineEditorRow` 已有 `stopPropagation`；如新增 checkbox，确保其键盘交互仍在 editor 容器内被拦截。
- **[焦点恢复依赖 DOM 结构]** 收起后 `AppShell` 会寻找 `[data-task-focus-target][data-task-id]` → 打开态该按钮不存在属预期；收起后 task 行恢复渲染按钮即可被找到。自测里缓存旧按钮引用可能失效，需要更新自测选择器策略。
- **[样式叠加/边框重复]** row 自带 `border-bottom`，editor 内部也有 section 分隔线 → open 状态下调整 `.task-inline-section` 分隔线对比度/间距，避免视觉噪声。

## Migration Plan

1) 先改列表渲染结构（`TaskList` / `UpcomingGroupedList` / `SearchPage`）为单行展开，并确保基础打开/收起仍可用。
2) 在 inline editor header 加入 done checkbox，并确保不会触发 listbox 级 Space toggle。
3) 加入 `.task-row.is-open` 的去皮样式覆盖，完成“无第二层卡片”的视觉融合。
4) 更新 `src/app/selfTest.ts` 中对 `.task-title-button` / editor row 结构的假设（避免持有旧 DOM 引用）。
5) 如发现回归，可临时保留旧的 `.task-editor-row` 路径作为 feature-flag（仅在本地/开发使用），便于快速回滚；最终以 mainline 结构为准。

## Open Questions

- done checkbox 在 Logbook（done 列表）中是否允许取消完成并留在原列表直到收起刷新？（当前设计接受；若不希望，需在 logbook view 禁用或提示。）
- 展开态是否需要为 editor 提供一个明确的“行内可访问名称/role”调整（当前仍处于 listbox DOM 中，ARIA 语义可能不理想）。
