# AI 对话零会话直接输入即创建会话

## Goal

让用户在 AI 助手面板的零会话状态下也能直接输入并发送消息，由系统自动创建一个新会话承载首条消息——而不是必须先点击侧栏的「+ 新会话」按钮才能开始。整体体验对齐主流 AI 应用（ChatGPT / Claude / Cursor）的"打开即可输入"引导界面。

## What I already know

来自代码审查：

- `src/features/chat/ChatPanel.tsx`
  - `activeSessionId` 默认 `null`。
  - `useEffect`（第 52–56 行）只在 `sessions.length > 0` 时自动选中第一个会话。
  - `handleCreateSession` 通过侧栏「+ 新会话」按钮触发（`ChatSessionList.tsx:51-58`）。
- `src/features/chat/use-chat-streaming.ts`
  - `sendMessage` 第 264–265 行：`if (!activeSessionId) return ''` —— 没有 active session 时静默丢弃用户输入。
  - `createSession(title?)` 已经支持可选标题，会把新会话 prepend 到 `sessions` 列表。
- `src/features/chat/ChatComposer.tsx`
  - 当前没有"零会话特殊状态"，只看 `disabled`（`aiEnabled !== true`）。
  - 输入框始终可见、可输入，但零会话时点击发送会被静默丢弃。
- `src/features/chat/ChatMessages.tsx`
  - 零消息时显示 `chat.empty` = "开始对话" / "Start a conversation"，仅文案、无 CTA。
- `shared/i18n/messages.ts:255-274 / 539-558`
  - `chat` 命名空间已有 `panelTitle` / `newSession` / `newSessionDefault` / `placeholder` / `empty` 等键，en + zh-CN 双语齐备。

历史上下文：

- 当前分支 `feature/ai-chat-ui-optimization`，最近提交 `2931b01 fix(chat): float chat toggle as overlay so closed panel keeps full content width`、归档过 `05-03-fix-ai-chat-toggle-occupies-content-column` —— 说明本分支正聚焦 AI 对话面板的 UX 优化，本任务延续这条主线。

## Assumptions (temporary)

- 零会话状态下的输入框应保持可输入（不再静默丢弃），首次发送时由前端触发 `createSession` + `sendMessage` 两步。
- 当 AI 未启用 / 加载中（`aiEnabled !== true`）时，输入框继续保持当前 `disabled` 行为，不参与本次改造。

## Resolved Decisions

- **Q2 → 最小引导**: 零消息状态保留消息区，但替换 `chat.empty` 为「欢迎标题 + 一句提示语」的最小引导（不增加示例提问按钮）。新增 1–2 个 i18n 键。
- **Q1 → MVP 固定默认标题**: 自动创建的新会话标题一律使用 `chat.newSessionDefault`（"新对话" / "New Chat"）。用户同时希望后续演进为「AI 回复后自动生成标题」，已列入 Out of Scope 的后续计划。
- **Q3 → 回滚删除空会话**: 首次发送失败时，若该 session 无任何消息，则自动删除以回滚，面板回到零状态，错误提示保留，输入框内容保留供用户重试。

## Requirements (evolving)

- R1: 零会话状态下，`ChatComposer` 输入框可正常输入与按 Enter / 点击发送。
- R2: 零会话且 AI 已启用时，发送动作会在内部按顺序执行：`createSession(title)` → `setActiveSessionId(newId)` → `sendMessage(content, sessionId)`，对用户表现为单次发送。
- R3: 删除最后一个会话回到零状态，仍应支持 R1 / R2，体验一致。
- R4: AI 未启用 / 加载中（`disabled === true`）时，沿用现有禁用态文案与按钮禁用，不变。
- R5: 零消息状态在消息区显示「欢迎标题 + 一句提示语」（替代当前 `chat.empty`），文案需 en + zh-CN 双语；不引入示例提问按钮。

## Acceptance Criteria

