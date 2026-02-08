## Context

当前 content bottom bar 的 DOM 结构为：

- `.content-bottom-bar`
  - `.content-bottom-left`（承载 Add Task / Add Section 与 actions）
    - `Task` / `Section` 按钮
    - `.content-bottom-action-group`（承载 Schedule / Move / Search，并带 `data-content-bottom-actions="true"`）

这导致布局规则（flex/gap/font/color）被拆散到多个容器中，并且自测对一个中间容器选择器产生依赖。

本变更希望将 bottom bar 结构扁平化，使其成为单一按钮序列，同时保留现有交互（popover anchor、disabled 状态、SearchPanel 打开与聚焦）。

## Goals / Non-Goals

**Goals:**
- 以最小行为风险移除 `.content-bottom-left` 与 `.content-bottom-action-group` 两层容器
- 将 `data-content-bottom-actions="true"` 作为稳定锚点迁移到 `.content-bottom-bar`
- 统一按钮间距为原 action group 的 `8px`
- 自测逻辑适配新结构，不改变测试覆盖的行为断言

**Non-Goals:**
- 不改变 Schedule/Move/Search 的业务语义与交互（仅结构与样式归一）
- 不新增/修改 IPC、数据模型或任务编辑逻辑
- 不重新设计 bottom bar 的视觉样式（仅做必要的 CSS 归并）

## Decisions

1) **以 `.content-bottom-bar` 作为唯一布局容器**
- 选择：将 flex + gap 等布局规则收敛到 `.content-bottom-bar`
- 原因：去掉 “left/right/group” 概念，减少未来扩展时的“应该放哪一组”的歧义
- 备选：保留 `.content-bottom-left` 但移除 `.content-bottom-action-group`
  - 放弃原因：仍然保留 left 的结构分割，未达成“不要区分 left”的目标

2) **将自测锚点迁移到 `.content-bottom-bar`**
- 选择：把 `data-content-bottom-actions="true"` 放到 `.content-bottom-bar`
- 原因：将 “actions 容器” 与 “bottom bar 容器” 合一，减少对中间 wrapper 的依赖
- 影响：`Element.querySelector()` 不匹配自身，`selfTest` 需调整为直接使用 `bottomBar`

3) **`ContentBottomBarActions` 继续作为行为聚合点，但不再渲染 wrapper div**
- 选择：该组件直接返回按钮序列（fragment），popover 仍使用 portal 到 `document.body`
- 原因：保持 popover 管理逻辑的单一职责（focus restore / outside click / escape），同时达成 DOM 扁平化
- 备选：将 buttons 直接内联到 `AppShell`
  - 放弃原因：会把 popover 状态机与更新逻辑散落到 shell，违反 SRP/KISS

## Risks / Trade-offs

- [Risk] CSS 迁移后 gap/hover 边框表现发生细微变化 → Mitigation：复用现有 `.content-bottom-bar .button` hover 规则，仅将 gap 统一到 `.content-bottom-bar`
- [Risk] 自测选择器失效（`querySelector` 不匹配自身） → Mitigation：将 `bottomBarActions` 直接设为 `bottomBar`，保持后续 `findButtonByText` 逻辑不变
- [Trade-off] 失去“actions group”容器可用于独立对齐/分隔的能力 → Mitigation：如后续确需视觉分隔，优先用 `:has()`/伪元素或更轻量的 wrapper，但以需求驱动（YAGNI）

