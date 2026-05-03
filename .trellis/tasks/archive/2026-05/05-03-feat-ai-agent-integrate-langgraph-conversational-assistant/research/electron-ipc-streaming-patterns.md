# Research: Electron IPC Streaming Patterns for LLM Token Deltas

- **Query**: Electron main → renderer streaming for high-frequency events (~30–100 events/sec) — performance, memory, teardown, security, testing
- **Scope**: mixed (project codebase + external Electron docs)
- **Date**: 2026-05-03

This document is specific to **Milesto** (Electron 30, contextIsolation, React 18 + StrictMode, existing pubsub via `webContents.send` / `ipcRenderer.on`).

---

## 1. Transport: `webContents.send` vs `MessagePort` for ~50 events/sec

### Existing project transport

The project already streams events with `webContents.send` + `ipcRenderer.on`:

- Main side `electron/main.ts:1054-1063`:
  ```ts
  function broadcastSyncState(state: SyncState) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('sync:stateChanged', state)
    }
  }
  ```
- Preload bridge `electron/preload.ts:182-191`:
  ```ts
  onStateChange: (callback) => {
    const handler = (_event: unknown, state: unknown) =>
      callback(state as import('../shared/schemas/sync').SyncState)
    ipcRenderer.on('sync:stateChanged', handler)
    return () => ipcRenderer.removeListener('sync:stateChanged', handler)
  },
  ```

This is the idiomatic pattern; there is no existing `MessagePort` use anywhere.

### Comparison

| Aspect | `webContents.send` (current) | `MessagePort` (`MessageChannelMain`) |
|---|---|---|
| Throughput | Comfortably handles thousands/sec | Lower per-msg overhead; better for sustained >=1 kHz |
| Setup | Trivial | Must manage port lifecycle |
| Security | Fits `ensureTrustedSender()` for inbound; outbound already trusted | No built-in origin check |
| Backpressure | None (fire-and-forget) | None |
| Pattern fit | Matches existing `sync:*` events | Net-new; would be the only `MessagePort` consumer |
| Multi-stream | Done by tagging payload with `messageId` | Could allocate one port per stream (unnecessary) |

**Conclusion:** Use `webContents.send` with a single channel (e.g. `agent:event`) and discriminate by `messageId` in the payload. 30–100 events/sec for seconds is well within its envelope. Reserve `MessagePort` for if/when we need >1 kHz.

### Performance notes

- Each `webContents.send` is structured-clone. Keep deltas small (only the new token text + ids, not the entire message).
- `webContents.send` is non-blocking; the renderer batches via V8 microtasks. At 100 Hz, coalesce in the renderer (e.g. `requestAnimationFrame`-batched setState) to avoid React thrashing.
- Always guard with `if (win && !win.isDestroyed())` before sending.

---

## 2. Exposing a streaming subscription through `contextBridge` + `Result<T>` typing

### Project convention

`sync.onStateChange` (`shared/window-api.ts:217-218`) returns the unsubscribe function, not a `Promise<Result<void>>`. Streaming events from main use raw `T`, not `Result<T>`. Errors mid-stream are encoded inside the event payload as a discriminated union.

### Recommended shape

Add to `shared/window-api.ts` under a new `agent` namespace:

```ts
export type AgentEvent =
  | { type: 'token'; messageId: string; sessionId: string; delta: string }
  | { type: 'tool_call'; messageId: string; sessionId: string; toolName: string; args: unknown }
  | { type: 'tool_result'; messageId: string; sessionId: string; toolName: string; result: unknown }
  | { type: 'message_complete'; messageId: string; sessionId: string; finishReason: 'stop' | 'tool_use' | 'cancelled' | 'error' }
  | { type: 'error'; messageId: string; sessionId: string; error: AppError }

agent: {
  sendMessage(input: { sessionId: string; messageId: string; content: string }): Promise<Result<{ messageId: string }>>
  cancelMessage(input: { messageId: string }): Promise<Result<void>>
  onEvent(callback: (event: AgentEvent) => void): () => void
}
```

### Preload implementation

