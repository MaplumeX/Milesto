# feat(ai-agent): integrate langgraph conversational assistant

## Goal

为 Milesto 集成一个内嵌的对话式 AI 助手，让用户在桌面应用内通过自然语言对话查询和编辑任务/项目数据。
助手运行于 Electron main 进程，使用 `@langchain/langgraph` 编排 agent，通过现有 `window.api.*` IPC 调用底层 DB，配置上对接任何 OpenAI 兼容协议（base URL + key + model 可配置）。

## Requirements

### 用户能力
- 在主界面右侧打开/折叠 **AI Chat Panel**，与主内容并排展示。
- 通过自然语言完成 **Task** 与 **Project** 的查询和写入：
  - **读**：列出 Today/Inbox/Anytime/Someday/Upcoming/Logbook/Project/Area 下的任务、按关键字搜索、查看任务/项目详情。
  - **写（Task）**：create / update（标题、备注、日期、project、area、tags）/ toggleDone / cancel / restore / convertToProject / setTags / **delete（高风险）**。
  - **写（Project）**：create / update / complete / cancel / delete（高风险）/ setTags / sections（创建、改名、删除）。
  - **辅助读**：area / tag 列表与详情，用于"分到 X 区"、"打 Y 标签"等指令的解析。
- 多会话管理：用户可创建、命名、切换、删除多个 Chat Session（类似 ChatGPT 侧栏），所有会话持久化到本地 DB。
- 在 LLM 流式输出 / tool 执行过程中可点击"停止"中断（AbortController）。
- **高风险操作**（delete、project.complete、project.cancel、project.deleteSection）执行前会弹出确认对话框，列出动作摘要，需用户点击"执行"才生效；其他写操作 agent 在执行前用一句话描述即可直接执行。

### 配置面板
- 设置中新增"AI 助手"一栏：
  - **Base URL**（默认 `https://api.openai.com/v1`，可改 Azure / Ollama / 代理）
  - **API Key**（明文存于 better-sqlite3，⚠️ 已知风险，待后续迭代换 safeStorage）
  - **Model**（默认 `gpt-4o-mini`，纯文本输入，由用户保证 model 可用）
  - 可选：启用/禁用 AI 助手
- 缺少配置时，Chat Panel 显示引导用户去设置面板的提示。

### 系统一致性
- 所有写操作通过现有 `window.api.*`，不绕过 IPC、zod 校验、Result 协议。
- 写完成后 main 通过 IPC event 通知 renderer `bumpRevision()`，所有同屏视图自动刷新。
- delete 走现有 trash 流程（不真删）；用户可在 Trash 页面恢复。
- 与 react-i18next、ThemeState、FontSize 协同：UI label 全部 i18n（zh/en），气泡颜色与字号尊重当前主题。
- agent 默认按用户输入语言回应（user 中文 → assistant 中文）。

## Acceptance Criteria

- [ ] 在设置面板填入 OpenAI base URL + API key + model 后，Chat Panel 可启用
- [ ] 用户输入"列出今天所有任务"，agent 调 `task.listToday`，正确返回当天列表
- [ ] 用户输入"在 Inbox 创建一个叫 X 的任务"，agent 调 `task.create`，任务真实出现在 Inbox 视图（revision 触发刷新）
- [ ] 用户输入"删除任务 X"，弹出确认对话框，点击"取消"不执行；点击"执行"后任务进 Trash
- [ ] 用户输入"创建一个叫 Y 的项目，加几个 section A/B/C"，agent 顺序调用 `project.create` + `project.createSection`，正确生成
- [ ] 流式响应中点击"停止"，token 流和后续 tool 调用立即终止
- [ ] 创建多个 Session，重启 app 后所有 Session + 消息历史完整恢复
- [ ] LLM API 错误（key 错、网络断、配额满、model 不存在）有友好的错误气泡，不会让 panel 崩
- [ ] tool 调用返回 err Result（如校验失败）时，agent 能告诉用户失败原因并询问下一步
- [ ] 单元测试覆盖：tool dispatcher、消息持久化、确认流程、abort 行为
- [ ] 自测（self-test）4 个 suite（search/project/sidebar/trash）回归通过
- [ ] `npm run lint` / type-check / `npm run test` 全部通过

