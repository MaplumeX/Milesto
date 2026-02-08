## Why

当前“搜索”入口打开的是 `CommandPalette`，把“搜索 / 跳转 / 输入即新建任务（命名）”混在一起。对用户而言，这更像一个命名面板而非搜索面板：容易误触创建、也不符合“点搜索就应当出现搜索面板”的直觉。

同时，现有任务搜索基于 SQLite FTS5 的直接 `MATCH`，对用户输入表现偏“严格”（更像精确 token 匹配），缺少常见的“输入前缀即可命中”的部分匹配体验。

## What Changes

- 用“居中遮罩弹窗”的 `SearchPanel` 替代 `CommandPalette`。
- 底部栏的 Search 按钮改为打开 `SearchPanel`（不再打开命令面板）。
- 移除 `Cmd/Ctrl + K` 打开命令面板的快捷键逻辑与相关设置页文案。
- `SearchPanel` 的交互：
  - 打开后输入框自动聚焦
  - `Escape` 或点击遮罩关闭
  - 上下键移动结果高亮；`Enter` 选择高亮结果后跳转到任务所在列表/项目并关闭
- 搜索匹配语义调整为“前缀/部分匹配”：用户输入会被转换为安全的 FTS5 prefix query（每个词项按前缀匹配），而不是暴露/依赖 FTS5 的高级查询语法。

- **BREAKING**：移除命令面板（Command Palette）能力（包括“输入即新建任务”“跳转视图命令列表”）以及 `Cmd/Ctrl + K` 快捷键入口。

## Capabilities

### New Capabilities

- `search-panel`: 全局搜索面板（居中遮罩弹窗），提供打开/关闭、输入、结果展示、键盘导航与跳转。
- `task-search`: 任务搜索能力的需求定义（query 语义、前缀/部分匹配、安全输入处理、include_logbook 过滤与返回字段约束）。

### Modified Capabilities

- `content-bottom-bar-actions`: Search 动作从“打开命令面板”改为“打开搜索面板”。

## Impact

- Renderer
  - 移除 `src/app/CommandPalette.tsx`
  - 新增 `src/app/SearchPanel.tsx`（或等价位置）
  - 修改 `src/app/AppShell.tsx`（挂载 SearchPanel）
  - 修改 `src/app/ContentBottomBarActions.tsx`（Search 点击打开 SearchPanel）
  - 更新 `src/app/selfTest.ts`（自测断言从命令面板切换到搜索面板）
  - 修改 `src/pages/SettingsPage.tsx` 与 `shared/i18n/messages.ts`（移除/更新命令面板快捷键相关文案）
- DB Worker
  - 修改 `electron/workers/db/actions/task-actions.ts` 的 `task.search`：构造安全的 FTS5 prefix query，实现前缀/部分匹配。
- Shared API
  - `window.api.task.search(query, { includeLogbook })` 的签名保持不变，但 query 解释语义变化。
- Documentation
  - PRD/tech-framework 中关于“命令面板与 `Cmd/Ctrl + K`”的描述将与实现不一致，需要后续同步或明确偏离。
