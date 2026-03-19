## Why

当前废纸篓页面更像一个独立的回收站管理页：它只支持选中、恢复和彻底删除，不能像普通列表那样直接进入任务或项目继续工作。现在需要把废纸篓收敛成一个“正常工作视图”，让用户能够在保持删除态的前提下继续打开和编辑废纸篓中的任务与项目。

## What Changes

- 将废纸篓页面从“带行内操作按钮的管理页”调整为“普通列表式工作视图”。
- 保持废纸篓项目与任务混合根条目列表，顶部仅保留 `清空废纸篓` 按钮。
- 允许用户从废纸篓直接打开删除态任务并使用现有行内编辑器继续编辑，且编辑不会自动恢复任务。
- 允许用户从废纸篓直接进入删除态项目详情页并继续编辑，且编辑不会自动恢复项目。
- 为任务详情、项目详情及其保存链路增加显式 `trash` 作用域，使删除态对象可读可写但仍留在废纸篓中。
- 支持在删除态项目中继续新建任务和分组，新建内容默认仍为删除态，并继续受该项目的恢复/清空语义约束。
- 将单条恢复与彻底删除从废纸篓主列表移出，留待后续右键菜单设计承载。
- 收紧 trash mode 下的结构性动作：第一版不在废纸篓主视图或删除态编辑上下文中暴露移动、再次删除等会混淆语义的入口。

## Capabilities

### New Capabilities
- `trash-editing-mode`: 定义删除态任务/项目/分组在 `trash` 作用域下的读取、编辑、创建与保持删除态的行为。

### Modified Capabilities
- `trash-page`: 废纸篓页面从管理式列表调整为正常工作列表，并支持打开删除态任务与项目。
- `project-page`: 项目页增加 `trash` 作用域，允许删除态项目在详情页中继续编辑与新增删除态子项。
- `content-bottom-bar-actions`: 底部栏动作在废纸篓与 `trash` 编辑上下文中按删除态规则显示或隐藏。
- `task-soft-delete`: 删除态任务的详情读取与编辑能力改为在 active/trash 作用域下具有不同可见性与行为。
- `project-soft-delete`: 删除态项目的详情读取与编辑能力改为在 active/trash 作用域下具有不同可见性与行为。

## Impact

- 受影响 Renderer 主要在 `src/pages/TrashPage.tsx`、`src/features/trash/*`、`src/pages/ProjectPage.tsx`、`src/app/AppShell.tsx`、底部栏与任务编辑器相关组件。
- 受影响共享契约与 IPC/DB 动作主要在 `shared/window-api.ts`、`shared/schemas/*`、`electron/preload.ts`、`electron/main.ts`、`electron/workers/db/actions/task-actions.ts`、`project-actions.ts`、`trash-actions.ts`。
- 需要新增或扩展 `trash` 作用域的读取/保存输入模型，并补充删除态项目内新增子项、恢复与清空行为的验证。