## Definition of Done

- 单元 + 必要集成测试覆盖工具调用、错误路径、confirm 流程、abort
- Lint / typecheck / `npm run test` 通过
- README 或 `.trellis/spec/` 中记录如何配置 AI provider
- 不破坏现有 self-test 4 个套件的行为
- API key 存储方式 + prompt injection 风险已在 spec / Out of Scope 显式声明

## Technical Approach

### 架构概览

```
Renderer (Chat Panel UI)         Main Process (Agent Runtime)        DB Worker Thread
        |                                  |                                  |
        |  window.api.chat.send(...)       |                                  |
        |--------------------------------->|                                  |
        |                                  |  langgraph: ChatModel (OpenAI    |
        |                                  |  compatible) + Tools (各 win-    |
        |                                  |  api 子集) + Memory (会话历史)   |
        |                                  |                                  |
        |  ipc event: token/tool/done      |  tool 内调 dbWorker.request(...) |
        |<---------------------------------|--------------------------------->|
        |                                  |                                  |
        |  bumpRevision() on done          |                                  |
```

### 进程位置
- **Agent runtime 跑在 main 进程**：API key 不暴露到 renderer；不阻塞 UI 渲染线程；与现有 IPC 模型一致。
- Renderer 通过新的 `window.api.chat.*` 与 main 对话。

### 关键模块

```
electron/
  agent/
    agent-runtime.ts        # 创建 langgraph workflow，注册 tools，管理 streaming
    agent-config.ts         # 读取 settings 中 baseUrl/apiKey/model
    tools/
      task-tools.ts         # 把 task.* API 封装成 langgraph 工具
      project-tools.ts
      area-tools.ts (read-only)
      tag-tools.ts (read-only)
      tool-result.ts        # 把 Result<T> 转成 agent 可消化的字符串
    confirm.ts              # 高风险动作：暂停 graph，IPC 推确认请求到 renderer，等回复
  workers/db/actions/
    chat-actions.ts         # ChatSession / ChatMessage CRUD
shared/
  schemas/
    chat.ts                 # ChatSession / ChatMessage / AiConfig zod schema
  window-api.ts             # +chat.* / +settings.getAiConfig/setAiConfig
src/
  features/chat/
    ChatPanel.tsx
    ChatSessionList.tsx
    ChatMessages.tsx
    ChatComposer.tsx
    ConfirmDialog.tsx
  pages/SettingsPage 或现有设置入口  # +AI 配置 section
```

### Schema 草图（细节 implement 阶段定）

```ts
// shared/schemas/chat.ts
const ChatSessionSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  // optional: snapshot ai config for this session
})

const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'tool', 'system']),
  content: z.string(),
  tool_calls: z.array(z.any()).nullable(),  // langgraph tool call 元数据
  tool_call_id: z.string().nullable(),
  created_at: z.string(),
})

const AiConfigSchema = z.object({
  enabled: z.boolean(),
  baseUrl: z.string().url(),
  apiKey: z.string(),  // ⚠️ 明文，下一迭代换 safeStorage
  model: z.string(),
})
```

### IPC 协议草图

```ts
window.api.chat = {
  // session 管理
  listSessions(): Promise<Result<ChatSession[]>>
  createSession(title?: string): Promise<Result<ChatSession>>
  renameSession(id, title): Promise<Result<ChatSession>>
  deleteSession(id): Promise<Result<void>>
  listMessages(sessionId): Promise<Result<ChatMessage[]>>

  // 对话
  send(sessionId, content): Promise<Result<{ messageId: string }>>  // 启动 graph 运行
  abort(messageId): Promise<Result<void>>  // 中断当前 inflight
  
  // 流式事件订阅（main → renderer）
  onMessageDelta(cb: (e: {sessionId,messageId,delta}) => void): () => void
  onToolCall(cb: (e: {messageId,name,args}) => void): () => void
  onToolResult(cb: (e: {messageId,name,result}) => void): () => void
  onMessageDone(cb: (e: {sessionId,messageId,bumpsRevision}) => void): () => void
  onConfirmRequest(cb: (e: {messageId,action,summary}) => void): () => void
  
  confirmRespond(messageId, approve): Promise<Result<void>>
}
```

