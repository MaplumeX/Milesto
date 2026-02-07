## 1. DB Schema + Worker Actions

- [x] 1.1 在 `electron/workers/db/db-worker.ts` 增加 schema migration（`user_version` 2）：为 `areas`/`projects` 增加可空 `position` 列，并创建必要索引
- [x] 1.2 新增 shared zod schema：Sidebar DnD 的 payload/返回值（例如 `shared/schemas/sidebar.ts`：reorder/move inputs）
- [x] 1.3 在 DB worker 新增 action：`sidebar.listModel`（返回按 sidebar 规则排序后的 `{ areas, openProjects }`）
- [x] 1.4 在 DB worker 新增 action：`sidebar.reorderAreas`（lazy 初始化 + 批量写 position，事务）
- [x] 1.5 在 DB worker 新增 action：`sidebar.reorderProjects`（按 `area_id` 作用域，lazy 初始化 + 批量写 position，事务）
- [x] 1.6 在 DB worker 新增 action：`sidebar.moveProject`（单事务：更新 `projects.area_id` + 更新 from/to 两个作用域的 position；失败返回结构化错误）

## 2. IPC / Preload / Types

- [x] 2.1 扩展 `shared/window-api.ts`：增加 `window.api.sidebar.*` 类型定义
- [x] 2.2 更新 `electron/preload.ts`：暴露 `window.api.sidebar.*` 并映射到 `db:sidebar.*` invoke 通道
- [x] 2.3 确认 Main 侧 `db:sidebar.*` 路由到 DB Worker（沿用现有 `db:*` handle/invoke 机制）

## 3. Sidebar Renderer DnD（指针拖拽）

- [x] 3.1 在 `src/app/AppShell.tsx` 将 sidebar 数据源切换为 `window.api.sidebar.listModel()`（避免影响其它页面的字母序 list API）
- [x] 3.2 为 Sidebar 的 Projects/Areas 区域引入 `@dnd-kit`：定义 draggable IDs、container IDs、`openItemsByContainer` 草稿结构、snapshot 回滚
- [x] 3.3 处理空 Area drop：为每个 Area 提供可 droppable 的空状态/尾部 dropzone，确保可拖入
- [x] 3.4 实现 `DragOverlay`（Area overlay + Project overlay），并在原列表中隐藏 active item，保证拖拽手感稳定
- [x] 3.5 处理拖拽与点击导航冲突：设置合适的 sensor activationConstraint，确保 NavLink 点击不被误触拖拽吞掉

## 4. Sidebar Keyboard 等价

- [x] 4.1 为 Area 行实现键盘上移/下移（Cmd/Ctrl+Shift+ArrowUp/Down），并调用 `sidebar.reorderAreas`
- [x] 4.2 为 Project 行实现同组上移/下移（同快捷键），并调用 `sidebar.reorderProjects`

## 5. 错误处理与回滚

- [x] 5.1 在拖拽持久化失败时回滚 UI 到 drag snapshot，并在 sidebar 展示统一错误（只用 code/message）
- [x] 5.2 为 moveProject 的失败路径添加覆盖：确保不会出现“UI 看起来已移动但 DB 未写入”的半套状态

## 6. 数据导入/导出兼容性（可选但推荐）

- [x] 6.1 扩展 `shared/schemas/area.ts` / `shared/schemas/project.ts`：为 position 增加可选/可空字段（保持旧导出文件可导入）
- [x] 6.2 更新导出/导入实现以包含并恢复 position（确保手动排序可随数据迁移）

## 7. 验证

- [x] 7.1 扩展 `src/app/selfTest.ts`：增加 Sidebar DnD 冒烟（重排 Area、重排 Project、跨 Area move、失败回滚至少覆盖一个路径）
- [x] 7.2 运行 `npx tsc -p tsconfig.json` 验证类型检查
- [x] 7.3 运行 `npm run build` 验证构建通过
