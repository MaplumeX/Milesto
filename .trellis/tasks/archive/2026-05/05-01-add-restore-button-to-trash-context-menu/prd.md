# 为废纸篓中的项目/任务添加恢复按钮

## Goal

在废纸篓视图的右键菜单中添加"从废纸篓恢复"选项，让用户可以通过右键菜单直接恢复任务和项目到活跃状态。

## What I already know

* 后端 API 已完备：`window.api.trash.restoreTask(id)` 和 `window.api.trash.restoreProject(id)`
* 任务上下文菜单（`use-task-context-menu.tsx`）在废纸篓中有"恢复"选项，但那是状态恢复（reopen），不是从废纸篓恢复
* 项目上下文菜单（`use-project-context-menu.tsx`）在废纸篓中完全没有恢复选项
* 已有 `RestoreMenuIcon` 可复用
* 恢复逻辑智能：任务会恢复到原项目/区域（如仍存在），否则回到收件箱；项目会恢复并连带恢复其分组和任务

## Requirements

* 任务上下文菜单在 `scope === 'trash'` 时增加"从废纸篓恢复"选项
* 项目上下文菜单在 `scope === 'trash'` 时增加"从废纸篓恢复"选项
* 恢复操作调用 `window.api.trash.restoreTask(id)` / `window.api.trash.restoreProject(id)`
* 恢复后触发 `bumpRevision()` 刷新数据
* 恢复后关闭菜单
* 需要添加对应的 i18n 键（中英文）

## Acceptance Criteria

* [ ] 在废纸篓中右键任务，菜单中出现"从废纸篓恢复"选项
* [ ] 在废纸篓中右键项目，菜单中出现"从废纸篓恢复"选项
* [ ] 点击恢复后，任务/项目从废纸篓消失，回到原来的位置（或收件箱）
* [ ] 中英文文本正确显示
* [ ] 恢复操作不影响现有的状态恢复功能（已完成任务的重开）

## Definition of Done

* Lint / typecheck 通过
* 手动测试通过
* 现有功能无回归

## Out of Scope

* 批量恢复（多选恢复）
* 撤销恢复操作
* 废纸篓视图中的其他 UI 改动

## Technical Notes

* 修改文件：`src/features/tasks/use-task-context-menu.tsx`、`src/features/projects/use-project-context-menu.tsx`、`shared/i18n/messages.ts`
* API：`window.api.trash.restoreTask(id)` / `window.api.trash.restoreProject(id)` 返回 `Result<TrashRestoreResult>`
* 图标：复用现有 `RestoreMenuIcon`
* 恢复按钮放在"删除"原来所在的位置（替换被隐藏的删除按钮位置），保持菜单布局一致