### 高风险确认流程
1. agent 决定调用高风险 tool（如 `task_delete`）。
2. 节点先 emit `onConfirmRequest`，graph 进入等待。
3. UI 弹 ConfirmDialog；用户点击"执行"或"取消"。
4. renderer 调 `chat.confirmRespond(messageId, approve)`。
5. 拒绝则 graph 把"用户拒绝执行 X"作为 tool 结果继续，agent 改变策略；同意则真实调用对应 `window.api.task.delete`。

### Tool 错误处理
- tool 内 `await dbApi.task.create(...)`。如果 `result.ok === false`，把 `{ ok: false, code, message }` 序列化成 JSON 字符串作为 tool output。
- agent 看到失败结果后，自然语言告诉用户哪里有问题（如 "找不到 area X"，让用户重述）。

### Streaming + Abort
- `langgraph` 提供 `astream` 风格事件流。Main 端订阅，把 token / tool 事件推到 renderer。
- send 时返回 messageId；用户点停止 → renderer 调 `chat.abort(messageId)` → main 端调用 graph 的 `AbortController.abort()`。

## Decision (ADR-lite)

### 1. Agent 框架：`@langchain/langgraph` (JS/TS)
- **Context**：项目栈是 Electron + TypeScript。
- **Decision**：用 JS 版 langgraph 同进程运行。
- **Consequences**：与现有类型 / IPC / 打包流程无缝；JS 生态略弱于 Python 版需自验证 streaming 与 tool calling 成熟度。

### 2. UI 形态：右侧可折叠 Chat Panel（与主内容并排）
- 不占路由，可同屏边看任务边对话。

### 3. MVP 工具范围：Task + Project 完整 CRUD（含 sections）+ area/tag 读
- 排除 area/tag 写、trash.empty、data.resetAllData、sync.*、sidebar reorder（防止误触高破坏性动作）。

### 4. 写操作安全：高风险才二次确认
- 高风险清单：`task.delete` / `project.complete` / `project.cancel` / `project.delete` / `project.deleteSection`。
- 其他写操作 agent 文字描述即可直接执行。

### 5. LLM provider：OpenAI 兼容协议
- 三参数 `baseUrl + apiKey + model` 走设置面板。
- 默认 `https://api.openai.com/v1` + `gpt-4o-mini`。

### 6. 对话历史：多会话本地持久化
- 在 better-sqlite3 新增 `chat_sessions` / `chat_messages` 表。

### 7. Agent 进程位置：main process
- API key 不暴露到 renderer；不阻塞 UI；与现有 IPC 模型一致。

### 8. MVP 增强：仅 AbortController（中断能力）
- API key 加密存储与 prompt injection 防护放下一迭代。

## Out of Scope (explicit)

- API key 的 OS 级加密存储（safeStorage）—— 下一迭代
- Prompt injection 缓解的工程化加固 —— 下一迭代
- 撤销 / 操作 audit log / undo 按钮 —— 下一迭代
- 多模态（语音 / 图片 / 文件输入）
- agent 主动建议 / 长期记忆 / 用户偏好学习
- 云端 agent 服务、跨设备 agent 状态同步
- agent 操作 sync.* / data.resetAllData / trash.empty 等高破坏面
- agent 触碰 area/tag 写、sidebar reorder
- 自动定时 / scheduled prompt
- 与 sync 服务端的深度协同（agent 不直接改 sync 协议；本地写依然走现有 sync 通路）

## Technical Notes

### 已有依赖（直接复用）
- `react-markdown` 已经在 dependencies 里 → 用于渲染 agent markdown 输出。
- `zod ^4.3.6` → tool schema 与 IPC 校验。
- `react-i18next` → Chat 面板 UI 文案 i18n。
- `ws` → 已存在但与本特性无关。

### 待新增依赖（implement 阶段确认版本）
- `@langchain/langgraph`
- `@langchain/openai`（OpenAI 兼容协议下的统一 chat client）
- `@langchain/core` —— **必须**显式列为顶层依赖以强制 npm 去重；多份 core 副本会让 `instanceof` 检查静默失败导致工具不执行
- ⚠️ **不要**安装 `langchain` 伞包；用 `@langchain/langgraph/prebuilt` 的 `createReactAgent` 即可（虽在 1.2.9 标 deprecated 但仍工作；伞包里的 `createAgent` 不引入）

