# Refactor sidebar resize handle to border-right pattern

## Goal

消除侧边栏分隔线右侧的白色间隙，将 resize handle 从独立 flex 子元素改为 sidebar 的 `border-right` + 绝对定位拖拽热区。

## What I already know

- 当前 resize handle 是 `.app-shell` 的 flex 子元素，宽 6px，`background: transparent`
- 可见分隔线是 `::before` 伪元素（1px，贴左边缘），右侧 5px 透明
- 透明区域透出 app-shell/body 背景（接近白色），形成白色间隙
- dnd-kit 拖拽时 transform 可能加剧间隙暴露
- 用户选择方案 1：border-right 属于 sidebar，拖拽热区绝对定位叠在右边缘

## Requirements

- 将分隔线从 `.sidebar-resize-handle::before` 改为 `.sidebar` 的 `border-right`
- 将拖拽热区改为 `.sidebar::after` 绝对定位，叠在 sidebar 右边缘
- 移除 `.sidebar-resize-handle` 这个独立 flex 子元素
- 保留所有现有交互：拖拽调整宽度、双击折叠、hover/拖拽时分隔线变粗变色
- 侧边栏折叠时（width=0）拖拽热区仍需可用（`.sidebar-reveal-zone` 已有此功能）
- content 区域直接紧贴 sidebar，不再有 6px 间隙

## Acceptance Criteria

- [ ] 浅色/深色主题下分隔线右侧无白色/异色间隙
- [ ] 拖拽调整宽度功能正常
- [ ] 双击折叠/展开功能正常
- [ ] hover 和拖拽时分隔线视觉反馈（变粗变深）正常
- [ ] 侧边栏折叠后，reveal zone 正常触发展开
- [ ] dnd-kit 拖拽排序时不暴露间隙

## Definition of Done

- Lint / typecheck 通过
- `npm run dev` 手动验证无视觉回退
- 无新增 JS 逻辑，纯 CSS + JSX 结构调整

## Out of Scope

- 不改变 sidebar 宽度计算逻辑
- 不改变 dnd-kit 拖拽排序逻辑
- 不调整 reveal zone 行为

## Technical Approach

1. CSS：`.sidebar` 加 `border-right: 1px solid var(--border)` + `position: relative`
2. CSS：新增 `.sidebar::after` 作为 7px 宽绝对定位拖拽热区（`right: -3px`，中线对齐 border）
3. CSS：移除 `.sidebar-resize-handle` 及其 `::before` 规则
4. CSS：hover/拖拽状态改为 `.sidebar::after:hover` + `.sidebar.is-resizing::after`，并在 `.sidebar` 上加 `.is-resizing` 时让 `border-right` 变粗变色
5. JSX：移除 `<div className="sidebar-resize-handle">` 元素
6. JSX：将 resize handle 的 `onPointerDown` 和 `onDoubleClick` 移到 `<aside>` 上（或 `::after` 通过 `pointer-events` 穿透）
7. JSX：`isDraggingSidebar` 状态类名从 `sidebar-resize-handle.is-dragging` 改到 `<aside>` 上

## Technical Notes

- `AppShell.tsx:1799-1805` — resize handle JSX
- `index.css:176-204` — resize handle CSS
- `index.css:164-174` — sidebar CSS
- 拖拽热区 `::after` 需 `pointer-events: auto`（sidebar 本身 `pointer-events: auto`）
- hover 效果需要 `::after:hover`，但 `::after` 本身是透明区域——需确保 `::after` 可接收指针事件