- [x] AC1：在没有任何 chat session 的状态下打开 AI 面板，输入框可输入；按 Enter 后界面立即出现一个新会话（侧栏出现条目并被选中），首条用户消息进入消息区，AI 流式回复正常工作。
- [x] AC2：删除最后一个会话后重复 AC1，行为一致。
- [x] AC3：AI 未启用时，零会话状态仍然显示与现在相同的禁用态（`chat.errorDisabled` 文案 + 按钮不可用），输入区不会"伪装可用"。
- [x] AC4：AI 已启用但创建会话失败时，错误通过既有 `ChatPanel` 错误提示渠道暴露，输入框内容不丢失（用户可以重试）。
- [x] AC5：相关单元 / 组件测试覆盖：零会话发送、删除最后一个会话后再发送、创建会话失败回滚、AI 禁用时禁用态保持不变。

## Definition of Done

- 单测 / 组件测试在新增路径上通过（`tests/renderer/` 下的 chat 测试）。
- `npm run lint` / `tsc` 在改动文件上 clean。
- `npm run test` 通过。
- 行为变更在 PRD 与 commit message 中说明；是否需要 spec 更新由 trellis-update-spec 决定（见技术笔记）。
- 不破坏现有 `feature/ai-chat-ui-optimization` 分支上已有的 chat 行为。

## Out of Scope (explicit)

- 多模型 / 模型切换器入口。
- 提示模板（prompt presets / quick prompts）库。
- 会话搜索 / 标签 / 收藏。
- 引导卡片中的"示例提问"实际数据接入；如需要会以静态文案 MVP 形式落地。
- AI 配置项变更（`settings.getAiConfig`、API key 等）。
- AI 回复后自动生成会话标题（后续子任务，需额外模型调用 + prompt 设计 + 降级逻辑）。

## Technical Notes

潜在改动文件：

- `src/features/chat/ChatPanel.tsx` —— `handleSend` 在零 sessionId 时先 createSession 再发送；`activeSessionId` / `lastMessageIdRef` 的同步。
- `src/features/chat/use-chat-streaming.ts` —— `sendMessage` 增加可选 `explicitSessionId` 参数（避免 React state 异步），或暴露 `sendMessageToSession(sessionId, content)`。
- `src/features/chat/ChatMessages.tsx` —— 零消息状态视情况升级为引导卡片（取决于 Q2 答案）。
- `shared/i18n/messages.ts` —— 视 Q1 / Q2 是否引入新文案键（如 `chat.welcomeTitle` / `chat.welcomeHint`）。
- `tests/renderer/` —— 新增 / 调整 chat 相关测试。

约束 / 注意：

- `useChatStreaming.sendMessage` 当前依赖闭包里的 `activeSessionId`，新建会话后立即调用会读到旧值；解决方案：将签名改为 `sendMessage(content: string, explicitSessionId?: string)`，内部使用 `const sessionId = explicitSessionId ?? activeSessionId`。现有调用方无需改动。
- `ChatPanel.useEffect`（第 52–56 行）在 sessions 加载后会自动选中第一个 —— 需要确保新建会话也会被这条副作用之外正确选中（在 handleSend 中 setActiveSessionId）。
- 错误处理：`createSession` 失败时不应触发 `sendMessage`；同时要在 UI 上提示。
- 回滚逻辑：`handleSend` 在零 sessionId 时先 `createSession` → `setActiveSessionId` → `sendMessage(content, sessionId)`。若 `sendMessage` 返回空 string（发送失败），需判断该 session 是否为空（`window.api.chat.listMessages` → length === 0），若是则调用 `deleteSession` 回滚并将 `activeSessionId` 重置为 `null`，保留错误提示与输入内容。
- I18n key 必须在 `messagesEn` 和 `messagesZhCN` 中同时新增，否则 `collectLeafKeys` 一致性检查会失败（`shared/i18n/messages.ts:586+`）。

## Research References

(本次为内部 UX 改造，不涉及外部技术选型，无需 trellis-research 子代理。)
