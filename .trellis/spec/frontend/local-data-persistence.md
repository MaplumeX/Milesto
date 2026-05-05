# Local Data Persistence

> Contracts for Electron-local SQLite persistence and restart-safe renderer recovery.

## Scenario: AI Chat History Persistence

### 1. Scope / Trigger

- Trigger: AI chat history crosses renderer UI, preload IPC, main-process runtime, DB worker actions, and SQLite schema migrations.
- Use this contract when changing chat sessions/messages, local DB migrations, or restart-facing chat UI behavior.

### 2. Signatures

- Database path: `path.join(app.getPath('userData'), 'milesto.db')`.
- DB bootstrap: `initDb(dbPath: string): Database.Database`.
- SQLite tables: `chat_sessions` and `chat_messages`.
- DB worker actions:
  - `chat.listSessions({}) -> Result<ChatSession[]>`
  - `chat.createSession({ title?: string }) -> Result<ChatSession>`
  - `chat.renameSession({ id, title }) -> Result<ChatSession>`
  - `chat.deleteSession({ id }) -> Result<{ deleted: true }>`
  - `chat.listMessages({ session_id }) -> Result<ChatMessage[]>`
  - `chat.insertMessage({ session_id, role, content, tool_calls?, tool_call_id? }) -> Result<ChatMessage>`
- Renderer API:
  - `window.api.chat.listSessions()`
  - `window.api.chat.listMessages(sessionId)`
  - `window.api.chat.send(sessionId, content)`

### 3. Contracts

- Normal application startup must use the Electron `userData` path and must not create timestamped or temporary DB paths outside self-test mode.
- `chat_sessions.updated_at` orders the session list newest-first; renderer code may select `sessions[0]` as the most recent loaded session.
- `chat_messages.session_id` references `chat_sessions.id` with cascade delete.
- `tool_calls` is stored as JSON text and parsed back to `ChatMessage.tool_calls`; malformed JSON reads as `null`.
- `chat.insertMessage` must bump the parent session `updated_at`.
- DB bootstrap must be idempotent: if `user_version >= 12` but chat tables or indexes are missing, initialization must recreate them without dropping existing app data.
- When no active chat session is selected and loaded sessions exist, the chat panel should select the most recent session so restart/open does not look empty.

### 4. Validation & Error Matrix

- Invalid chat IPC/DB payload shape -> `VALIDATION_FAILED`.
- Missing session for rename/delete/list/insert -> `NOT_FOUND`.
- Invalid DB return shape at main IPC boundary -> `DB_INVALID_RETURN`.
- Failure to load sessions/messages in the renderer -> set the existing chat `error` state instead of silently showing an empty history.
- Missing chat tables/indexes during DB initialization -> repair with `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`.

### 5. Good/Base/Bad Cases

- Good: create a session, insert a user message, close the DB, reopen the same DB path, and `chat.listSessions` plus `chat.listMessages` return the original rows.
- Base: a new DB starts with no chat sessions; the chat panel shows an empty session list and no active session.
- Bad: a dev DB has `PRAGMA user_version = 12` but lacks chat tables; bootstrap must repair the schema instead of letting `listSessions` fail as an empty-looking UI.

### 6. Tests Required

- DB: reopen the same SQLite file and assert chat sessions/messages survive.
- DB: simulate missing chat tables with `user_version >= 12` and assert bootstrap repairs tables/indexes.
- Renderer: load existing sessions with no active session and assert the most recent session is selected and its messages are displayed.
- Renderer hook: failed session/message loading surfaces through `error`.
- Quality: run DB tests through `npm run test:db`, renderer tests through `npm test`, plus lint/typecheck for touched areas.

### 7. Wrong vs Correct

#### Wrong

```ts
if (userVersion < 12) {
  db.exec(`CREATE TABLE chat_sessions (...);`)
}
```

This only handles clean migrations and leaves schema-drifted databases broken.

#### Correct

```ts
if (userVersion < 12) {
  ensureChatSchema()
  db.pragma('user_version = 12')
}

if (!hasTable('chat_sessions') || !hasTable('chat_messages')) {
  ensureChatSchema()
}
```

The schema creation is idempotent and can repair partially migrated local databases.

## Scenario: AI Chat Rollback Persistence

### 1. Scope / Trigger

