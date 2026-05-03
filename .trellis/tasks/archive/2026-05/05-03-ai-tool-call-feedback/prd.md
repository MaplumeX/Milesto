# AI工具调用用户感知

## Goal
让 AI agent 在调用工具（如查询任务、创建任务、删除任务等）时，用户在聊天界面中能实时感知到这一行为，提升透明度和信任感。

## What I already know

- Agent runtime 基于 LangGraph `createReactAgent`，使用 `streamEvents` 流式输出
- Runtime 已支持 `onToolCall` 和 `onToolResult` 回调，通过 IPC 广播到 renderer
- 当前前端订阅了这些事件，但回调为空，不做任何 UI 反馈
- 工具结果以 `role: 'tool'` 的 `ChatMessage` 持久化到数据库，流完成后刷新消息列表时才可见
- 高风险操作（删除任务、项目完成/取消/删除等）已有 `confirm-gate` 机制，会弹确认对话框
- 聊天 UI 使用 `ChatMessages.tsx` 渲染消息列表，流式时追加一个 pending assistant message

## Assumptions (temporary)

- 用户希望在流式响应过程中就能看到工具调用状态，而不是等全部完成后
- 不需要新增数据库存储结构，可以利用现有的 `ChatMessage` schema
- 工具调用可能涉及多个工具串行或并行执行

## Open Questions

（已解决）

## Decision (ADR-lite)

**Context**: 需要选择工具调用实时反馈的 UX 风格
**Decision**: 采用"实时工具卡片"方式
**Consequences**:
- 收到 `onToolCall` 时立即在消息流中插入临时工具调用卡片
- 显示工具名称，可展开查看参数/结果
- 收到 `onToolResult` 后更新为完成状态
- 流完成后，数据库中的持久化消息接管显示
- 与现有 `role: 'tool'` 的 `ChatMessage` 渲染保持一致

## Requirements

- 在 AI 调用工具时，聊天界面给出实时视觉反馈
- 反馈应包含工具名称，让用户知道 AI 在做什么
- 多个工具调用时，反馈应能区分每个调用
- 不干扰正常的文本流式输出
- 工具卡片可展开/折叠查看参数和结果详情
- 流完成后，临时卡片平滑过渡为持久化消息
- 工具执行失败时，卡片显示错误状态（而非静默消失）
- 用户 abort 流时，清理未完成的工具卡片

## Acceptance Criteria

- [x] 用户发送消息后，AI 调用工具时能看到实时工具卡片
- [x] 工具卡片显示工具名称，可展开查看参数
- [x] 工具执行完成后，卡片更新为完成状态并可查看结果
- [x] 多个工具调用依次执行时，每个都有独立的卡片
- [x] 流式文本输出和工具调用反馈不冲突（assistant 消息和工具卡片共存）
- [x] 工具执行失败时，卡片显示错误状态（红色/错误图标）
- [x] 用户点击 abort 后，未完成的工具卡片被清理
- [x] 流完成后刷新消息列表，临时卡片平滑过渡为持久化的 `role: 'tool'` 消息

## Definition of Done

- 测试覆盖新增组件/逻辑
- Lint / typecheck 通过
- 符合现有代码风格

## Out of Scope (explicit)

- 修改 agent runtime 的底层逻辑
- 新增数据库 schema
- 修改 confirm-gate 的确认对话框行为
- 工具执行耗时统计/进度条（MVP 暂不实现）
- 工具调用失败的重试机制（仅展示错误状态）
- 工具调用历史聚合/统计视图

## Technical Approach

1. **`use-chat-streaming.ts`** 新增 `streamingToolCalls` 状态（`{ name, args, result?, status }[]`）
   - `onToolCall` → push `{ status: 'pending', name, args }`
   - `onToolResult` → 按顺序匹配第一个 pending 项，更新为 `{ status: 'completed', result }`
   - `onMessageDone` / `onMessageError` / `abortMessage` → 清空数组
2. **`ChatMessages.tsx`** 接收 `streamingToolCalls` prop
   - 在 pending assistant message 下方渲染工具卡片列表
   - 每个卡片：工具名 + 状态图标 + 可展开查看参数/结果
   - `pending` → 加载动画；`completed` → 成功图标 + 可展开结果
3. **平滑过渡**：流完成后 `listMessages` 刷新，持久化的 `role: 'tool'` 消息自然显示；临时卡片在 `setStreamingState(IDLE)` 时同步清空

## Decision (ADR-lite) — 错误状态检测

**Context**: `onToolResult` 当前只传递字符串结果，无错误标记
**Decision**: 方案 a — 修改 `agent-runtime.ts` 的 `on_tool_end` 处理，检测输出是否为 Error 对象或含错误标记，将错误状态通过回调传递给前端
**Consequences**:
- `RuntimeCallbacks.onToolResult` 签名扩展为 `(name: string, result: string, isError?: boolean)`
- IPC 事件 `chat:toolResult` 载荷增加 `isError` 字段
- 前端根据 `isError` 显示红色/警告状态
- 改动局限在 runtime 回调层，不侵入工具实现

## Technical Notes

- 关键文件：
  - `src/features/chat/ChatMessages.tsx` — 消息渲染
  - `src/features/chat/use-chat-streaming.ts` — 流式状态管理
  - `src/features/chat/ChatPanel.tsx` — 组件组装（可能需要传递新 prop）
  - `electron/agent/agent-runtime.ts` — Agent 运行时
  - `electron/main.ts` — IPC 广播
  - `shared/schemas/chat.ts` — ChatMessage schema
