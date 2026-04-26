# 增强搜索功能

## Goal

提升 Milesto 的搜索体验，支持搜索 Area/Project/Task，增加范围筛选能力，并提供专门的搜索结果页面。

## What I already know

- 现有搜索基于 SQLite FTS5 (`tasks_fts`)，索引 `tasks.title` 和 `tasks.notes`
- 前端是命令面板（Command Palette）风格的 `SearchPanel.tsx`，通过自定义事件触发
- DB 层 `task.search` 支持前缀匹配 (`token*`)，按 `bm25` 排序，限制 200 条
- 可选 `includeLogbook` 参数（默认 false）
- 点击结果跳转到 task 所在页面
- 没有搜索历史、没有过滤语法、不搜 projects/areas
- 没有专门的 `/search` 页面路由

## Requirements

1. **全局搜索范围扩展**：支持搜索 Area、Project、Task
2. **范围筛选器**：搜索面板顶部提供范围选择（Inbox / Today / Upcoming / Anytime / Someday / Logbook / Trash / Anywhere）
3. **继续搜索 → 搜索页面**：搜索结果底部提供"继续搜索"，点击跳转到 `/search` 页面展示完整结果
4. **新建 `/search` 页面**：专门的搜索结果页，纯混合列表展示（Task/Project/Area 混在一起，通过图标/标签区分类型），按相关性排序
5. **Area/Project 搜索用 LIKE 查询**（数据量小，无需 schema migration），Task 保持现有 FTS5

## Assumptions

- 搜索范围筛选仅作用于 Task 搜索结果（Area/Project 不受范围限制）
- 搜索页面支持 URL 参数（`?q=xxx&scope=inbox`）以便分享/刷新
- 默认搜索范围为"Anywhere"

## Acceptance Criteria

- [ ] SearchPanel 支持范围选择器（水平 pill/chip 列表）
- [ ] 搜索结果包含 Task + Project + Area，混合显示，通过图标区分类型
- [ ] 点击 Task 跳转到对应页面，点击 Project/Area 跳转到对应详情页
- [ ] 搜索面板底部有"继续搜索"入口，跳转 `/search?q=xxx&scope=xxx`
- [ ] `/search` 页面正常显示搜索结果，保留范围选择和搜索词
- [ ] 键盘导航（↑↓Enter/Escape）正常工作
- [ ] 空状态有友好提示

## Definition of Done

- Tests added/updated
- Lint / typecheck green
- 手动验证搜索面板和搜索页面正常工作

## Out of Scope

- 搜索历史
- 搜索过滤器语法（`in:inbox` 等）
- 模糊搜索/拼写容错
- 搜索结果高亮/富文本预览

## Technical Notes

- `src/app/SearchPanel.tsx` — 前端搜索面板（改造：增加范围选择器、混合结果、继续搜索入口）
- `electron/workers/db/actions/task-actions.ts` — `task.search` handler（增加范围筛选参数）
- `shared/schemas/search.ts` — 搜索 schema（扩展输入/输出类型）
- `src/app/AppRouter.tsx` — 添加 `/search` 路由
- `src/pages/SearchPage.tsx` — 新建搜索结果页
- `shared/window-api.ts` — 更新 `task.search` API 签名

## Implementation Plan

- **PR1**: DB 层 + IPC API — 扩展 `task.search` 支持范围筛选，新增 `project.search`/`area.search` API
- **PR2**: SearchPanel 改造 — 范围选择器 + 混合结果 + 继续搜索入口
- **PR3**: `/search` 搜索页面 + 路由注册
