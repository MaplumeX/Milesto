# 标签筛选：在列表页面按标签筛选任务

## Goal

在 Today、Anytime、Someday、Project、Area 等任务列表页面中，当任务带有标签时，支持按标签筛选显示的任务。提升用户在任务量较大时快速定位相关任务的能力。

## What I already know

- 标签数据结构：`Tag { id, title, color: string | null, created_at, updated_at, deleted_at }`
- 标签颜色预设：Red / Orange / Yellow / Green / Blue / Purple / Gray + None（共7色）
- 任务与标签多对多关联，通过 `task_tags` 表
- `TaskListItem` 包含 `tag_preview: string[]` 和 `tag_count: number`
- 目标页面均使用 `TaskList` 组件（ProjectPage 使用 `ProjectGroupedList`）
- `TaskList` 支持 `headerActions` 和 `topContent` 插槽
- 当前没有任何页面提供筛选UI，后端 list API 也不接受 tag filter 参数
- 标签预览在 TaskRow 中以 `<TagIcon> + 标签名 + +N` 形式展示

## Assumptions (temporary)

- 多标签筛选默认使用 OR 逻辑（满足任一即显示）
- 筛选状态不需要跨页面持久化（页面切换即重置）
- 筛选器只在当前页面有任务且存在标签时显示
- ProjectPage 的 ProjectGroupedList 也需要支持筛选（或统一过滤数据）

## Open Questions

- [ ] UI方案选择（三种候选方案待用户确认）
- [ ] 多标签筛选逻辑：AND 还是 OR？
- [ ] 筛选状态是否需要 URL query 参数化（支持刷新后保持）？

## Requirements (evolving)

- 在 Today / Anytime / Someday / Project / Area 页面中支持按标签筛选任务
- 筛选UI需要与现有设计系统一致（shadcn/ui + Tailwind，极简风格）
- 筛选结果即时响应，无需额外确认按钮
- 支持清除筛选/全选快捷操作
- 空筛选结果需要友好的空状态提示

## Acceptance Criteria (evolving)

- [ ] 目标页面显示标签筛选器
- [ ] 选择标签后列表只显示带有该标签的任务
- [ ] 支持多标签筛选
- [ ] 支持清除筛选
- [ ] 筛选器在任务无标签时自动隐藏或禁用
- [ ] 筛选操作响应 < 100ms（纯前端过滤）

## Out of Scope (explicit)

- 全局搜索页面（SearchPage）的标签筛选（保持纯文本搜索）
- Inbox / Logbook / Trash 页面的标签筛选（当前需求未涉及）
- 标签筛选状态的跨会话持久化
- 后端API筛选（第一阶段纯前端过滤，后续可迁移到后端）

## Technical Notes

- 目标文件：
  - `src/pages/TodayPage.tsx`, `AnytimePage.tsx`, `SomedayPage.tsx`, `AreaPage.tsx`
  - `src/pages/ProjectPage.tsx`（使用 ProjectGroupedList，需单独处理）
  - `src/features/tasks/TaskList.tsx`（可能需要扩展插槽或内部支持）
  - 新增：`src/features/tasks/TagFilter.tsx`（筛选组件）
- 后端：`electron/workers/db/actions/task-actions.ts` — 当前 list API 无 tag filter 参数
- 颜色系统：`src/features/tasks/TaskEditorPaper.tsx` 中 `TAG_COLOR_PRESETS`
