# AI Agent Setup

> How to configure and use the Milesto AI assistant.

---

## Overview

Milesto includes an embedded conversational AI assistant powered by `@langchain/langgraph`. The assistant runs in the Electron main process and can read and write task/project data through natural language.

## Configuration

Open **Settings** (gear icon in the sidebar) and select the **AI Assistant** tab.

### Required Fields

| Field | Default | Description |
|---|---|---|
| **Base URL** | `https://api.openai.com/v1` | OpenAI-compatible API endpoint. Change this for Azure, Ollama, LM Studio, or a proxy. |
| **API Key** | (empty) | Your provider API key. Stored as plaintext in the local SQLite database. |
| **Model** | `gpt-4o-mini` | Model identifier to use. Must be available on your chosen provider. |
| **Enabled** | `false` | Toggle to enable/disable the assistant. When disabled, the Chat Panel shows a prompt to configure. |

### Supported Providers

Any provider that implements the OpenAI `/chat/completions` API:

- **OpenAI** — `https://api.openai.com/v1`
- **Azure OpenAI** — Use your Azure endpoint (e.g. `https://{resource}.openai.azure.com/openai/deployments/{deployment}`)
- **Ollama** — `http://localhost:11434/v1`
- **LM Studio** — `http://localhost:1234/v1`
- **vLLM / other local proxies** — Any compatible base URL

For local providers (Ollama, LM Studio), ensure the server is running and the model is loaded before use.

## Using the Chat Panel

1. Click the **chat icon** (speech bubble) in the top-right corner of the app to open the Chat Panel.
2. If AI is not configured, the panel shows a message directing you to Settings.
3. Create a new session or select an existing one from the sidebar.
4. Type your message and press Enter.

### Example Prompts

- "List all tasks for today"
- "Create a task called 'Buy groceries' in Inbox"
- "Delete the task called 'Old reminder'" (triggers confirmation dialog)
- "Create a project 'Website Redesign' with sections Planning, Design, Development"
- "Mark the project 'Website Redesign' as done" (triggers confirmation dialog)

### High-Risk Actions

The following actions require explicit user confirmation before executing:

- `task.delete` — Moves a task to Trash
- `project.complete` — Completes a project and all its open tasks
- `project.cancel` — Cancels a project
- `project.delete` — Moves a project to Trash
- `project.deleteSection` — Deletes a project section

When the assistant decides to perform one of these actions, a confirmation dialog appears in the Chat Panel with a summary. Click **Execute** to proceed or **Cancel** to reject.

### Streaming and Abort

Assistant responses stream token-by-token into the chat. While streaming:

- A **Stop** button is visible in the composer area.
- Clicking Stop aborts the current generation immediately via `AbortController`.
- Partial content is discarded; no data is modified.

## Data Storage

- **Chat sessions** and **messages** are stored in the local `better-sqlite3` database (`chat_sessions` and `chat_messages` tables).
- **AI configuration** (base URL, API key, model, enabled flag) is stored in the `app_settings` table.
- Sessions persist across app restarts.

## Security and Limitations

### API Key Storage (MVP)

The API key is stored **in plaintext** in the local SQLite database. This is acceptable for personal desktop use but carries risk on shared machines. The next iteration will migrate to Electron `safeStorage` for OS-level encryption.

### Prompt Injection

The MVP does not include engineered prompt-injection mitigations beyond:

- A system prompt that constrains the assistant to task-management operations.
- The high-risk confirmation dialog as a final guard rail.

Do not paste untrusted content directly into the chat if your API key has access to sensitive or costly models.

### Out of Scope

The following are explicitly out of scope for this iteration:

- OS-level encrypted key storage (`safeStorage`)
- Prompt injection hardening
- Operation audit log / undo
- Multi-modal input (voice, images, files)
- Proactive suggestions or long-term memory
- Cloud sync for chat sessions
- Agent access to sync settings, trash empty, or data reset

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| "AI assistant is disabled" | Enabled toggle is off | Go to Settings > AI Assistant and enable |
| "Invalid API key" or 401 | Wrong key or base URL | Verify key and base URL match your provider |
| "Model not found" or 404 | Model ID incorrect | Check model name with your provider |
| "Network error" | No internet or local server down | Check connection or ensure local server is running |
| "Rate limit" | Too many requests | Wait and retry, or check provider quotas |
| Streaming stops abruptly | User clicked Stop or connection dropped | Retry the prompt |

