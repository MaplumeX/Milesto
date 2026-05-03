# 修复 AI agent 审查发现的问题

## Goal

修复当前 AI agent/chat 功能审查中确认的 5 个缺陷，确保 agent 写操作可用、LLM 不重复接收当前用户消息、前端流式状态不会跨会话污染、高风险确认能在 abort 时释放、删除当前会话后 UI 状态一致。

## What I already know

* `electron/agent/tools/task-write-tools.ts` 和 `electron/agent/tools/project-tools.ts` 对 create/update 类 DB action 传入 `{ input: ... }`，但对应 DB action schema 期望顶层 payload。
* `electron/main.ts` 在 `chat:send` 中先持久化用户消息，再读取历史；`electron/agent/agent-runtime.ts` 又追加当前 HumanMessage，导致 LLM 上下文里当前用户消息重复。
* `src/features/chat/use-chat-streaming.ts` 的 streaming 状态是单份全局状态，只处理当前 active session 的 done/error；发送中切换会话会导致 loading 卡住或 pending 气泡显示在错误会话。
* `electron/agent/confirm-gate.ts` 没有取消入口；`chat:abort` 不会 resolve pending confirmation，前端 abort 也不会清掉确认弹窗状态。
* 删除当前会话后，`activeSessionId` 不会被清空，旧消息和 composer 可能继续指向已删除 session。

## Requirements

* Agent 的任务/项目 create/update 工具必须用 DB action 期望的顶层 payload，并更新现有单测断言。
* `chat:send` 构造 LLM history 时不能把当前用户消息重复传给 runtime。
* 前端流式状态必须绑定到当前运行的 `sessionId/messageId`，切换会话、收到旧会话事件、完成/失败/中止时都不能污染当前会话。
* abort 当前运行时必须释放可能存在的高风险确认请求，且前端确认弹窗不应残留。
* 删除当前 active session 后，UI 必须清空 active session/messages/streaming/confirm 状态，不能继续向已删除 session 发送。

## Acceptance Criteria

* [ ] `task_create`、`task_update`、`project_create`、`project_update` 工具调用 DB payload 与 schema 匹配。
* [ ] LLM history 中当前用户消息只出现一次。
* [ ] 会话 A 发送中切换到会话 B，不会让 B 卡在 loading，也不会显示 A 的 pending assistant 气泡。
* [ ] 发送后异步刷新不会把旧会话消息写入当前会话。
* [ ] abort 时 pending confirmation 会被拒绝/释放，前端弹窗关闭。
* [ ] 删除当前会话后 active session 被清空，消息列表清空，composer 不再指向旧 session。
* [ ] 增加或更新单测覆盖上述关键回归。
* [ ] lint/typecheck/test 通过。

## Out of Scope

* 不重做 AI 设置、安全存储或 provider 配置。
* 不引入新的 agent 框架或改写工具体系。
* 不改变高风险操作需要确认的产品策略。

## Technical Notes

* 后端关键文件：`electron/main.ts`、`electron/agent/agent-runtime.ts`、`electron/agent/confirm-gate.ts`、`electron/agent/tools/task-write-tools.ts`、`electron/agent/tools/project-tools.ts`。
* 前端关键文件：`src/features/chat/use-chat-streaming.ts`、`src/features/chat/ChatPanel.tsx`、`src/features/chat/ChatMessages.tsx`、`tests/renderer/window-api-mock.ts`。
* 测试重点：agent tools 单测、chat hook/component 状态竞态测试、必要时补 runtime/history 单测。