```ts
agent: {
  sendMessage: (input) => invoke('agent:sendMessage', input),
  cancelMessage: (input) => invoke('agent:cancelMessage', input),
  onEvent: (callback) => {
    const handler = (_event: unknown, payload: unknown) =>
      callback(payload as import('../shared/schemas/agent').AgentEvent)
    ipcRenderer.on('agent:event', handler)
    return () => ipcRenderer.removeListener('agent:event', handler)
  },
},
```

### Main side

```ts
function broadcastAgentEvent(event: AgentEvent) {
  if (!win || win.isDestroyed()) return
  const parsed = AgentEventSchema.safeParse(event)
  if (!parsed.success) {
    console.error('[agent] dropped invalid event', parsed.error.issues)
    return
  }
  win.webContents.send('agent:event', parsed.data)
}
```

`webContents.send` is outbound so `ensureTrustedSender` does not apply. The renderer trusts main implicitly because preload is the only path into `window.api`.

---

## 3. Backpressure / dropped events

`webContents.send` does not apply backpressure. It serialises into the IPC pipe and returns synchronously. At 100 events/sec x 200-byte payloads (~20 KB/s), this is trivial.

The renderer is the bottleneck, not IPC. Coalesce token events with `requestAnimationFrame` (<= 60 Hz). Tool-call / completion events should not be coalesced — they are control events and must land immediately.

No buffering in main is needed. LangGraph's stream itself is the backpressure mechanism (it `await`s the LLM SDK). The path is:

```
LLM SDK -> LangGraph stream (async iterator) -> for-await loop in main -> webContents.send
```

### Known issue

`webContents.send` has a ~128 MiB practical ceiling per message and degraded perf above ~1 MiB. Token deltas are <= 1 KB each, so this is irrelevant. Never send the entire accumulated transcript per event.

---

## 4. Memory leaks: listener teardown + React StrictMode

### Core invariant

For every `ipcRenderer.on(channel, handler)` there must be exactly one `ipcRenderer.removeListener(channel, handler)`. The existing pattern enforces this by returning an unsubscribe closure that captures the same `handler` reference.

### React StrictMode double-mount

`src/main.tsx:39-41` wraps the app in `<React.StrictMode>`. In dev, this runs every effect twice: mount -> cleanup -> mount. If the unsubscribe function is correct, listeners stay balanced.

```ts
// WRONG — leaks one listener per StrictMode pass
useEffect(() => {
  window.api.agent.onEvent((e) => handle(e))
  // missing return
}, [])

// RIGHT
useEffect(() => {
  const unsubscribe = window.api.agent.onEvent(handle)
  return unsubscribe
}, [])
```

The existing `AppEventsContext.tsx:50-55` and `SyncSettingsPanel.tsx:36-40` follow this pattern.

### Stale callback sub-pitfall

In React, the callback passed in changes on every render. If subscribed once on mount, the callback inside preload remains the first render's closure. Options:

1. **Stable callback** via `useRef` + dispatch:
   ```ts
   const cbRef = useRef(handle)
   cbRef.current = handle
   useEffect(() => window.api.agent.onEvent((e) => cbRef.current(e)), [])
   ```
2. Re-subscribe on dependency change (acceptable here — `onEvent` is cheap).

For the Chat Panel, option 1 is recommended because we will dispatch into a reducer.

---

## 5. Multiple in-flight streams: scoping by `messageId`

- The renderer generates `messageId` (UUID) when the user submits and passes it into `agent.sendMessage`.
- Every event carries the same `messageId`. The renderer maintains a map `streamingByMessageId` and dispatches each event by its `messageId`. Stale streams are simply ignored.
- Include both `sessionId` (conversation-level filter) and `messageId` (per-turn dispatch).

### Why a single channel beats multiple channels

Allocating a unique channel per stream (e.g. `agent:event:${messageId}`) is harmful:
- Each channel needs its own `ipcRenderer.on` + cleanup -> leak risk.
- `ipcMain` has a default MaxListeners = 10 warning threshold; per-message channels would trip it.
- Renderer-side dispatch by `messageId` field is O(1) and trivial.

**Use one channel `agent:event` always.**

---

## 6. AbortController round-trip (renderer cancel -> main -> LangGraph)

