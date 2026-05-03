# Fix AI chat session persistence

## Goal

AI chat sessions and messages must remain visible after the Milesto desktop app restarts. A user who creates a chat session, sends messages, quits the app, and opens it again should see the prior session history without needing to recreate anything.

## What I Already Know

* User reports that historical AI chat sessions disappear after app restart.
* Chat schema exists in SQLite as `chat_sessions` and `chat_messages`.
* Main process opens the database at `app.getPath('userData')/milesto.db`.
* Self-test mode overrides `userData` to a timestamped temporary directory, but normal startup does not appear to intentionally use a temporary DB.
* `chat.createSession`, `chat.listSessions`, `chat.listMessages`, and `chat.insertMessage` all route through the DB worker.
* `ChatPanel` stores the active chat session id only in React state, initially `null`.
* The frontend loads session rows on mount but does not select the most recent session automatically.
* The DB migration creates chat tables only when `user_version < 12`; there are defensive checks for some older schema drift, but not for missing chat tables.

## Assumptions

* The user is describing the app's built-in AI chat panel, not the Codex/Trellis developer session.
* Existing task/project data should keep using the same database path; this task should not introduce a second storage location.
* Fixing missing-table schema drift and restoring the visible active session are both acceptable because either can make sessions appear lost after restart.

## Requirements

* AI chat sessions must be stored in durable SQLite storage under the normal app `userData` path.
* On app startup/restart, the chat panel must show previously created sessions from SQLite.
* If sessions exist and no active session is selected, the UI should select a sensible existing session, preferably the most recently updated one.
* Existing databases with `user_version >= 12` but missing chat tables or indexes must be repaired defensively during DB initialization.
* The fix must not delete or reset existing chat, task, project, settings, or sync data.
* Errors from chat session loading should remain observable enough for diagnosis instead of silently making the feature look empty where practical.

## Acceptance Criteria

* [ ] A DB-level regression test proves chat sessions and messages remain after closing and re-opening the same SQLite file.
* [ ] A DB-level regression test proves defensive initialization creates chat tables when `user_version` is already at or above 12 but chat tables are missing.
* [ ] A renderer-level regression test proves existing sessions can be auto-selected after loading so the user sees history after restart/opening chat.
* [ ] Relevant lint/typecheck/test commands pass.

## Definition Of Done

* Tests added or updated for persistence and restart-facing behavior.
* Lint/typecheck pass for touched areas.
* The implementation follows existing DB bootstrap, IPC, hook, and React component patterns.
* No unrelated refactors or data resets.

## Out Of Scope

* Syncing AI chat history across devices.
* Persisting in-flight streaming deltas, tool events, or runtime errors as durable chat messages.
* Redesigning the chat UI.
* Changing where the whole Milesto app stores user data.

## Technical Notes

* Likely files: `electron/workers/db/db-bootstrap.ts`, `tests/db/chat-actions.test.ts`, `src/features/chat/ChatPanel.tsx`, `src/features/chat/use-chat-streaming.ts`, and `tests/renderer/use-chat-streaming.test.tsx`.
* Inspect whether the best fix is in DB bootstrap, frontend active-session restoration, or both.
* Avoid putting code files in `implement.jsonl` / `check.jsonl`; sub-agents will inspect code directly.
