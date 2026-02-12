## Context

- 当前领域页（`/areas/:areaId`）在 `TaskList` headerActions 中直接渲染多个按钮（重命名/删除/+ 项目），标题区信息密度偏高。
- Project 页已实现统一的标题栏溢出菜单（`...`）并在菜单内提供 tags 管理子视图（新建 tag + 勾选绑定 + 立即持久化）。
- 数据层面，Area 的 tags 关系能力已存在：`window.api.area.getDetail(areaId)` 返回 `{ area, tags }`；`window.api.area.setTags(areaId, tagIds)` 以输入顺序原子替换（约束由 `project-area-tags` spec 提供）。
- Content Bottom Bar 在 `AppShell` 统一渲染；当前仅在 Project 路由下追加 `+ Section`。需要以同样方式在 Area 路由下追加 `+ Project`。

约束：
- 仅做 UI 与交互组织优化，不引入新依赖，不改 IPC 边界。
- 保持键盘优先与可访问性：菜单可 Escape 关闭、点击外部关闭、关闭后焦点回到触发按钮。

## Goals / Non-Goals

**Goals:**
- 领域页标题栏收敛为单一 `...` 按钮，降低噪声并与 Project 页保持一致。
- `...` 菜单提供领域 tags 管理入口（可新建 tag、可勾选绑定到领域）以及删除领域。
- 删除领域后导航至 `/today`，避免用户停留在已删除资源路由。
- 在 `/areas/:areaId` 且未打开任务编辑器时，底栏提供 `+ 项目`，创建后跳转到新项目并进入标题编辑。

**Non-Goals:**
- 不在领域页主界面新增 tags chips 展示（可作为后续迭代）。
- 不调整 Area/Project/Tag 的数据模型与 IPC API（复用既有 `getDetail/setTags`）。
- 不重构 ProjectMenu 为通用组件（本变更允许小范围复制以保持改动最小）。

## Decisions

1) 领域页使用 Project 页同款溢出菜单交互模型
- 采用 anchored popover（`...` 按钮为 anchor）+ portal 到 `document.body`。
- 支持：点击外部关闭、Escape 关闭、关闭后恢复焦点到 `...`。
- 菜单内部使用“root view / tags view”的两级视图结构，以降低 root 的拥挤。

替代方案：直接在 headerActions 保留多个按钮。
- 放弃原因：与目标（降噪与一致性）相悖。

2) tags 管理 UI 复用 ProjectMenu 的 tags 子视图模式
- tags view 显示：输入框（Enter 创建 tag）+ tags 列表（checkbox 勾选绑定）。
- 持久化：勾选变化时调用 `window.api.area.setTags(areaId, nextTagIds)`；创建 tag 成功后刷新 tag list 并保持交互连续。

替代方案：使用独立对话框（Dialog/Sheet）。
- 放弃原因：现有代码已用 popover 模式，且本变更仅做交互组织优化。

3) AreaPage 数据读取策略
- 在页面 refresh 侧优先读取 `area.getDetail`（同时获得 tags），减少菜单打开时的额外请求与状态分叉。

替代方案：仅在打开 tags view 时读取 detail。
- 放弃原因：容易形成“页面 state vs 菜单 state”双源，且后续若要展示 tags chips 会再次改动数据流。

4) 删除领域后的导航
- 删除确认通过后执行 delete，并导航至 `/today`。
- 这样可以避免在 `/areas/:id` 看到 NOT_FOUND 的错误横幅，同时与 Project 删除后的体验对齐。

5) 底栏 `+ 项目` 的放置与行为
- 放在 `AppShell` 的 list-mode bottom bar（`openTaskId === null`）。
- 仅当当前路由匹配 `/areas/:areaId` 时显示。
- 点击后调用 `window.api.project.create({ title: '', area_id: areaId })` 并导航至 `/projects/:id?editTitle=1`。

## Risks / Trade-offs

- 代码重复：AreaMenu 可能复制 ProjectMenu 的部分实现。
  - Mitigation：保持实现局部化；如果后续需要复用，再抽象为共享组件。
- i18n key 不齐：新增 `areaPage.menuTitle`/`aria.areaActions` 等键若未补齐会在 DEV parity check 中报错。
  - Mitigation：在 `shared/i18n/messages.ts` 同步添加中英文键。
- 焦点/可访问性回归：popover 关闭后的焦点恢复不一致会影响键盘流。
  - Mitigation：严格对齐 ProjectMenu 的事件处理（pointerdown capture + Escape + restoreFocus）。
- 错误处理：`setTags/create` 失败时需在菜单内有可见错误反馈。
  - Mitigation：沿用现有的 error banner 样式/文案结构。