- Trigger: chat rollback changes SQLite chat history, renderer/preload/main API contracts, AI tool mutation journaling, and sync-facing task/project timestamps.
- Use this contract when adding rollback/edit/regenerate behavior or when changing AI-exposed task/project write tools.

### 2. Signatures

- Shared input: `ChatRollbackInputSchema = { session_id: IdSchema, message_id: IdSchema }`.
- Shared result: `ChatRollbackResultSchema = { restored_prompt, deleted_message_count, reverted_effect_count, conflict_count, conflicts }`.
- Renderer API: `window.api.chat.rollbackToMessage(sessionId, messageId): Promise<Result<ChatRollbackResult>>`.
- DB worker action: `chat.rollbackToMessage({ session_id, message_id }) -> Result<ChatRollbackResult>`.
- AI journal wrapper: `aiChat.runMutation({ context, action, payload }) -> Result<unknown>`, where `context` includes `session_id`, persisted `user_message_id`, runtime `run_message_id`, and `tool_name`.
- SQLite tables: `ai_chat_effect_batches` and `ai_chat_effect_rows`.

### 3. Contracts

- Rollback target must belong to the session and must be a `user` chat message.
- Rollback deletes the target user message and every later message in that same session only.
- Message ordering is `created_at ASC, rowid ASC`; use SQLite `rowid` for same-timestamp tie breaks. Do not use chat message `id` as an insertion-order proxy.
- `restored_prompt` is the deleted target user message content and is restored into the composer only after rollback succeeds.
- AI write tools must run through `aiChat.runMutation` when called from chat runtime so before/after snapshots are persisted in the same DB worker transaction as the domain mutation.
- Rollback applies journal batches for user messages in the deleted tail in reverse order before deleting chat messages.
- Rollback compensating writes use fresh `updated_at` timestamps so sync sees the rollback as newer local changes.
- Conflict checks compare current row state to the AI-produced `after_json`, but ignore `updated_at` because earlier reverse steps from the same rollback intentionally refresh that field.
- Created domain rows are soft-deleted on rollback when the table supports `deleted_at`; restored existing rows are written back from `before_json` with a fresh `updated_at`.

### 4. Validation & Error Matrix

- Invalid rollback payload shape -> `VALIDATION_FAILED`.
- Missing session -> `NOT_FOUND`.
- Missing message in the requested session -> `NOT_FOUND`.
- Non-user rollback target -> `VALIDATION_FAILED`.
- Invalid DB rollback result at main IPC boundary -> `DB_INVALID_RETURN`.
- Unknown or non-journalable AI mutation action -> `DB_UNKNOWN_ACTION` or `VALIDATION_FAILED`.
- Current row no longer matching the AI-produced state -> include a conflict item and continue rolling back non-conflicting rows.

### 5. Good/Base/Bad Cases

- Good: user rolls back a previous user turn; chat tail is deleted, AI-created tasks are soft-deleted, non-conflicting updates are restored, and the composer receives the removed prompt.
- Base: chat tail has no AI journal batches; rollback deletes chat messages and returns `reverted_effect_count: 0`.
- Bad: later user edits a task changed by the AI; rollback preserves that row, rolls back other rows, and returns conflict details instead of overwriting the user edit.
- Bad: multiple messages share the same `created_at`; rollback still deletes the inserted tail by `rowid`, not by lexicographic UUID order.

### 6. Tests Required

- DB: rollback deletion boundary, restored prompt, and session isolation.
- DB: same-timestamp messages delete by insertion order rather than UUID order.
- DB: journal capture for AI-created domain rows and reverse soft-delete.
- DB: multiple AI effects on the same row roll back without `updated_at` false conflicts.
- DB: later-edit conflict partially rolls back non-conflicting rows and reports conflict details.
- Renderer: rollback affordance is visible/accessible, successful rollback refreshes messages, restores the prompt, clears transient state, and surfaces conflict summary.

### 7. Wrong vs Correct

#### Wrong

```sql
DELETE FROM chat_messages
WHERE session_id = @session_id
  AND (created_at > @created_at OR (created_at = @created_at AND id >= @id));
```

This treats UUID text order as insertion order and can keep later messages created in the same millisecond.

#### Correct

```sql
DELETE FROM chat_messages
WHERE session_id = @session_id
  AND (created_at > @created_at OR (created_at = @created_at AND rowid >= @target_rowid));
```

Use the same `created_at ASC, rowid ASC` ordering for listing, tail selection, and deletion.
