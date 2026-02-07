## Context

- 当前 UI 在多个表面展示持续性状态/统计文案：
  - 任务编辑器保存状态：`src/features/tasks/TaskEditorPaper.tsx`
  - 通用任务列表 header 统计：`src/features/tasks/TaskList.tsx`
  - 项目页与分组统计：`src/pages/ProjectPage.tsx`、`src/features/tasks/ProjectGroupedList.tsx`
- 自动保存链路已具备去抖、串行保存、flush-before-close、失败阻止关闭与重试能力，核心语义不需要重写，只需调整“可见信号层”。
- `selfTest` 当前对保存状态文本和计数字符串有硬依赖（`src/app/selfTest.ts`），若不迁移断言会直接回归失败。
- 现有 OpenSpec 与目标行为冲突：
  - `task-editor-auto-save` 当前要求保存状态可见。
  - `project-page` 当前要求 Completed 控件标签包含总数。

## Goals / Non-Goals

**Goals:**
- 将任务编辑器保存反馈改为“成功静默、失败可见且可重试”。
- 移除任务/项目相关 UI 的数字统计文案（open/done/total/Completed N/Mark Done (N)）。
- 保持现有可靠性语义：防丢稿、flush、失败阻止关闭、重试。
- 完成规范与自测迁移，确保行为定义与验证口径一致。

**Non-Goals:**
- 不改动 IPC、数据库模型或自动保存底层算法。
- 不引入新的通知系统或全局状态管理框架。
- 不对任务筛选/排序/拖拽行为做功能性变更。

## Decisions

### Decision 1: 采用“失败优先”保存反馈模型
- 方案：移除成功态持续文案（`Saving/Saved/Unsaved`），保存失败时继续展示错误与 `Retry`。
- 理由：满足信息精简目标，同时不牺牲失败可恢复性。
- 备选方案：
  - 保留全量状态文案：与变更目标冲突。
  - 全静默（含失败）：会导致 flush 失败时用户无法理解阻止关闭原因，拒绝。

### Decision 2: 计数仅保留内部逻辑，不作为文案展示
- 方案：移除所有面向用户的计数字符串；内部 `openCount/doneCount/...` 可继续用于分支逻辑（如空态判定、按钮可用性）。
- 理由：最小化改动风险，避免牵动数据层接口。
- 备选方案：删除计数计算本身：会引发不必要重构，收益低。

### Decision 3: 以规范先行驱动实现
- 方案：先更新 `task-editor-auto-save` 与 `project-page` 的行为约束，再改代码与测试。
- 理由：避免“实现先行导致规范漂移”。
- 备选方案：先改代码再补 spec：容易出现验收口径不一致。

### Decision 4: selfTest 从“文案断言”迁移到“行为断言”
- 方案：将“等待 Saved/Saving 文本”替换为“等待持久化结果/flush 结果/错误恢复行为”。
- 理由：降低 UI 文案变动导致的脆弱性。
- 备选方案：保留旧断言并增加兼容文案：违背“成功静默”目标。

## Risks / Trade-offs

- [风险] 移除计数后，部分用户的进度感知下降  
  → 缓解：保留结构化分组、空态提示与完成分区切换，不引入新噪音。

- [风险] 移除成功状态后，用户误判“是否已保存”  
  → 缓解：保持失败可见 + 可重试 + 关闭前 flush 保障，确保“无提示即正常”。

- [风险] selfTest 大面积断言失配  
  → 缓解：优先迁移保存状态与计数字符串相关断言，再做全量回归。

- [风险] 规范与实现不同步  
  → 缓解：将 spec 变更纳入同一 change 并在任务清单中显式校验。

## Migration Plan

1. 更新 OpenSpec delta（`task-editor-auto-save`、`project-page`）。
2. 调整前端渲染层：去掉成功态保存文案与计数字符串，保留失败提示和重试。
3. 清理样式残留类（仅移除不再使用的状态/计数展示样式）。
4. 迁移 `selfTest`：从文本断言转为行为断言。
5. 回归验证（类型检查 + 构建 + selfTest 关键路径）。

回滚策略：
- 若上线后可用性退化，可在单次回滚中恢复旧文案渲染与对应断言，底层保存逻辑无需回滚。

## Open Questions

- `Tags: N` 这类字段型摘要是否视为“统计信息”范围？本次默认不纳入（仅处理 open/done/total/Completed/Mark Done 计数）。
- 项目完成确认文案是否保留“open tasks”文字描述（无数字）还是改为更中性的完成确认语句？