The renderer cannot send an `AbortSignal` over IPC (signals are not structured-cloneable). Instead:

1. Main keeps a `Map<messageId, AbortController>`.
2. `agent:sendMessage` creates an `AbortController`, stores it under `messageId`, passes `signal` into LangGraph.
3. When the stream ends (success/error), main deletes the entry.
4. Renderer calls `agent.cancelMessage({ messageId })` -> main looks up the controller -> `controller.abort()` -> LangGraph rejects the for-await loop -> main emits a final `{ type: 'message_complete', finishReason: 'cancelled' }` event.

### Code skeleton (main)

```ts
const inFlight = new Map<string, AbortController>()

async function startStream(input: { messageId: string; sessionId: string; content: string }) {
  const ac = new AbortController()
  inFlight.set(input.messageId, ac)
  try {
    const stream = langGraphRunnable.stream(input, { signal: ac.signal })
    for await (const chunk of stream) {
      if (ac.signal.aborted) break
      broadcastAgentEvent(toAgentEvent(input.messageId, input.sessionId, chunk))
    }
    broadcastAgentEvent({
      type: 'message_complete',
      messageId: input.messageId,
      sessionId: input.sessionId,
      finishReason: ac.signal.aborted ? 'cancelled' : 'stop',
    })
  } catch (e) {
    broadcastAgentEvent({ type: 'error', messageId: input.messageId, sessionId: input.sessionId, error: toAppError(e) })
  } finally {
    inFlight.delete(input.messageId)
  }
}

// IPC handlers
ipcMain.handle('agent:sendMessage', async (event, payload) => {
  const senderErr = ensureTrustedSender(event); if (senderErr) return /* err result */
  // Validate, then spawn but DO NOT await — return immediately so renderer continues.
  void startStream(parsed.data)
  return ok({ messageId: parsed.data.messageId })
})

ipcMain.handle('agent:cancelMessage', async (event, payload) => {
  const senderErr = ensureTrustedSender(event); if (senderErr) return ResultVoidSchema.parse(err(senderErr))
  inFlight.get(parsed.data.messageId)?.abort()
  return ResultVoidSchema.parse(ok(undefined))
})
```

`sendMessage` returns immediately — the work happens asynchronously and emits events.

---

## 7. Security: forwarding LLM-generated content to the renderer

### Threat model

The streamed `delta` is assistant text — adversarially controllable via prompt injection. It will be rendered by the Chat Panel.

### Sanitisation responsibilities

| Layer | Responsibility |
|---|---|
| Main process | Schema-validate every event with zod (`AgentEventSchema.safeParse`). Drop malformed events. Cap `delta.length` (e.g. 10 KB per chunk) to avoid renderer OOM if model misbehaves. |
| Renderer | Render `delta` as text content, not HTML. If using `react-markdown` (already a dep), do NOT enable `rehype-raw`; leave the default which escapes inline HTML. |
| CSP | `electron/main.ts:162-174` already sets `script-src 'self' 'unsafe-inline'` (no `unsafe-eval`). Streaming text never executes scripts under this policy. |

### What NOT to do

- Do not `dangerouslySetInnerHTML` the streamed text.
- Do not add `rehype-raw` / `remark-html-passthrough` to the markdown pipeline.
- Do not loosen CSP for the chat panel.

### Other security notes

- API keys (OpenAI/Anthropic) MUST stay in main only. They never appear in any agent event payload. Redact them from `AppError.details`.
- `messageId` and `sessionId` should be opaque UUIDs, not file paths or DB rowids.

---

## 8. Testing in happy-dom + Vitest

### Existing setup

`tests/setup/fast.ts:29-37` installs a complete `window.api` mock at the start of every test via `createWindowApiMock()` (`tests/renderer/window-api-mock.ts`). The mock stubs `sync.onStateChange` / `sync.onDataChanged` returning a no-op unsubscribe.

### Adding `agent` to the mock

