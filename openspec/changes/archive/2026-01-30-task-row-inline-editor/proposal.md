## Why

当前任务行内编辑器以“额外插入一行 editor row”的方式呈现：任务标题仍是一条独立的 task-row，编辑内容显示在其下方的第二行。这会让“展开后仍是同一条任务”的空间关系变弱（像是把任务拆成两条），且在视觉上容易出现第二层卡片/纸张的叠加。

我们希望把“展开编辑”变成任务条目自身的状态：展开后整行直接成为编辑器（标题即输入框），完成状态切换也位于编辑器头部，让编辑体验更连贯、直觉。

## What Changes

- 任务展开编辑的呈现从“task-row 下方插入 editor row”调整为“task-row 自身展开变高并渲染编辑器内容”。
- 展开态标题为标题输入框；完成/未完成的 checkbox 搬入编辑器头部（不再依赖列表行的 checkbox）。
- 视觉：展开态不出现第二层卡片/纸张（去除 inline editor 的独立 card 容器感），整体看起来仍是同一条 row 在展开。
- 交互保持：单击仅 selection；Enter 或双击打开；Escape / Cmd(Ctrl)+Enter 收起；收起前必须 flush pending changes，失败则阻止收起以避免丢稿。
- done 切换不自动收起；列表是否移除该任务依旧以现有刷新机制为准（通常在收起/切任务后触发刷新）。

## Capabilities

### New Capabilities

<!-- 无新增 capability；本次为既有行内编辑能力的需求变更。 -->

### Modified Capabilities

- `task-inline-editor`: 将“行内编辑器展开在 task-row 下方”的需求更新为“task-row 本身成为编辑器（标题输入框 + 头部 checkbox），且展开态不呈现第二层 card 容器”。

## Impact

- Renderer 任务列表：`TaskList`、`UpcomingGroupedList`、`Search` 结果列表的渲染与虚拟滚动需要适配“单行动态高度展开”（不再插入 editor row）。
- Renderer 编辑器 UI：`TaskEditorPaper` 的 inline 形态需要支持头部 done checkbox，并提供展开态去卡片化的样式覆盖。
- 键盘/焦点与防抢键：需要继续保证编辑区按键不触发列表级导航/切换（Arrow/Enter/Space），并保持收起后的焦点恢复。
- 自测与回归：`src/app/selfTest.ts` 依赖 `.task-title-button` 与 editor row 结构的断言可能需要同步更新。
- 不影响：DB/IPC schema 与持久化行为（`task.toggleDone`、`task.update` 等）预计不变；依赖不新增。