## Architecture Notes

- **Agent runtime** lives in the Electron main process (`electron/agent/agent-runtime.ts`).
- **Tools** wrap existing `window.api` DB calls (`electron/agent/tools/`).
- **Streaming** uses `webContents.send` on a single `chat:*` channel per the project's IPC conventions.
- **History** is loaded from SQLite on each turn and passed to LangGraph manually (no built-in checkpointer).

## Scenario: Chat Run Identity and Confirmation Contract

### 1. Scope / Trigger

Trigger this contract when changing `chat:send`, stream events, confirmation events, or renderer chat streaming state. These paths cross Electron main, preload, shared `WindowApi`, renderer hooks, agent runtime, and DB history.

### 2. Signatures

- `chat:send({ sessionId: string, content: string }) -> Result<{ messageId: string }>`
- `chat:abort({ messageId: string }) -> Result<void>`
- `chat:messageDelta -> { sessionId: string, messageId: string, delta: string }`
- `chat:messageDone -> { sessionId: string, messageId: string }`
- `chat:messageError -> { sessionId: string, messageId: string, code: string, message: string }`
- `chat:confirmRequest -> { messageId: string, sessionId: string, runMessageId: string, action: string, summary: string }`
- `chat:confirmRespond({ messageId: string, approve: boolean }) -> Result<void>`

### 3. Contracts

- `messageId` from `chat:send` is the run identity for all stream events.
- `chat:confirmRequest.messageId` is the confirmation identity; `runMessageId` points back to the owning run.
- Renderer streaming state must match both `sessionId` and run `messageId` before applying delta/done/error/confirm events.
- `chat:send` must build LangGraph history before inserting the current user message, because `agent-runtime.send()` appends the current `HumanMessage` itself.
- Agent tool DB payloads must match DB action schemas directly. Do not wrap create/update inputs in an extra `{ input: ... }` object unless the target DB action schema explicitly requires it.

### 4. Validation & Error Matrix

| Condition | Expected behavior |
|---|---|
| AI disabled | `chat:send` returns `AI_DISABLED`; no run starts |
| Unknown confirmation id | `chat:confirmRespond` returns `CONFIRM_NOT_FOUND` |
| Abort while confirmation is pending | pending confirmation resolves `false`; renderer clears dialog |
| Stream event for stale/different run | renderer ignores it |
| Current user message is already persisted before history load | bug: model receives the current user turn twice |

### 5. Good/Base/Bad Cases

- Good: send returns run `messageId`, renderer binds streaming to that id, main starts runtime after IPC response can deliver the id, and stale events are ignored.
- Base: switching away from a streaming session keeps the background run alive but hides its loading state from the visible session.
- Bad: matching stream events by `sessionId` only lets old runs mutate the current run.

### 6. Tests Required

- Agent tool unit tests assert top-level DB payloads for create and update tools.
- Confirm gate unit tests assert approve, reject, unknown id, concurrent confirms, and cancel-all behavior.
- Renderer hook tests assert stale send refreshes are ignored, background run completion does not overwrite visible messages, abort clears confirmation state, and deleting the active session clears local chat state.

### 7. Wrong vs Correct

#### Wrong

```typescript
await dbWorker.request('chat.insertMessage', { session_id: sessionId, role: 'user', content })
const history = await dbWorker.request('chat.listMessages', { session_id: sessionId })
void runtime.send(sessionId, content, historyMessages, controller.signal)
```

#### Correct

```typescript
const history = await dbWorker.request('chat.listMessages', { session_id: sessionId })
await dbWorker.request('chat.insertMessage', { session_id: sessionId, role: 'user', content })
setTimeout(() => {
  void runtime.send(sessionId, content, historyMessages, controller.signal)
}, 0)
```
