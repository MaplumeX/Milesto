# Research: `@langchain/langgraph` (JS) in Electron Main — Tool Calling, Streaming, Abort

- **Query**: How to use `@langchain/langgraph` (JavaScript/TypeScript) in Electron's main process to build a conversational agent with tools, token streaming, and abort support
- **Scope**: external (npm/GitHub primary sources), with concrete recommendations for the Milesto codebase
- **Date**: 2026-05-03

---

## 1. Recommended versions (npm latest as of May 2026)

| Package | Latest version | Notes |
|---|---|---|
| `@langchain/langgraph` | **1.2.9** (Apr 2026) | Major rewrite at 1.0 (Oct 2025). New API stabilized. |
| `@langchain/openai` | **1.4.5** | OpenAI-compatible client; supports `configuration.baseURL` |
| `@langchain/core` | **1.1.44** | Required peer; `langgraph 1.2.x` requires `^1.1.40` |
| `langchain` (umbrella) | **1.3.5** | Optional: re-exports `createAgent`, `tool`. Brings in langgraph as transitive dep. |
| `zod-to-json-schema` | **3.25.2** | Listed as `^3.x` peer of langgraph. Usually transitive. |
| `zod` | **^3.25.32 \|\| ^4.2.0** | Project already on `zod ^4.3.6` — compatible. |

**Pinned set we recommend installing for Milesto:**

```jsonc
"dependencies": {
  "@langchain/langgraph": "^1.2.9",
  "@langchain/openai": "^1.4.5",
  "@langchain/core": "^1.1.44"
  // do NOT also depend on the `langchain` umbrella unless we want createAgent re-exports;
  // adding it pulls langsmith and bloats the bundle.
}
```

### Peer dependency pitfalls

- `@langchain/openai 1.4.5` peers `@langchain/core ^1.1.42`; `langgraph 1.2.9` peers `@langchain/core ^1.1.40`. Pin `@langchain/core ^1.1.44` directly so npm dedupes to one copy. **Multiple copies of `@langchain/core` cause `instanceof` checks on `BaseMessage` / `Runnable` to fail silently.**
- All four packages declare `"type": "module"`. Milesto's `package.json` is already `"type": "module"`, so direct ESM imports work in Electron main built by `vite-plugin-electron/simple`.
- `openai` (the underlying SDK used by `@langchain/openai`) is bundled with no Node-only natives — it works fine inside the Electron Node runtime.
- ⚠️ The 0.x → 1.x rewrite renamed/relocated several APIs:
  - The README example shows `createReactAgent` and `tool` imported from the umbrella `langchain` package now.
  - `createReactAgent` source still lives in `@langchain/langgraph/prebuilt` but is marked `@deprecated` with a comment "moved to `langchain` package; use `createAgent`". For our work, **`@langchain/langgraph/prebuilt`'s `createReactAgent` still works on 1.2.9** — we can use it without pulling in the umbrella.
  - `tool()` is still exported from `@langchain/core/tools` and remains the recommended low-level API.

---

## 2. Minimal graph skeleton for `electron/agent/agent-runtime.ts`

This is the seed we want — under 30 lines, no fluff. We can grow tools/system-prompt around it later.

```ts
// electron/agent/agent-runtime.ts
import { ChatOpenAI } from '@langchain/openai'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages'
import type { StructuredToolInterface } from '@langchain/core/tools'

export type AgentConfig = { baseUrl: string; apiKey: string; model: string }

export function buildAgent(cfg: AgentConfig, tools: StructuredToolInterface[]) {
  const llm = new ChatOpenAI({
    model: cfg.model,
    streaming: true,                  // required for token-level deltas
    configuration: { baseURL: cfg.baseUrl, apiKey: cfg.apiKey },
  })
  return createReactAgent({
    llm,
    tools,
    prompt: new SystemMessage(
      'You are Milesto assistant. Reply in the user\'s input language.',
    ),
  })
}

export type AgentInstance = ReturnType<typeof buildAgent>

// Caller passes prior history (from SQLite) + new user turn:
export async function runStream(
  agent: AgentInstance,
  history: BaseMessage[],
  userText: string,
  signal: AbortSignal,
) {
  const inputs = { messages: [...history, new HumanMessage(userText)] }
  return agent.streamEvents(inputs, { version: 'v2', signal })
}
```

