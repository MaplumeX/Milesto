## Context

当前任务内联编辑器通过条件渲染在 TaskRow 和 TaskInlineEditorRow 之间切换，没有任何过渡动画。虚拟列表行高从 44px 瞬变到 ~400px，下方所有行的 `translateY` 一帧跳变。5 个列表组件（TaskList、ProjectGroupedList、UpcomingGroupedList、LogbookGroupedList、SearchPage）都重复相同的条件渲染模式。

项目当前无动画库依赖。已有的动画：DnD drop 动画（160ms ease-out，通过 @dnd-kit 配置）和 overlay-paper 进入动画（CSS @keyframes，160ms ease-out）。项目已有 `usePrefersReducedMotion()` hook。

## Goals / Non-Goals

**Goals:**
- 编辑器打开时行高 spring 展开，内容 opacity 0→1 + scale 0.98→1.0 渐现
- 编辑器关闭时反向动画：内容淡出 + 高度 spring 收起
- 动画期间逐帧同步 virtualizer 测量，使后续行平滑跟随
- 尊重 `prefers-reduced-motion`：禁用时直接跳到最终状态
- 提取可复用的 `AnimatedTaskSlot` 组件，消除 5 个列表的重复条件渲染

**Non-Goals:**
- 不改变编辑器的功能行为（输入、保存、关闭逻辑不变）
- 不对 TaskRow 本身做进入/退出动画（行始终存在于虚拟列表中，仅编辑状态有过渡）
- 不实现列表项增删时的布局动画（layout animation）
- 不替换现有 DnD drop 动画实现

## Decisions

### Decision 1: 使用 framer-motion 而非纯 CSS

**选择**: 引入 `framer-motion`（从 `motion/react` 轻量入口导入）

**理由**:
- `AnimatePresence` 原生解决退出动画的生命周期问题（保持组件挂载直到 exit 动画完成）
- Spring 物理动画 API 成熟，无需手动实现 spring 求解器
- `animate` 到 `height: "auto"` 开箱即用，无需手动测量 → 固定高度 → auto 的三步切换
- `onUpdate` 回调可在每帧触发，天然适合驱动 virtualizer 重测量

**备选**:
- 纯 CSS transitions：无法处理退出动画（组件卸载时 CSS transition 无法播放），且 `height: auto` 过渡需要 JS 辅助测量
- react-spring：功能类似但 API 更底层，社区规模和维护活跃度不如 framer-motion

### Decision 2: AnimatedTaskSlot 组件封装

**选择**: 新建 `AnimatedTaskSlot` 组件，统一替换 5 个列表中的条件渲染模式

**接口设计**:
```
Props:
  isOpen: boolean
  rowContent: ReactNode       // 关闭态：TaskRow 或 SortableTaskRow
  editorContent: ReactNode    // 打开态：TaskInlineEditorRow
  onHeightChange: () => void  // 每帧调用，通知 virtualizer 重测量
  prefersReducedMotion: boolean
```

**理由**: DRY 原则——当前 5 个文件重复完全相同的 open/closed 分支逻辑。封装后各列表只需传入 row 和 editor 的 ReactNode。

### Decision 3: Spring 参数规格

**容器高度过渡**:
- `type: "spring"`, `stiffness: 400`, `damping: 30`
- 约 200-250ms 落定，轻微过冲，接近 Things 3 质感

**Editor 内容进入**:
- `opacity: 0 → 1`, `scale: 0.98 → 1.0`
- Spring: `stiffness: 300`, `damping: 25`
- 内容动画跟随容器展开自然启动，无需人为 delay

**Editor 内容退出**:
- `opacity: 1 → 0`, `scale: 1.0 → 0.98`
- Tween: `duration: 0.1s`, `ease: "easeIn"`
- 退出比进入快，不拖泥带水

### Decision 4: 与 virtualizer 的逐帧同步策略

**选择**: 在 `AnimatedTaskSlot` 内部使用 `ResizeObserver` 监听容器实际高度变化，通过 `onHeightChange` 回调触发 `virtualizer.measureElement()`

**理由**:
- framer-motion 的 `onUpdate` 在 spring 动画中每帧触发，但获取的是逻辑值而非 DOM 实际高度
- `ResizeObserver` 直接观察 DOM 元素的实际尺寸变化，与 virtualizer 的 `measureElement` 语义一致
- 这也覆盖了非动画引起的高度变化（如用户输入导致 textarea 增高），保持一致性

**`estimateSize` 无需变更**: 虚拟列表的 `estimateSize` 仍返回 44/400，这只影响未渲染行的预估位置。已渲染行的真实高度由 `measureElement` 决定。

### Decision 5: 退出动画期间禁止交互

**选择**: 退出动画播放期间（~100ms），给编辑器容器添加 `pointer-events: none`

**理由**: 防止用户在编辑器淡出过程中意外点击触发操作。由于退出动画很短（100ms），用户几乎不会注意到这个限制。

### Decision 6: 列表行 CSS 类统一

**选择**: 保留 `.task-row.is-open` 类名用于语义标识，但将原有的 padding/border 样式改由 `AnimatedTaskSlot` 内部控制

**理由**: 动画组件需要控制容器的 overflow 和 padding 时序（展开时先展开容器再显示内容），CSS 类仅用于标识状态。

## Risks / Trade-offs

**[framer-motion 包体积 ~30KB gzipped]** → 可接受。项目是桌面 Electron 应用，bundle 不走 CDN，初始加载不敏感。且这是首个动画库，未来 DnD overlay 等也可受益。使用 `motion/react` 轻量入口可 tree-shake 未用功能。

**[动画期间每帧 measureElement 可能影响性能]** → ResizeObserver 回调已由浏览器节流到渲染帧，且 `measureElement` 只读取一个元素的 `getBoundingClientRect`，成本极低。10k 任务列表下，virtualizer 只重算可见行的位置（overscan=12），不会遍历全部 10k 行。

**[AnimatePresence 延迟卸载编辑器]** → 退出动画期间编辑器仍挂载约 100ms。通过 `pointer-events: none` 和 `isClosing` 标志防止此期间的用户操作和数据保存。

**[Spring 过冲可能导致下方行轻微"弹跳"]** → 这是 Things 3 风格的预期效果。如果用户不喜欢，可通过调高 `damping` 值减弱过冲。
