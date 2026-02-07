## 1. 保存反馈改造（成功静默，失败可见）

- [x] 1.1 在 `src/features/tasks/TaskEditorPaper.tsx` 的 inline 分支移除 `Saving/Saved/Unsaved` 持续状态文案渲染。
- [x] 1.2 在 `src/features/tasks/TaskEditorPaper.tsx` 的 overlay 分支移除 `Saving/Saved/Unsaved` 持续状态文案渲染。
- [x] 1.3 保留并验证失败可见能力：错误提示、`Retry` 动作、`flushPendingChanges` 失败阻止关闭与错误焦点回跳。

## 2. 项目页与项目分组计数字符串移除

- [x] 2.1 更新 `src/pages/ProjectPage.tsx`：移除 `open/done/total` header 统计文案。
- [x] 2.2 更新 `src/pages/ProjectPage.tsx`：将 `Completed N` 调整为无数字标签，并移除 `Mark Done (N)` 数字后缀。
- [x] 2.3 更新 `src/features/tasks/ProjectGroupedList.tsx`：移除 section header 与 section drag overlay 的 `open/done` 计数展示。

## 3. 通用任务列表计数字符串移除

- [x] 3.1 更新 `src/features/tasks/TaskList.tsx`：移除列表页 header 的 `open` 数字统计展示。
- [x] 3.2 清理受影响样式（如 `src/index.css` 中不再使用的计数相关类）并保持布局稳定。
- [ ] 3.3 回归检查 Inbox/Today/Anytime/Someday/Area/Upcoming/Search 视图，确保无功能回退。

## 4. 自测迁移与验证

- [x] 4.1 更新 `src/app/selfTest.ts`，删除对 `.task-inline-status`、`Saved`、`Saving` 文案的依赖断言。
- [x] 4.2 将保存相关验证改为行为断言（持久化结果、失败阻止关闭、Retry 恢复）。
- [ ] 4.3 执行类型检查与关键回归验证（至少 `npx tsc -p tsconfig.json` 与 `?selfTest=1` 关键路径）。
  - 阻塞说明：`MILESTO_SELF_TEST=1 npm run dev` 当前稳定失败于 `Anytime A: duplicate created unexpectedly (workCount=2)`，需先确认该失败是否为既有问题。