Key facts the implementer must know:
- `createReactAgent({ llm, tools, prompt })` returns a compiled `Pregel` graph that already wires the standard agent loop (call model → if `tool_calls`, run `ToolNode` → loop → emit final AI message).
- `streamEvents` is the source of truth for fine-grained UI events. `stream` only gives state snapshots.
- `streaming: true` on `ChatOpenAI` is required for `on_chat_model_stream` deltas. Without it the model returns the full message in one chunk.

---

## 3. Tool definition: zod direct, no JSON-schema conversion needed

`@langchain/core/tools.tool()` accepts `schema` as a **Zod object** directly. langgraph internally calls `zodToJsonSchema()` (peer dep) before sending to the OpenAI tool-calling API. The implementer never has to convert.

```ts
// electron/agent/tools/task-tools.ts
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import type { DbWorkerClient } from '../../workers/db/db-worker-client'

export function makeTaskTools(db: DbWorkerClient) {
  return [
    tool(
      async ({ scope }) => {
        const r = scope === 'today'
          ? await db.request({ action: 'task.listToday', payload: {} })
          : await db.request({ action: 'task.listInbox', payload: {} })
        // ALWAYS return a string for tool output. Stringify Result<T>.
        return JSON.stringify(r.ok ? { ok: true, data: r.data } : { ok: false, ...r.error })
      },
      {
        name: 'task_list',
        description: 'List tasks in a given scope. Use for read-only queries.',
        schema: z.object({
          scope: z.enum(['today', 'inbox', 'anytime', 'someday', 'logbook']),
        }),
      },
    ),
    tool(
      async ({ title, projectId, areaId, notes }) => {
        const r = await db.request({
          action: 'task.create',
          payload: { input: { title, project_id: projectId, area_id: areaId, notes } },
        })
        return JSON.stringify(r.ok ? { ok: true, data: r.data } : { ok: false, ...r.error })
      },
      {
        name: 'task_create',
        description: 'Create a new task. Returns the created task or an error.',
        schema: z.object({
          title: z.string().min(1),
          projectId: z.string().uuid().optional(),
          areaId: z.string().uuid().optional(),
          notes: z.string().optional(),
        }),
      },
    ),
    // ... more tools
  ] as const
}
```

Notes:
- `description` is what the LLM sees as the tool's purpose. Keep it short and imperative.
- `schema` field names go straight to the model — use snake_case or camelCase consistently with what the user types (LLMs do better with camelCase in TS contexts).
- The tool body is just an async function that **returns a string** (or `BaseMessage`-like). Returning a JSON string of our `Result<T>` is the cleanest mapping; the model will see `{ ok: false, code: 'VALIDATION_FAILED', message: '...' }` and adjust.
- Do not throw inside tools unless you want the whole graph to error. Catch and stringify instead.
- `langgraph` 1.2.x also accepts `zod 4` schemas (which is what Milesto uses) — verified via the peer dep range `^3.25.32 || ^4.2.0`.

---

## 4. Streaming API: `streamEvents` v2 is what we want

Use `agent.streamEvents(inputs, { version: 'v2', signal })`. Each yielded event has shape:

```ts
type StreamEvent = {
  event: string             // see table below
  name: string              // node/runnable name
  run_id: string            // unique per runnable invocation; stable for the same logical step
  tags: string[]
  metadata: Record<string, any>
  data: Record<string, any> // shape depends on `event`
}
```

### Event names we care about (subset of v2 events)

| Event | When | `data` shape | Use it for |
|---|---|---|---|
| `on_chat_model_start` | Before model call | `{ input: { messages } }` | "agent is thinking" indicator |
| `on_chat_model_stream` | Each token / partial | `{ chunk: AIMessageChunk }` — `chunk.content` is the delta string; `chunk.tool_call_chunks` is partial tool args | Stream tokens to renderer; detect tool-call intent early |
| `on_chat_model_end` | Model finished | `{ output: AIMessage }` | Capture the assembled message + final `tool_calls[]` |
| `on_tool_start` | Just before tool function runs | `{ input: <args> }` (also `name: 'task_list'` etc.) | Emit `chat:toolStart` IPC event to UI |
| `on_tool_end` | Tool returned | `{ output: <stringified or ToolMessage> }` | Emit `chat:toolResult` IPC event |
| `on_chain_end` (with `name === 'LangGraph'`) | Whole graph done | `{ output: { messages: [...] } }` | Mark message done, persist to SQLite |