```ts
agent: {
  sendMessage: vi.fn<WindowApi['agent']['sendMessage']>(async () => ok({ messageId: 'test' })),
  cancelMessage: vi.fn<WindowApi['agent']['cancelMessage']>(async () => ok(undefined)),
  onEvent: vi.fn<WindowApi['agent']['onEvent']>(() => () => {}),
},
```

### Per-test override pattern (replay events)

Capture the callback so the test can drive events:

```ts
it('streams tokens into the message bubble', async () => {
  let emit: ((e: AgentEvent) => void) | null = null
  window.api.agent.onEvent = vi.fn((cb) => { emit = cb; return () => { emit = null } })

  render(<ChatPanel />)
  act(() => {
    emit!({ type: 'token', messageId: 'm1', sessionId: 's1', delta: 'Hel' })
    emit!({ type: 'token', messageId: 'm1', sessionId: 's1', delta: 'lo' })
    emit!({ type: 'message_complete', messageId: 'm1', sessionId: 's1', finishReason: 'stop' })
  })
  // Flush rAF batching in happy-dom
  await act(async () => { await new Promise((r) => setTimeout(r, 16)) })

  expect(screen.getByTestId('assistant-message')).toHaveTextContent('Hello')
})
```

Teardown (unmount → unsubscribe called once) and cancel (clicking Stop calls `cancelMessage` with the right `messageId`) follow the same pattern: override the mock with `vi.fn`, render, act, assert call count/args.

### happy-dom limitations

- `requestAnimationFrame` exists but does not auto-fire in fake timers. Either call `await new Promise(r => setTimeout(r, 16))` after `act()`, or stub rAF via `vi.useFakeTimers()` + `vi.runOnlyPendingTimersAsync()`.
- The real `ipcRenderer` is not present — nothing to test about preload code at the unit level. Cover preload behaviour in the DB worker / e2e self-test layer instead.

---

## TL;DR for our project

1. **Use `webContents.send` on a single channel `agent:event`**, scoped by `messageId` in the payload. Do not introduce `MessagePort` or per-stream channels.
2. **Mirror the `sync.onStateChange` shape** in `WindowApi.agent.onEvent(cb): () => unsubscribe`. Streaming events use raw `T`, never `Result<T>`. Encode mid-stream errors inside the event payload as a discriminated union.
3. **Validate every outbound event with zod** in main before `webContents.send`, just like inbound IPC is validated by `handleDb`. Add `AgentEventSchema` to `shared/schemas/agent.ts`.
4. **Cap delta size and coalesce token re-renders in the renderer** with `requestAnimationFrame` batching; do not setState per event. Tool-call/complete events bypass the buffer.
5. **Keep an `inFlight: Map<messageId, AbortController>` in main.** `cancelMessage` IPC looks up and aborts; the for-await loop emits a final `message_complete{finishReason:'cancelled'}`. `sendMessage` returns immediately after spawning the stream.
6. **Always return the unsubscribe closure** from `onEvent` and call it in the React effect cleanup. Do not rely on `ipcRenderer.removeAllListeners`. Account for StrictMode double-mount by ensuring effects are cleanup-symmetric.
7. **Render assistant text as markdown without `rehype-raw`**, never via `dangerouslySetInnerHTML`. The existing CSP is sufficient — do not loosen it. Redact API keys from any `AppError.details` payload.
8. **Extend `tests/renderer/window-api-mock.ts` with an `agent` mock**. For streaming tests, override `onEvent` to capture the callback and drive events from the test, wrapping in `act()` and flushing rAF with a 16 ms timeout.

## Caveats / Not Found

- I did not benchmark `webContents.send` at 100 Hz inside this project — the recommendation is based on Electron's documented IPC envelope and the trivial size of token deltas. If the implementer sees jank, profile the renderer first (likely React rendering, not IPC).
- Electron 30 does not have `webFrameMain` event-based unsubscription helpers in the project; we rely on `ipcRenderer.removeListener`. If we ever introduce multiple BrowserWindows, scope `webContents.send` to the right window (currently `win` is a singleton in `electron/main.ts:143`).
- LangGraph's stream-cancellation semantics depend on the runnable. Verify that the chosen runnable respects `AbortSignal` before relying on the cancel round-trip; if not, fall back to a manual flag checked in the for-await loop.
