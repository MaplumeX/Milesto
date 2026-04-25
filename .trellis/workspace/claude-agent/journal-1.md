# Journal - claude-agent (Part 1)

> AI development session journal
> Started: 2026-04-18

---



## Session 1: 任务元数据 UI 重设计（方案 A - 紧凑图标化）

**Date**: 2026-04-18
**Task**: 任务元数据 UI 重设计（方案 A - 紧凑图标化）
**Branch**: `master`

### Summary

采用紧凑图标化方案重设计任务条目的元数据 UI。未展开行：用图标替代文本前缀标签，截止日紧迫时变红色。展开编辑器：元数据 chip 改为图标+文本+下拉箭头，移除底部操作栏，未设置字段显示为 + 占位 chip，checklist 移至元数据 band 上方。新增 4 个 SVG 图标组件和日期紧迫性判断工具函数。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `01576a2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: 标签筛选功能实现

**Date**: 2026-04-22
**Task**: 标签筛选功能实现
**Branch**: `master`

### Summary

在 Today/Anytime/Someday/Area/Project 五个页面添加横向标签 Pill 筛选栏。后端 TaskListItem 新增完整 tag_ids 字段，前端新增 TagFilter 组件和 useTaskTagFilter hook，支持多标签 OR 逻辑过滤。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `42559ac` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: 重构标签编辑器：统一为 TagPicker 组件

**Date**: 2026-04-22
**Task**: 重构标签编辑器：统一为 TagPicker 组件
**Branch**: `master`

### Summary

将分散在 TaskEditorPaper、ProjectPage、AreaPage、sidebar context menu、task context menu 中的 5 处标签编辑实现统一替换为 TagPicker 组件，支持搜索、创建、键盘导航。仅保留 select 模式，移除 manage 模式（rename/delete/color）。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `eebbe03` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: Remove cloud sync support

**Date**: 2026-04-23
**Task**: Remove cloud sync support
**Branch**: `master`

### Summary

Removed cloud sync UI, IPC, main-process runtime, DB sync metadata, AWS dependency, and related tests/specs.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `071354c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 5: 实现云端实时同步 + 自部署服务端

**Date**: 2026-04-23
**Task**: 实现云端实时同步 + 自部署服务端
**Branch**: `master`

### Summary

完成 Milesto 云端实时同步功能：客户端同步引擎（WebSocket + E2EE + LWW）、同步设置 UI、服务端独立仓库（Node.js + SQLite + Docker）。客户端新增 25 个测试，服务端 11 个集成测试，全部通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `454d8ff` | (see git log) |
| `b0db4f0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

---

## Session 2: 服务端 SQLite → PostgreSQL 升级

**Date**: 2026-04-23
**Task**: 服务端 SQLite → PostgreSQL 升级
**Branch**: `master` (milesto-server)

### Summary

将 Milesto 同步服务端数据库从 SQLite (better-sqlite3) 迁移至 PostgreSQL (pg 驱动)。所有 DB 操作从同步 API 改为异步 Pool.query。修复了 WebSocket async 异常处理、非原子 LWW upsert 竞态、shutdown 顺序等问题。Docker Compose 新增 postgres 服务及健康检查依赖。

### Main Changes

- `src/db.ts`: 重写为 `pg.Pool` 异步 API；原子化 LWW upsert (`ON CONFLICT DO UPDATE WHERE`)
- `src/server.ts`: `handlePush`/`handleFetch` 异步化；WebSocket message handler 增加 try-catch
- `src/index.ts`: `async main()`；健康检查错误处理；优雅关闭顺序
- `src/config.ts`: `DATA_DIR` → `DATABASE_URL`
- `src/server.test.ts`: 适配 PostgreSQL 异步查询
- `docker-compose.yml`: 新增 postgres 服务，带健康检查依赖
- `Dockerfile`: 移除 SQLite 构建依赖
- `package.json`: 替换依赖 (`better-sqlite3` → `pg`)

### Git Commits

| Hash | Message |
|------|---------|
| `a2635b5` | feat(db): migrate from SQLite to PostgreSQL |

### Testing

- [OK] TypeScript `tsc --noEmit` 通过
- [OK] 11/11 集成测试通过（需 PostgreSQL 实例）

### Spec Updates

- 新增 `.trellis/spec/server/` 层
  - `error-handling.md`: WebSocket async 异常处理、原子 upsert、优雅关闭
  - `sync-protocol.md`: WebSocket 消息契约文档

### Status

[OK] **Completed** — 任务已归档至 `.trellis/tasks/archive/2026-04/04-23-sync-upgrade`

### Next Steps

- 在 `milesto-server` 目录运行 `docker compose up -d` 启动 PostgreSQL + 服务端


## Session 6: Settings Dialog UI Redesign

**Date**: 2026-04-24
**Task**: Settings Dialog UI Redesign
**Branch**: `master`

### Summary

Redesigned SettingsDialog to Things 3 minimal list style with simplified tabs, compact spacing, and no icons

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f808524` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 7: Mixed planning views show projects

**Date**: 2026-04-24
**Task**: Mixed planning views show projects
**Branch**: `master`

### Summary

Implemented mixed task/project planning views with unified ordering, tag filtering, project row interactions, cross-layer schemas, DB persistence, sync/import-export support, tests, and specs.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2d15320` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 8: Task to Project Conversion

**Date**: 2026-04-25
**Task**: Task to Project Conversion
**Branch**: `master`

### Summary

Implemented task-to-project conversion via a typed cross-layer API, DB transaction, right-click menu entry, and focused DB/renderer tests.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `3d3bd60` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 9: Convert project sections to projects

**Date**: 2026-04-25
**Task**: Convert project sections to projects
**Branch**: `master`

### Summary

Implemented project section to project conversion with atomic DB migration, menu action, IPC registration regression coverage, tests, and spec contract.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c328732` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 10: 让备注支持 Markdown

**Date**: 2026-04-25
**Task**: 让备注支持 Markdown
**Branch**: `master`

### Summary

为 Task 和 Project 的 notes 添加 Markdown 渲染支持。采用 Render-on-Blur 模式：聚焦时显示 textarea 编辑，失焦后渲染为格式化 HTML。使用 react-markdown 库，基础 Markdown 语法（bold, italic, lists, links, code blocks）。新增 MarkdownNotes 共享组件、.markdown-body CSS 样式、8 个组件测试。Lint 和测试全部通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9d586db` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
