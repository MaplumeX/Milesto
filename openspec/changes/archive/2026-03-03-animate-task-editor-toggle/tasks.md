## 1. 依赖与基础设施

- [x] 1.1 安装 `framer-motion` 依赖（npm install framer-motion）
- [x] 1.2 新建 `src/features/tasks/AnimatedTaskSlot.tsx`，实现核心动画容器组件：接收 `isOpen`、`rowContent`、`editorContent`、`onHeightChange`、`prefersReducedMotion` props；使用 `AnimatePresence` 管理进入/退出生命周期；使用 `motion.div` 实现 spring 高度过渡（stiffness:400, damping:30）；编辑器内容 opacity 0→1 + scale 0.98→1.0 进入动画（spring stiffness:300, damping:25）；退出动画 opacity 1→0 + scale 1.0→0.98（tween 100ms easeIn）；内部 ResizeObserver 监听容器高度变化并调用 `onHeightChange`；退出动画期间设置 `pointer-events: none`；`prefersReducedMotion` 为 true 时跳过所有动画

## 2. 列表组件集成

- [x] 2.1 重构 `TaskList.tsx`：将 `openTaskId === t.id` 条件渲染替换为 `AnimatedTaskSlot`，传入 `rowContent`（SortableTaskRow 或 TaskRow）和 `editorContent`（TaskInlineEditorRow），绑定 `onHeightChange` 到 `rowVirtualizer.measureElement`
- [x] 2.2 重构 `ProjectGroupedList.tsx`：同上模式替换条件渲染为 `AnimatedTaskSlot`
- [x] 2.3 重构 `UpcomingGroupedList.tsx`：同上模式替换条件渲染为 `AnimatedTaskSlot`
- [x] 2.4 重构 `LogbookGroupedList.tsx`：同上模式替换条件渲染为 `AnimatedTaskSlot`
- [x] 2.5 重构 `SearchPage.tsx`：同上模式替换条件渲染为 `AnimatedTaskSlot`

## 3. 样式调整

- [x] 3.1 调整 `src/index.css` 中 `.task-row.is-open` 样式：将 padding/border 控制移交给 AnimatedTaskSlot 内部管理，`.is-open` 仅保留语义标识作用；确保动画容器的 `overflow: hidden` 在展开过程中正确裁剪内容

## 4. 验证与调优

- [ ] 4.1 在各列表页面手动验证展开/收起动画流畅度、spring 参数手感、下方行跟随效果
- [ ] 4.2 验证 prefers-reduced-motion 开启时动画完全跳过
- [ ] 4.3 验证 DnD 拖拽与动画不冲突（拖拽开始时编辑器已关闭）
- [ ] 4.4 验证编辑器内容交互不受动画影响（输入、checklist、picker 正常工作）
- [x] 4.5 验证 TypeScript 编译无错误，ESLint 无警告
