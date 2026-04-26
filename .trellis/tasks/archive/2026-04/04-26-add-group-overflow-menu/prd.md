# 分组添加溢出菜单（存档等）

## Goal

在项目页面的分组（ProjectSection）头部右侧添加一个 "..." 溢出菜单按钮，提供"存档"功能以及现有右键菜单中的操作。存档即完成该分组及其下的所有任务，section 从活跃列表中移除。已完成的任务在"已完成"折叠区域中按分组显示（类似活跃列表的分组头部样式），并支持恢复分组。

## What I already know

- 分组头部组件 `ProjectGroupHeaderRow` 位于 `src/features/tasks/ProjectGroupedList.tsx`
- 当前分组头部有意保持视觉最小化，没有右侧操作按钮（注释: "Intentionally no per-section action buttons"）
- 现有右键菜单 `useProjectSectionContextMenu` 提供：Move、Convert to Project、Delete
- `project_sections` 表没有 `status` 字段，只有 `deleted_at` / `purged_at`
- 已完成任务在"已完成"区域通过 `buildProjectDoneTaskRows` 按 section 分组显示（通过 `affiliationLabel`）
- 项目页面有"已完成"折叠按钮 (`completed-toggle`)，点击展开显示 done 任务
- DB migration 系统位于 `electron/workers/db/db-bootstrap.ts`，当前最新版本为 10
- `listSections` 查询根据 scope 过滤（`active` / `trash` 等）

## Decisions (confirmed)

- **存档后 section 标题从活跃列表隐藏**（选项 2）→ 需要给 `project_sections` 表添加 `status` 字段
- **"..." 按钮始终显示**（选项 1）→ 每个分组头部右侧始终可见
- **"已完成"区域按 section 分组显示，带分组头部**（像活跃列表一样）
- **恢复 section 时，只恢复分组本身，将该 section 下的 done 任务移出分组（`section_id = null`），任务保持 done 状态**

## Requirements

- [ ] DB migration (v11)：给 `project_sections` 表添加 `status TEXT NOT NULL DEFAULT 'open'` 字段
- [ ] Schema 更新：`ProjectSectionSchema` 添加 `status` 字段
- [ ] 新增 DB API：`project.archiveSection(sectionId, scope)` — 更新 section status='done' + 批量完成所有 open 任务
- [ ] 新增 DB API：`project.reopenSection(sectionId, scope)` — 更新 section status='open' + 将其下所有 done 任务的 `section_id` 设为 null
- [ ] `listSections` 查询根据 scope 正确过滤（`active` 只返回 status='open' 且未删除的 section，`trash` 逻辑不变）
- [ ] `listProjectDone` / `countProjectDone` 需要获取已存档 section 的信息用于分组显示
- [ ] 在活跃列表的分组头部右侧添加 "..." 按钮（靠右对齐）
- [ ] 点击 "..." 弹出菜单，包含：存档、移动、转换为项目、删除
- [ ] "已完成"区域重构为按 section 分组显示，带分组头部（类似活跃列表但无拖拽/编辑功能）
- [ ] "已完成"区域中已存档 section 的分组头部显示"恢复"按钮
- [ ] 无分组的 done 任务显示在最上面（不 section 分组）

## Acceptance Criteria

- [ ] 每个活跃分组头部右侧可见 "..." 按钮
- [ ] 点击按钮弹出菜单，包含存档、移动、转换为项目、删除
- [ ] 选择"存档"后弹出确认对话框，确认后该分组从活跃列表消失，所有任务变为已完成
- [ ] 点击"已完成"按钮展开后，已存档 section 和任务按分组显示（类似活跃列表的分组头部）
- [ ] "已完成"区域中已存档 section 的分组头部有"恢复"按钮
- [ ] 点击"恢复"后 section 回到活跃列表，但该 section 下的 done 任务不再属于该 section（保持 done 状态）
- [ ] 移动、转换为项目、删除功能与现有右键菜单行为一致
- [ ] 移动端/键盘操作正常

## Definition of Done

- Tests added/updated (unit/integration where appropriate)
- Lint / typecheck / CI green
- Docs/notes updated if behavior changes

## Out of Scope

- 批量选择多个 section 同时存档
- 在"已完成"区域中为 section 分组头部添加拖拽/重命名功能
- section 的独立存档/取消存档状态机（仅 open/done 两种状态）

## Technical Notes

### DB 层
- Migration：`electron/workers/db/db-bootstrap.ts` (user_version 11) — 添加 `status` 列
- Action：`electron/workers/db/actions/project-actions.ts` — `archiveSection`, `reopenSection`
- Dispatch：`electron/workers/db/db-dispatch.ts` — 新 action 路由
- Handler：`electron/workers/db/db-handlers.ts` — 聚合

### Schema/API 层
- `shared/schemas/project.ts` — `ProjectSectionSchema` 添加 `status`
- `shared/window-api.ts` — `archiveSection(sectionId, scope)`, `reopenSection(sectionId, scope)`
- `electron/preload.ts` — 暴露新 API
- `electron/main.ts` — IPC handler 注册

### 前端 - 活跃列表
- `src/features/tasks/ProjectGroupedList.tsx` — `ProjectGroupHeaderRow` 添加 "..." 按钮
- `src/features/tasks/use-project-section-context-menu.tsx` — 菜单添加"存档"

### 前端 - 已完成区域
- `src/pages/ProjectPage.tsx` — `ProjectDoneTaskList` 重构为按 section 分组显示
- 新增：已完成区域的分组头部组件（可复用/参考 `ProjectGroupHeaderRow`）

### 样式
- `src/index.css` — `.project-group-actions`、已完成区域分组头部样式
