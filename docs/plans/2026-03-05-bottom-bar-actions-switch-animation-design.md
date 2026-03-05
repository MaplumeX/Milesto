# 底栏按钮切换动效（任务编辑进入/退出）设计

## 背景

当前内容区底栏（`.content-bottom-bar`）在两种状态间切换时是“瞬切”：

- **列表态**（`openTaskId === null`）：显示“新增任务/项目/分组”等按钮 + `ContentBottomBarActions`（`variant="list"`）。
- **编辑态**（`openTaskId !== null`）：显示 `ContentBottomBarActions`（`variant="edit"`）+ “删除/更多”等按钮。

当用户进入任务内联编辑器（`openTaskId` 由 `null` 变为 taskId）时，底栏按钮会整体切换；目前缺少过渡反馈，显得突兀。

## 目标

- 为底栏按钮组切换提供**克制**的动效：符合 `docs/ui.md`（120–200ms、reduced-motion 兼容）。
- 视觉语言：**“卡片切换”**风格，且为**先退出再进入**（退出完成后再进入）。
- 不改变现有业务逻辑、按钮语义、IPC/数据边界。
- 不引入新依赖（仓库已包含 `framer-motion`）。

## 非目标

- 不做共享元素（Shared element）/复杂编排动画。
- 不改变底栏按钮的内容与排列策略。
- 不为其他区域（侧边栏、详情面板）额外引入动效。

## 方案（推荐）：framer-motion `AnimatePresence`（`mode="wait"`）

在 `src/app/AppShell.tsx` 的 `.content-bottom-bar` 内，将“列表态按钮组”和“编辑态按钮组”作为两个 **keyed** 容器渲染，并用 `AnimatePresence mode="wait"` 实现：

- **退出（exit）**：`opacity: 0` + `y: +10`（下滑淡出），时长约 `120ms`。
- **进入（enter）**：`opacity: 0` + `y: +10` → `opacity: 1` + `y: 0`（上滑淡入），时长约 `160ms`。
- 退出阶段设置 `pointerEvents: 'none'`，避免用户在淡出过程中误触旧按钮。
- `initial={false}`，避免首屏渲染出现进入动画。

### reduced-motion

复用现有 `usePrefersReducedMotion()`（`src/features/tasks/dnd-drop-animation.ts`）：

- `prefersReducedMotion === true` 时直接按现状瞬切，不渲染 motion 包裹层（或将过渡时长置 0）。

### 与现有交互的兼容性约束

必须保持 `.content-bottom-bar` 上的属性语义不变：

- `data-content-bottom-actions` / `data-content-bottom-actions-edit` 用于自测与内联编辑器的“点击底栏不触发关闭”判断（见 `src/features/tasks/TaskEditorPaper.tsx`）。
- 动效仅影响内部按钮组容器；外层 DOM 与 data-attributes 保持一致，避免改变 `closest('[data-content-bottom-actions-edit="true"]')` 的匹配范围。

## 风险与对策

- **按钮组切换期间的短暂不可交互**：符合“先退出再进入”选择；退出期禁用指针事件以提升确定性。
- **底栏弹出层（popover）残留**：`ContentBottomBarActions` 的 popover 由组件自身 createPortal 渲染；退出动画期间仍可短暂存在，但会在组件卸载后消失。若后续观察到突兀，可在切换触发时主动关闭 popover（不在本次范围）。

## 验收标准

- 从列表态进入任务编辑态时：底栏按钮组下滑淡出，退出完成后新按钮组上滑淡入。
- 从编辑态退出回列表态时：同样按“先退出再进入”的方向执行。
- 开启 reduced-motion 偏好（或自测参数）时：无动画，瞬切。
- 不影响现有自测流程（`src/app/selfTest.ts`）与编辑器“点击底栏不关闭”行为。

## 测试策略

- 最小回归：运行自测 `npm run dev` + `selfTest=1` 流程（现有 `src/app/selfTest.ts` 已覆盖底栏在编辑态/列表态的存在性断言）。
- 手动：在任务列表中快速进入/退出编辑器，多次切换，确认不出现按钮可点击错位/闪烁/卡顿。

