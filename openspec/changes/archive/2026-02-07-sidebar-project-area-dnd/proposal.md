## Why

Sidebar 里的 Areas / Projects 目前只能按标题字母序展示，无法通过拖拽快速调整顺序，也无法在侧边栏内把 Project 移动到另一个 Area（改变所属）。这和 Project 页内已经支持的 task/section 拖拽体验不一致，且在项目/Area 较多时会显著影响日常整理效率。

## What Changes

- Sidebar 的 Areas 支持拖拽排序（顺序可持久化）。
- Sidebar 的 Projects 支持：
  - 在同一 Area（或未归属组）内拖拽排序（顺序可持久化）。
  - 跨 Area（含未归属组）拖拽移动，改变 `project.area_id`，并可插入到目标列表的任意位置。
- 提供键盘等价操作用于排序（对齐键盘优先原则）。
- 出错时（例如 DB 写入失败）UI 需要回滚到拖拽前顺序，并以统一错误结构提示（只展示 code/message）。

## Capabilities

### New Capabilities
- `sidebar-project-area-dnd`: Sidebar 中 Areas/Projects 的拖拽排序与 Project 跨 Area 移动（含持久化与键盘等价）。

### Modified Capabilities
- 

## Impact

- Renderer：`src/app/AppShell.tsx` 的 Sidebar 导航需要引入 `@dnd-kit` 的 Sortable + 多容器拖拽逻辑，并保持现有路由高亮/点击行为。
- Preload / IPC：需要新增（或扩展）`window.api.*` 的业务级方法，用于持久化 Area/Project 的顺序与 Project 的跨 Area 移动（必须 schema 校验，禁止开放任意 SQL）。
- DB Worker：SQLite schema 需要为 `areas` / `projects` 引入用于持久化排序的字段（预计为可空 `position`），并实现批量重排/移动的事务性写入。
- 数据迁移：需要在不清空用户数据的前提下做向后兼容（默认仍保持字母序；首次拖拽后再写入 position）。
- 验证：需要补充覆盖 Sidebar DnD 的冒烟验证（可复用现有 `src/app/selfTest.ts` 风格）。
