## Why

Milesto 目前只有 `open` 和 `done` 两种状态，用户只能把不再继续的任务或项目伪装成“已完成”，无法明确表达“已取消但不算完成”的终态。现在任务、项目、Logbook 和项目进度都已经围绕终态流转建立起来，正适合在不引入新归档面的前提下补上 `cancelled` 语义。

## What Changes

- 为任务和项目新增 `cancelled` 终态，与现有 `open`、`done` 并存。
- 继续复用 `completed_at` 作为“进入终态时间”，让 `done` 和 `cancelled` 都沿用现有 Logbook 排序与归档链路。
- 为任务新增显式 `Cancel` 动作，为项目新增显式 `Cancel project` 动作。
- 项目取消时，原子地将项目自身标记为 `cancelled`，并把该项目下仍为 `open` 的任务批量改为 `cancelled`。
- 保留当前复选框 / 进度控件的主语义：
  - 任务复选框继续承担“完成 / 恢复”
  - 项目进度控件继续承担“完成 / 重新打开”
  - 取消作为并列动作放在任务菜单、任务详情、项目菜单
- 继续使用现有 `Completed` 折叠区和 `Logbook` 展示所有终态条目，不新增独立的 Cancelled 页面或分组。
- 用视觉语义区分两类终态：
  - `done` 使用对勾
  - `cancelled` 使用 `x`
  - 取消态任务与项目标题使用删除线
- 将项目进度统计从“已完成”扩展为“已关闭”，即 `done + cancelled` 都计入 closed progress。
- 保持 reopen 规则简单：
  - `done/cancelled -> open` 只恢复当前任务或项目本身
  - 重新打开项目时，不自动恢复其下已 `done` 或 `cancelled` 的任务
- 扩展搜索与 Logbook 语义，使 `cancelled` 与 `done` 一样被视为终态项。

## Capabilities

### New Capabilities
- `cancelled-status`: 定义任务和项目的 `cancelled` 终态、共享的恢复语义、终态时间复用规则，以及 `done` / `cancelled` 在闭合列表与状态控件中的区分方式。

### Modified Capabilities
- `project-bulk-complete`: 项目级终态行为从“仅完成”扩展为“完成或取消”，并明确 reopen 不恢复任何已关闭子任务。
- `project-progress-indicator`: 项目进度统计与控件状态需要识别 `cancelled`，并将 `done + cancelled` 统一计入 closed progress。
- `project-page`: 项目页头部与 overflow 菜单需要支持取消项目，现有 `Completed` 折叠区需要纳入 cancelled 任务。
- `task-context-menu`: 打开任务的菜单根视图需要新增 `Cancel`，closed 任务统一显示 `Restore`。
- `task-editor-overlay-paper`: 任务详情编辑器需要支持显式取消动作，并在状态展示中区分 `done` 与 `cancelled`。
- `logbook-page`: Logbook 需要展示 cancelled 任务与项目，并用现有列表结构承载两类终态。
- `task-search`: `include_logbook` 过滤需要把 `cancelled` 视为终态。

## Impact

- Renderer UI:
  - 任务行状态显示、任务详情动作区、任务右键菜单
  - 项目页头部、项目 overflow 菜单、项目已关闭折叠区
  - Logbook 列表、项目进度控件
  - 文案与样式（`x` 图标、删除线、状态标签）
- Shared / IPC:
  - `shared/schemas/*` 状态枚举与返回模型
  - `shared/window-api.ts`
  - `electron/preload.ts`
  - `electron/main.ts`
- DB worker:
  - 任务 / 项目状态动作
  - Logbook、项目闭合列表、项目进度统计、搜索过滤查询
- 测试与验证:
  - 现有 project completion / logbook / search 自测需要补充 cancel 场景
  - 需要验证 open/done/cancelled/reopen 的跨页面一致性
