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