### Concrete consumer pattern for `agent-runtime.ts`

```ts
import { isAIMessageChunk } from '@langchain/core/messages'

for await (const ev of agent.streamEvents(inputs, { version: 'v2', signal })) {
  switch (ev.event) {
    case 'on_chat_model_stream': {
      const chunk = ev.data?.chunk
      if (chunk && isAIMessageChunk(chunk) && typeof chunk.content === 'string' && chunk.content.length > 0) {
        emit({ type: 'token', delta: chunk.content })
      }
      break
    }
    case 'on_tool_start':
      emit({ type: 'toolStart', name: ev.name, args: ev.data?.input })
      break
    case 'on_tool_end':
      emit({ type: 'toolResult', name: ev.name, result: ev.data?.output })
      break
    case 'on_chain_end':
      if (ev.name === 'LangGraph') {
        emit({ type: 'done', finalMessages: ev.data?.output?.messages })
      }
      break
  }
}
```

Caveats:
- Token deltas only fire if the **chat model itself** is in streaming mode. We set `streaming: true` on `ChatOpenAI`; that is enough.
- A single LLM turn may produce many `on_chat_model_stream` events; concatenate `chunk.content` to build the assistant message text. langgraph also gives the assembled message at `on_chat_model_end`, so we can just trust that.
- For OpenAI tool calls, partial JSON args arrive in `chunk.tool_call_chunks[]`. We typically **don't need to act on partial args** — wait for `on_tool_start`, which fires once args are fully assembled.

---

## 5. AbortController integration

LangGraph honors the standard `AbortSignal` passed in the `RunnableConfig` (the second arg to `stream` / `streamEvents`).

```ts
const ac = new AbortController()
// ... store ac on the inflight session
const stream = await agent.streamEvents(inputs, { version: 'v2', signal: ac.signal })
try {
  for await (const ev of stream) {
    if (ac.signal.aborted) break
    // ... handle event
  }
} catch (e) {
  if ((e as Error).name === 'AbortError') {
    // expected on user-initiated stop
  } else {
    throw e
  }
}

// Later, from another IPC handler:
ac.abort()
```

Verified behavior (from `libs/langgraph-core/src/pregel/index.ts`):
- The `signal` is propagated through `combineAbortSignals` into every Pregel task and forwarded to the underlying `Runnable.streamEvents`.
- `ChatOpenAI` passes the signal to its `openai` SDK call → the SDK aborts the underlying `fetch`, which **does close the network socket** (this is what we need; the model stops generating).
- Inside a tool, the signal is available as `config.signal` (second arg of the tool function). For our DB-worker-backed tools, the operations are quick and atomic; we don't need to plumb signal into the worker. But if we add long tools later (e.g. web fetch), pass `config.signal` to those.
- Returned `IterableReadableStreamWithAbortSignal` also has `.cancel()`. Calling `stream.cancel()` triggers the same internal abort. We can use either; sticking with one external `AbortController` is cleaner because we already need it for IPC `chat.abort(messageId)`.

---

## 6. Multi-turn conversation history

Two patterns; for the Milesto MVP we recommend **#1 (manual history injection)**.

### Pattern 1 — manual injection (what we'll do)

We persist messages to SQLite ourselves. On each `chat.send`, we:
1. Load all prior `ChatMessage` rows for the session.
2. Map them to `BaseMessage`s: `user` → `HumanMessage`, `assistant` → `AIMessage`, `tool` → `ToolMessage` (with `tool_call_id`), `system` → `SystemMessage`.
3. Append the new user `HumanMessage`.
4. Pass as `inputs.messages` to `agent.streamEvents`.
5. After `on_chain_end`, write the new assistant + tool messages to SQLite.

LangGraph does **not** silently truncate — it forwards everything to the LLM. We must do the trimming ourselves before passing.

LangChain provides `trimMessages()` as a helper:

```ts
import { trimMessages } from '@langchain/core/messages'

const trimmed = await trimMessages(history, {
  maxTokens: 6000,
  strategy: 'last',
  tokenCounter: (msgs) => msgs.reduce((n, m) => n + (typeof m.content === 'string' ? m.content.length / 4 : 0), 0),
  startOn: 'human',
  includeSystem: true,
})
```

Token counting for OpenAI is more accurate via `js-tiktoken` (already a transitive dep through `@langchain/openai`), but for MVP a coarse char/4 estimate is fine.

### Pattern 2 — built-in checkpointer (skip for MVP)

`createReactAgent({ checkpointer: new MemorySaver() })` + `{ configurable: { thread_id } }` makes langgraph manage history. But:
- The default `MemorySaver` is in-RAM; lost on app restart.
- `@langchain/langgraph-checkpoint-sqlite` exists but pulls a separate sqlite binding (NOT better-sqlite3) and would conflict with our existing native module setup.
- We already have a richer SQLite schema (`ChatMessage` with `tool_calls`, `tool_call_id`, etc.). Using checkpointer would mean two sources of truth.

**Decision: stick with manual injection. Skip checkpointer.**

---

## 7. Common pitfalls

### 7.1 Multiple `@langchain/core` copies → broken `instanceof`

If npm hoists two versions (e.g. one direct, one transitive via `langchain` umbrella), `BaseMessage instanceof` checks inside `ToolNode` start failing — symptom: tools never run, or graph hangs.

Fix: pin `@langchain/core` directly in the top-level `dependencies`, run `npm ls @langchain/core` to verify exactly one resolved version.

### 7.2 ESM/CJS interop in Electron main

