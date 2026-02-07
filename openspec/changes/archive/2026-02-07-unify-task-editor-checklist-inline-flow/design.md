## Context

当前 Checklist 交互集中在 `src/features/tasks/TaskEditorPaper.tsx` 的 `Checklist` 组件（约 `:1603` 起），采用“独立新增输入框 + Add 按钮 + Delete 按钮 + prompt 重命名”的模式。

在 inline 变体中，空 checklist 通过 Action Bar 的 `Checklist` 按钮触发展开与聚焦（`openChecklistAndFocus`）；overlay 复用同一 `Checklist` 组件，但交互语义与 inline 目标体验未统一。

已知约束：

- `shared/schemas/checklist.ts` 对 `title` 仍要求 `min(1)`，空标题不能直接持久化。
- Checklist 继续使用既有 `window.api.checklist.create/update/delete` 通道，不新增 IPC。
- `task-editor-auto-save` 约束要求 checklist 修改不能重置任务字段草稿。
- 列表层存在键盘快捷键（Arrow/Enter/Space），编辑区必须避免冒泡冲突。
- `src/app/selfTest.ts` 与 `openspec/specs/task-inline-editor/spec.md` 当前依赖旧的新增输入框/删除按钮语义。

## Goals / Non-Goals

**Goals:**

- 在 inline + overlay 中统一 Checklist 行内编辑体验。
- 空 checklist 入口点击后立即创建一条空行并进入编辑焦点。
- 在 checklist 行内按 Enter 时，提交当前行并创建下一行。
- 当标题提交为空时，删除已持久化项或丢弃临时空项。
- 移除独立新增输入框与显式 Delete 按钮，不再依赖 prompt 重命名。
- 保持现有 API/schema 与 auto-save 隔离约束不变。

**Non-Goals:**

- 不修改 checklist 数据库结构或放宽 `title min(1)` schema 约束。
- 不新增 checklist 排序/拖拽重排能力。
- 不重构 TaskEditor 的整体架构（仅聚焦 Checklist 交互流）。
- 不改变任务打开/关闭全局语义（如 Enter 打开、Esc/Cmd+Enter 收起等）。

## Decisions

### 1) 使用本地“临时行”视图模型承载空标题编辑态

**Decision:**
Checklist 维护本地行视图（含稳定本地 key + 可选持久化 id），允许存在未持久化的临时空行；仅在提交为非空标题时调用 `create`。

**Rationale:**

- 后端 schema 要求 title 非空，无法直接持久化“空 checklist”。
- 本地临时行可以满足“点击即创建并编辑”的交互目标，同时保持 API 不变。

**Alternatives considered:**

- 放宽 schema 允许空标题持久化：会扩大 DB/API 影响面，并引入无效脏数据风险，拒绝。

### 2) 统一提交语义：Enter 提交并新建下一行，Blur 仅提交当前行

**Decision:**

- `Enter`（非 IME 组合态）提交当前行：
  - 非空：create/update 成功后在下方插入空行并聚焦。
  - 为空：持久化行 delete；临时行本地移除。
- `Blur` 提交当前行但不自动新建下一行；空标题同样执行删除/丢弃语义。

**Rationale:**

- 满足键盘优先连续输入。
- 避免在 `onChange` 阶段即时删除导致误删或光标跳动。

**Alternatives considered:**

- 仅 Enter 提交、Blur 不提交：容易产生未提交草稿，关闭前语义不稳定，拒绝。

### 3) 聚焦恢复以“行 key”驱动，删除后按邻近规则回退

**Decision:**

- 为每行输入维护 ref 映射与待聚焦 key。
- 插入新行后聚焦新行；删除后优先聚焦下一行，其次上一行。
- inline 在“无持久化项且无活动临时行”时收起 checklist 区域并把焦点回退到 `Checklist` 入口按钮。

**Rationale:**

- 防止 create/delete 异步完成后焦点漂移。
- 保持 inline 空态收起语义与既有行为一致。

**Alternatives considered:**

- 依赖 DOM 顺序自动聚焦：在异步更新下不稳定且易受重渲染影响，拒绝。

### 4) 持久化仍走现有 checklist API，且与任务草稿保存隔离

**Decision:**

- Checklist 继续直接调用 `checklist.create/update/delete` 并增量更新 `detail.checklist_items`。
- 不把 checklist 合并到 `task.update` 的 debounce worker。
- 为关闭/切换安全，Checklist in-flight 请求需要可等待（纳入 flush 关注范围）。

**Rationale:**

- 延续现有“子资源独立持久化”模式，降低回归面。
- 避免 checklist 操作重置 title/notes 草稿。

**Alternatives considered:**

- 统一改成 task 级 patch 提交：会放大耦合并增加冲突处理复杂度，拒绝。

### 5) 规格与自测同步迁移到新交互断言

**Decision:**

- 更新 `task-inline-editor` 与 `task-editor-overlay-paper` delta specs，使其描述行内 checklist 交互。
- 更新 `src/app/selfTest.ts` 断言：从“Add 输入框 + Delete 按钮”迁移为“点击入口创建并聚焦首行输入、Enter 连续创建、空标题提交删除”。

**Rationale:**

- 避免实现与规格/回归测试脱节。

## Risks / Trade-offs

- **[键盘冲突]** Enter/Backspace 冒泡到列表层导致误触发导航或 toggle → 在 checklist 输入层 `stopPropagation` 并保留现有 editor 捕获策略。
- **[IME 误触发]** 中文/日文输入组合态按 Enter 触发新建下一行 → 仅在 `isComposing=false` 时执行 Enter 提交。
- **[焦点抖动]** create/delete 异步返回顺序导致焦点跳转 → 以稳定本地 key 追踪焦点目标，忽略过期焦点请求。
- **[收起时未落盘]** close/switch 期间 checklist 请求仍在 in-flight → flush 阶段等待 checklist 持久化完成；失败时阻止收起并定位错误。
- **[虚拟列表高度波动]** 连续增删 checklist 行造成可视抖动 → 复用现有动态测量策略并在验证中覆盖快速创建/删除路径。
