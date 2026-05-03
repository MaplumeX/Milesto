# Cross-Layer Thinking Guide

> **Purpose**: Think through data flow across layers before implementing.

---

## The Problem

**Most bugs happen at layer boundaries**, not within layers.

Common cross-layer bugs:
- API returns format A, frontend expects format B
- Database stores X, service transforms to Y, but loses data
- Multiple layers implement the same logic differently

---

## Before Implementing Cross-Layer Features

### Step 1: Map the Data Flow

Draw out how data moves:

```
Source → Transform → Store → Retrieve → Transform → Display
```

For each arrow, ask:
- What format is the data in?
- What could go wrong?
- Who is responsible for validation?

### Step 2: Identify Boundaries

| Boundary | Common Issues |
|----------|---------------|
| API ↔ Service | Type mismatches, missing fields |
| Service ↔ Database | Format conversions, null handling |
| Backend ↔ Frontend | Serialization, date formats |
| Component ↔ Component | Props shape changes |

### Step 3: Define Contracts

For each boundary:
- What is the exact input format?
- What is the exact output format?
- What errors can occur?

---

## Common Cross-Layer Mistakes

### Mistake 1: Implicit Format Assumptions

**Bad**: Assuming date format without checking

**Good**: Explicit format conversion at boundaries

### Mistake 2: Scattered Validation

**Bad**: Validating the same thing in multiple layers

**Good**: Validate once at the entry point

### Mistake 3: Leaky Abstractions

**Bad**: Component knows about database schema

**Good**: Each layer only knows its neighbors

### Mistake 4: Putting LLM Secrets in Renderer

**Bad**: Instantiating `ChatOpenAI` or storing `apiKey` in the renderer process.

**Good**: Run the agent runtime entirely in the **main process**. The renderer sends messages via `window.api.chat.send()` and receives tokens via IPC events. The API key never leaves main + DB worker.

### Pattern: Main-Process Agent with Streaming IPC

When integrating an LLM agent (e.g. LangGraph) into the Electron app:

1. **Agent runtime lives in main** — `electron/agent/agent-runtime.ts` creates the graph, calls the LLM, runs tools.
2. **Tools call DB worker directly** — reuse `dbWorker.request(action, payload)`; do NOT call `window.api.*` from main.
3. **Streaming via IPC events** — main subscribes to `streamEvents`, then `win.webContents.send('chat:messageDelta', payload)`.
4. **Renderer subscribes and unsubscribes** — mirror `sync.onStateChange`: return `() => void` unsubscribe, plain payload (not `Result<T>`).
5. **High-risk confirm at IPC layer** — tools `await confirmGate(action, summary)` which emits `onConfirmRequest` to renderer; renderer calls `chat.confirmRespond`; do NOT use langgraph `interrupt()` + `checkpointer` (creates dual source of truth with SQLite).
6. **Abort via AbortController** — pass `signal` into `streamEvents`; renderer calls `chat.abort(messageId)` → main calls `controller.abort()`.
7. **Bump revision after writes** — agent tools that mutate data should trigger `broadcastSyncDataChanged()` so renderer's `AppEventsContext` refreshes views.

---

## Checklist for Cross-Layer Features

Before implementation:
- [ ] Mapped the complete data flow
- [ ] Identified all layer boundaries
- [ ] Defined format at each boundary
- [ ] Decided where validation happens

After implementation:
- [ ] Tested with edge cases (null, empty, invalid)
- [ ] Verified error handling at each boundary
- [ ] Checked data survives round-trip

---

## When to Create Flow Documentation

Create detailed flow docs when:
- Feature spans 3+ layers
- Multiple teams are involved
- Data format is complex
- Feature has caused bugs before