All langchain 1.x packages are ESM (`"type": "module"`). Milesto's main entrypoint is also ESM. Two gotchas:
- `vite-plugin-electron` builds main with Rollup; native modules (`better-sqlite3`, `ws`) must stay external. langchain packages are pure JS — leave them bundled.
- If we ever need CommonJS (e.g. tests outside Vitest's ESM runtime), the packages also publish `.cjs` builds via `"exports"` conditional — Vitest with the Electron runtime handles both fine.

Action: verify after first install that `npm run build` succeeds. If Rollup complains about dynamic imports inside langchain, add packages to `vite.config.ts` `optimizeDeps.exclude` or accept default behavior — usually no change needed.

### 7.3 Vite dev double-render in renderer

Not a langgraph issue per se, but if we accidentally start the agent runtime from the renderer (we won't — agent runs in main), React StrictMode double-render in dev would cause two LLM calls per submit. Since the runtime is in main and triggered by IPC, StrictMode is irrelevant.

### 7.4 `streaming: true` is required for token deltas

Easy to miss. `new ChatOpenAI({ model, configuration })` without `streaming: true` still works — but `on_chat_model_stream` events will not fire; you'll only get `on_chat_model_end` with the full message. The UI would jump from empty to full content. **Always pass `streaming: true`.**

### 7.5 tiktoken / WASM in Electron

`@langchain/openai` depends on `js-tiktoken` for token counting. `js-tiktoken` is **pure JS** (the `tiktoken` package is the native one). We get the JS one for free. No native rebuild needed.

### 7.6 `responseFormat` + tools is incompatible with most non-OpenAI providers

`createReactAgent({ responseFormat })` makes a SECOND LLM call after the agent loop to format the final answer with a Zod schema. This is fine on real OpenAI but flakey on Azure/Ollama/local proxies. We don't need it for MVP — leave it off.

### 7.7 OpenAI-compatible endpoint quirks

- For Ollama / LM Studio / vLLM behind an OpenAI-compatible endpoint, set `baseUrl` to `http://localhost:11434/v1` (or whatever) and pass any non-empty `apiKey` — `ChatOpenAI` errors if `apiKey` is empty/undefined.
- Some compat servers don't fully implement `/chat/completions` streaming with tool calls. Document this limitation in the AI settings UI.
- Azure OpenAI uses a different SDK path — `AzureChatOpenAI` from the same package. Out of scope for MVP per PRD.

### 7.8 Tool errors must not throw

If an exception escapes a tool body, `ToolNode` (with default `handleToolErrors: true`) catches it and inserts a `ToolMessage` with the error text — the graph keeps running. But the *content* of that error message is `"Error: <stringified>"` which is unstructured. Cleaner: return our `Result.err` JSON string; the LLM gets structured info and reacts better. **Never throw — always stringify and return.**

### 7.9 Worker_threads inside Electron main

We do NOT need to run the agent in a worker_thread. The DB worker is already isolated. The agent's CPU cost is negligible (waiting on network). Keep agent in main process for simpler IPC + lifecycle.

---

## 8. Reference repos / templates

- **Official langgraphjs how-to notebooks** — most actionable resource. Each is a runnable .ipynb:
  - [`stream-tokens.ipynb`](https://github.com/langchain-ai/langgraphjs/blob/main/examples/how-tos/stream-tokens.ipynb) — exact pattern of `streamEvents` + `on_chat_model_stream` + `tool_call_chunks`.
  - [`streaming-events-from-within-tools.ipynb`](https://github.com/langchain-ai/langgraphjs/blob/main/examples/how-tos/streaming-events-from-within-tools.ipynb) — propagating events from inside a tool body (relevant if we add nested LLM calls in a tool later).
  - [`breakpoints.ipynb`](https://github.com/langchain-ai/langgraphjs/blob/main/examples/how-tos/breakpoints.ipynb) — the `interruptBefore: ['tools']` + `MemorySaver` pattern used for human-in-the-loop. **Note**: PRD's confirm flow is implemented via our own IPC roundtrip, not langgraph's interrupt — that is intentional and simpler. But this notebook shows the alternative.
  - [`manage-conversation-history.ipynb`](https://github.com/langchain-ai/langgraphjs/blob/main/examples/how-tos/manage-conversation-history.ipynb) — manual history filtering pattern.
- **`langchain-ai/create-agent-chat-app`** ([repo](https://github.com/langchain-ai/create-agent-chat-app)) — official scaffolder. Generates a Next.js + langgraph chat app. Useful to copy the streamEvents → SSE → React reducer flow, then adapt SSE to our IPC events. ~180 stars; maintained.
- We did not find a published Electron + langgraphjs reference. The closest analog is `vercel/ai-chatbot` for general streaming UX patterns; ignore the framework specifics, study the chat-state reducer.

---

## TL;DR for our project (5–7 bullets the implementer must follow)

1. **Install exactly three packages**: `@langchain/langgraph ^1.2.9`, `@langchain/openai ^1.4.5`, `@langchain/core ^1.1.44`. Pin core directly to dedupe. Skip the `langchain` umbrella for now.
2. **Build the agent with `createReactAgent` from `@langchain/langgraph/prebuilt`**. Pass `ChatOpenAI({ model, streaming: true, configuration: { baseURL, apiKey } })` and an array of tools. Optional `prompt: new SystemMessage(...)` for our system text. Total skeleton ≤ 30 lines (see §2).
3. **Define tools with `tool()` from `@langchain/core/tools` and Zod schemas directly**. langgraph converts to JSON schema internally. Tool body must return a **string** — stringify our `Result<T>` as JSON; **never throw**.
4. **Drive the UI from `agent.streamEvents(inputs, { version: 'v2', signal })`**. Listen for `on_chat_model_stream` (token deltas), `on_tool_start` / `on_tool_end` (tool lifecycle), and `on_chain_end` with `name === 'LangGraph'` (final). Emit one IPC event per case to the renderer.
5. **Wire one `AbortController` per inflight `messageId`**. Pass `signal` into `streamEvents`. On `chat.abort(messageId)`, call `ac.abort()`. The signal cascades to the underlying `openai` fetch and stops it. Clean up the controller on done/error.
6. **Manage history manually** — load all `ChatMessage` rows for the session from SQLite, map to `Human/AI/Tool/SystemMessage`, append the new turn, pass as `inputs.messages`. Use `trimMessages` from `@langchain/core/messages` if context grows. **Do NOT** use langgraph's checkpointer (conflicts with our SQLite schema).
7. **Implement the high-risk confirmation flow at the IPC layer, not via langgraph `interrupt()`**. Wrap dangerous tools (`task_delete`, `project_delete`, etc.) so their tool body itself awaits a confirm-roundtrip IPC message before calling `db.request`. Simpler than langgraph breakpoints + checkpointers and stays compatible with PRD §"高风险确认流程".
