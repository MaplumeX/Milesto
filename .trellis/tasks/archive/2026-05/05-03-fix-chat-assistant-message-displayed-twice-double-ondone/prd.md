# PRD: Fix Chat Assistant Message Displayed Twice

## Bug Description
In the AI chat panel, every assistant response appears twice in the message list.

## Root Cause
`electron/agent/agent-runtime.ts` calls `callbacks.onDone()` **twice** for a single assistant run:
1. Inside `streamEvents` loop on `on_chain_end` event (line 84).
2. After the loop exits unconditionally at line 93.

`electron/main.ts` registers an `onDone` handler that persists the assistant message to SQLite via `chat.insertMessage` (which auto-generates a new `uuidv7()` id with no deduplication). The double `onDone` triggers a double insert, resulting in two identical rows in `chat_messages`. `listMessages` then returns both, so the UI renders the message twice.

## Fix Plan
1. **Guard `onDone` to fire once only** in `agent-runtime.ts`.
2. **Also persist the user message** in `electron/main.ts` `chat:send` handler (currently missing), otherwise conversation history only contains assistant messages.

## Acceptance Criteria
- [ ] Sending a chat message produces exactly one assistant response bubble.
- [ ] No duplicate rows are created in `chat_messages` for a single assistant run.
- [ ] The user message is persisted to `chat_messages` before the assistant run starts.
- [ ] Existing tests pass (`npm run test`).
