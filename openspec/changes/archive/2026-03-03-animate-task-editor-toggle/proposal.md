## Why

当前任务编辑器的打开/关闭是瞬间的条件渲染切换（44px→400px 一帧跳变），缺乏视觉连续性。Things 3 的编辑器以平滑的 spring 展开/收起动画著称，能让用户清晰感知"当前行正在展开为编辑器"，而非"列表突然跳了一下"。引入此动画可以显著提升交互质感。

## What Changes

- 引入 `framer-motion` 作为动画库依赖
- 新建 `AnimatedTaskSlot` 组件，封装编辑器展开/收起的 spring 高度动画、内容 opacity + 微妙 scale 过渡、以及退出动画生命周期管理
- 所有使用内联编辑器的列表组件（TaskList、ProjectGroupedList、UpcomingGroupedList、LogbookGroupedList、SearchPage）统一替换为 `AnimatedTaskSlot`，消除各处重复的条件渲染模式
- 动画期间逐帧通知 `@tanstack/react-virtual` 重新测量行高，使后续行平滑跟随位移
- 尊重 `prefers-reduced-motion` 系统设置，禁用动画时回退到瞬间切换

## Capabilities

### New Capabilities
- `task-editor-toggle-animation`: 任务内联编辑器的 spring 展开/收起动画，包含高度过渡、内容淡入淡出、微妙 scale 效果，以及与虚拟列表的逐帧同步

### Modified Capabilities
- `task-inline-editor`: 新增动画行为要求——编辑器打开/关闭 MUST 有平滑过渡动画而非瞬间切换

## Impact

- **新依赖**: `framer-motion`（~30KB gzipped）
- **受影响文件**:
  - `src/features/tasks/AnimatedTaskSlot.tsx`（新建）
  - `src/features/tasks/TaskList.tsx`
  - `src/features/tasks/ProjectGroupedList.tsx`
  - `src/features/tasks/UpcomingGroupedList.tsx`
  - `src/features/logbook/LogbookGroupedList.tsx`
  - `src/pages/SearchPage.tsx`
  - `src/index.css`（可能微调 `.task-row.is-open` 样式）
- **无 API/DB 变更**: 纯前端 UI 改动
- **性能考量**: 动画期间每帧触发 virtualizer 重测量，需确保 10k 任务列表下帧率稳定