### Implement 阶段必读 caveats（来自研究）
- `ChatOpenAI` 实例化时**必须**传 `streaming: true`，否则 `streamEvents` 不发 `on_chat_model_stream`，UI 会从空白跳到全文。
- 高风险确认走 IPC 层暂停（renderer 弹 ConfirmDialog → `chat.confirmRespond`），**不要**用 langgraph 的 `interrupt()` + `checkpointer`——会与已有 `chat_messages` SQLite schema 形成两份事实来源。
- `chat.on*` 事件订阅 API 必须 mirror 已有的 `window.api.sync.onStateChange` 形状：返回 `() => unsubscribe`，payload 裸 `T` 不要包 `Result<T>`（`Result<T>` 只用于 `invoke`）。
- `tests/renderer/window-api-mock.ts` 中**必须**给 `chat` namespace 加默认 stub，否则 ChatPanel 测试在 React 18 StrictMode 下会因 listener 泄漏崩溃。

### 现有可调用的能力面
- 见 `shared/window-api.ts`（约 220 行），覆盖 task/project/area/tag/checklist/view/sidebar/trash/sync/settings/data/app。

### DB 调用链路
- `renderer → preload window.api → ipcMain.handle → DbWorkerClient → DB Worker Thread → better-sqlite3`
- 全程 zod 验证 + Result 包装，agent 工具复用此路径。

### 安全风险显式声明
- ⚠️ MVP 中 API key 明文存于 better-sqlite3，仅适合个人桌面使用；多用户机器需手动避免共享 userData 目录。下一迭代会换 `safeStorage`。
- ⚠️ MVP 不做 prompt injection 加固，仅依赖 system prompt 约束 + 高风险动作 confirm 流程作为最后防线。

### 默认值
- baseUrl 默认 `https://api.openai.com/v1`
- model 默认 `gpt-4o-mini`
- system prompt 内嵌 MVP 工具说明 + "按用户输入语言回应"

## Research References

implement 前的研究子任务（trellis-research 子 agent）已完成：
- [`research/langgraphjs-tool-calling.md`](research/langgraphjs-tool-calling.md) — langgraphjs 工具调用 / streaming / abort 实践；7 条 TL;DR + 9 类陷阱清单。
- [`research/electron-ipc-streaming-patterns.md`](research/electron-ipc-streaming-patterns.md) — Electron main → renderer 流式订阅范式；mirror 现有 `sync.onStateChange` 即可，含 8 条 TL;DR。

## Implementation Plan (small PRs)

- **PR1：基础 schema + 设置 + chat 基建**
  - `shared/schemas/chat.ts`（ChatSession / ChatMessage / AiConfig）
  - `shared/window-api.ts` 加 `chat.*` / `settings.getAiConfig/setAiConfig`
  - DB action 模块 `chat-actions.ts`（多会话 CRUD）
  - 设置面板加"AI 助手"一栏（baseUrl/apiKey/model/enabled）
  - 不做 UI Chat Panel，但能验证存读
- **PR2：Agent runtime + 最小工具 + IPC streaming**
  - `electron/agent/agent-runtime.ts`：装载 langgraph + ChatOpenAI + 系统 prompt
  - `tools/task-tools.ts`：先实现 task 读（list*、search、getDetail）
  - main 端订阅事件并通过 IPC 推 renderer
  - AbortController 全链路打通
- **PR3：Tool 集合扩展 + 高风险确认**
  - 补 task 写、project 全集（含 sections）、area/tag 读
  - confirm.ts：暂停-等响应-继续 流程
  - bumpRevision 触发刷新
- **PR4：Chat Panel UI**
  - 右侧可折叠 panel + session list + messages + composer
  - 流式渲染、tool 调用可视化、中断按钮、确认对话框
  - i18n / 主题 / 字号一致性
  - 错误气泡（key 错 / 网络断 / model 不存在）
- **PR5：测试 + 自测回归 + 文档**
  - 单测（dispatcher / 持久化 / confirm / abort）
  - 自测 4 套件回归
  - `.trellis/spec/` 加 AI 配置说明
