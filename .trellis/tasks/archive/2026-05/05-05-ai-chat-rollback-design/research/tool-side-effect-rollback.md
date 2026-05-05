# Research: AI tool side-effect rollback

- Query: How do current AI tool write operations mutate task/project data, and what design can roll those side effects back when a chat tail is rolled back?
- Scope: internal
- Date: 2026-05-05

## Findings

### Files found

- `electron/main.ts` — chat IPC builds the runtime, persists chat messages, wires AI write-tool revision callbacks, and handles abort/confirmation.
- `electron/agent/agent-runtime.ts` — LangGraph streaming runtime emits tool start/end events but does not persist tool-call metadata.
- `electron/agent/tools/task-write-tools.ts` — AI-exposed task write tools: create/update/toggle/cancel/restore/convert/setTags/delete.
- `electron/agent/tools/project-tools.ts` — AI-exposed project write tools: create/update/complete/cancel/delete/setTags/section create/rename/delete/list.
- `electron/agent/tools/task-tools.ts`, `electron/agent/tools/area-tools.ts`, `electron/agent/tools/tag-tools.ts` — AI read tools for tasks/areas/tags; tag tool currently exposes list only.
- `electron/workers/db/actions/task-actions.ts` — authoritative task mutations, including transactions and sync timestamp updates.
- `electron/workers/db/actions/project-actions.ts` — authoritative project/section mutations and cascade behavior.
- `electron/workers/db/actions/tag-actions.ts` — tag mutations and `task.setTags`; only `task.setTags` is currently exposed to AI write tools.
- `electron/workers/db/actions/sync-support.ts` — local sync recorder interface is currently a no-op; relation replacement helpers mutate tag relations directly.
- `electron/workers/db/actions/sync-actions.ts` — sync pending changes are derived from rows with `updated_at > last_sync_at`.
- `electron/workers/db/actions/trash-actions.ts` — restore/purge semantics for deleted tasks/projects/sections.
- `electron/workers/db/actions/chat-actions.ts` — chat message persistence has sessions/messages only, no branch/tail/delete metadata and no tool-effect link.
- `shared/schemas/chat.ts`, `electron/preload.ts`, `src/features/chat/use-chat-streaming.ts` — chat schemas/API/hook state; rollback API is not present yet.
- `electron/workers/db/db-bootstrap.ts` — schema includes hard chat rows, soft-delete domain rows, FTS triggers, and sync state.

### Current AI mutation flow

- `chat:send` loads all persisted chat messages for the session into LangChain history before adding the current user message, so future context is exactly what remains in `chat_messages` after a rollback (`electron/main.ts:1254`, `electron/main.ts:1257`, `electron/main.ts:1292`).
- The main process persists the current user message via `chat.insertMessage`, but it currently ignores the returned persisted chat message id (`electron/main.ts:1295`). The streaming `messageId` is a runtime id generated before the DB insert (`electron/main.ts:1250`), not a `chat_messages.id`.
- Tool events are broadcast to the renderer (`electron/main.ts:1336`, `electron/main.ts:1339`) but the final assistant row is stored with `tool_calls: null` and no tool rows are inserted (`electron/main.ts:1346`, `electron/main.ts:1350`). The DB therefore cannot currently infer which domain writes belong to which user turn.
- The runtime emits `on_tool_start` and `on_tool_end` from LangGraph events (`electron/agent/agent-runtime.ts:74`, `electron/agent/agent-runtime.ts:78`), but those callbacks only carry transient stream UI data.
- AI write tools call `db.request(...)` directly and bump renderer revision on success (`electron/agent/tools/task-write-tools.ts:19`, `electron/agent/tools/task-write-tools.ts:29`, `electron/agent/tools/project-tools.ts:19`, `electron/agent/tools/project-tools.ts:27`). There is no mutation id, source marker, transaction id, or inverse payload.
- High-risk tools pause on `confirmGate` before running the DB mutation (`electron/agent/tools/task-write-tools.ts:189`, `electron/agent/tools/task-write-tools.ts:194`, `electron/agent/tools/project-tools.ts:83`, `electron/agent/tools/project-tools.ts:88`). Confirmation is not a rollback boundary; it only gates execution.

### Current write surface that rollback must handle

- Task tools:
  - `task_create` inserts a task with generated id, normalized bucket flags, and optional soft-deleted state for trash scope (`electron/agent/tools/task-write-tools.ts:17`, `electron/workers/db/actions/task-actions.ts:233`, `electron/workers/db/actions/task-actions.ts:311`).
  - `task_update` can change title/notes/project/area/section/schedule/due/bucket flags and always touches `updated_at` even when no fields changed (`electron/agent/tools/task-write-tools.ts:52`, `electron/workers/db/actions/task-actions.ts:397`, `electron/workers/db/actions/task-actions.ts:495`).
  - `task_toggleDone`, `task_cancel`, and `task_restore` mutate `status`, `completed_at`, and `updated_at` (`electron/agent/tools/task-write-tools.ts:91`, `electron/agent/tools/task-write-tools.ts:111`, `electron/agent/tools/task-write-tools.ts:130`, `electron/workers/db/actions/task-actions.ts:520`, `electron/workers/db/actions/task-actions.ts:612`, `electron/workers/db/actions/task-actions.ts:688`).
  - `task_convertToProject` creates a project and child tasks from checklist items, transfers tags, and marks the source task/checklist as deleted/purged; this is the most complex inverse in the AI task surface (`electron/agent/tools/task-write-tools.ts:149`, `electron/workers/db/actions/task-actions.ts:791`, `electron/workers/db/actions/task-actions.ts:907`).
  - `task_setTags` replaces the full task tag set and bumps task `updated_at` (`electron/agent/tools/task-write-tools.ts:168`, `electron/workers/db/actions/tag-actions.ts:213`, `electron/workers/db/actions/tag-actions.ts:245`).
  - `task_delete` soft-deletes a task into Trash after confirmation (`electron/agent/tools/task-write-tools.ts:187`, `electron/workers/db/actions/task-actions.ts:740`, `electron/workers/db/actions/task-actions.ts:760`).
- Project tools:
  - `project_create` inserts a project and records it with the local sync recorder (`electron/agent/tools/project-tools.ts:17`, `electron/workers/db/actions/project-actions.ts:256`, `electron/workers/db/actions/project-actions.ts:291`).
  - `project_update` changes project fields/status and may set/clear `completed_at` (`electron/agent/tools/project-tools.ts:48`, `electron/workers/db/actions/project-actions.ts:394`, `electron/workers/db/actions/project-actions.ts:478`).
  - `project_complete` and `project_cancel` mutate the project and all open child tasks in one transaction (`electron/agent/tools/project-tools.ts:81`, `electron/agent/tools/project-tools.ts:108`, `electron/workers/db/actions/project-actions.ts:622`, `electron/workers/db/actions/project-actions.ts:681`, `electron/workers/db/actions/project-actions.ts:730`, `electron/workers/db/actions/project-actions.ts:787`).
  - `project_delete` soft-deletes the project plus its active tasks and project sections (`electron/agent/tools/project-tools.ts:135`, `electron/workers/db/actions/project-actions.ts:534`, `electron/workers/db/actions/project-actions.ts:570`, `electron/workers/db/actions/project-actions.ts:576`).
  - `project_setTags` replaces the full project tag set and bumps project `updated_at` (`electron/agent/tools/project-tools.ts:161`, `electron/workers/db/actions/project-actions.ts:337`, `electron/workers/db/actions/project-actions.ts:369`).
  - `project_createSection`, `project_renameSection`, and `project_deleteSection` mutate section rows; delete-section is high-risk and moves tasks to a previous section according to the tool description (`electron/agent/tools/project-tools.ts:180`, `electron/agent/tools/project-tools.ts:200`, `electron/agent/tools/project-tools.ts:219`, `electron/workers/db/actions/project-actions.ts:913`, `electron/workers/db/actions/project-actions.ts:1016`).

### Sync and trash constraints

- Domain rows are soft-deleted with `deleted_at`; tasks/projects/sections also have `purged_at` columns (`electron/workers/db/db-bootstrap.ts:96`, `electron/workers/db/db-bootstrap.ts:110`, `electron/workers/db/db-bootstrap.ts:130`, `electron/workers/db/db-bootstrap.ts:410`).
- FTS indexes remove tasks on soft-delete and reinsert on restore via triggers (`electron/workers/db/db-bootstrap.ts:219`, `electron/workers/db/db-bootstrap.ts:225`), so rollback that toggles `deleted_at` should keep search state consistent.
- Trash restore may rewrite relationships when the original parent area/project/section is no longer active, for example restoring a task to Inbox if its original container is not restorable (`electron/workers/db/actions/trash-actions.ts:477`, `electron/workers/db/actions/trash-actions.ts:540`). This is useful user-facing behavior but not a precise inverse.
- The local sync recorder exists but is a no-op today (`electron/workers/db/actions/sync-support.ts:91`). Actual sync pushes are derived by scanning rows newer than `last_sync_at` (`electron/workers/db/actions/sync-actions.ts:49`, `electron/workers/db/actions/sync-actions.ts:197`).
- Sync push sends each pending row over WebSocket without a per-change ack or durable outbox (`electron/sync/sync-engine.ts:246`, `electron/sync/sync-engine.ts:257`). A rollback implemented as newer compensating writes will sync as normal LWW changes, but it cannot unsend older changes already pushed to another device.
- Server/client conflict behavior is LWW by `updated_at` according to `.trellis/spec/server/sync-protocol.md`; rollback writes must use fresh timestamps and should not try to reuse old `updated_at` values.

### Chat rollback boundary constraints

- `chat_messages` has no soft-delete, branch, turn id, source run id, or side-effect metadata (`electron/workers/db/db-bootstrap.ts:45`, `shared/schemas/chat.ts:29`).
- `chat.listMessages` orders by `(created_at ASC, id ASC)` (`electron/workers/db/actions/chat-actions.ts:227`), so chat-tail deletion can use that ordering tuple, but side effects need their own linkage to the persisted user message id.
- The renderer hook already clears stream state on done/error/abort and can abort a running active-session message (`src/features/chat/use-chat-streaming.ts:197`, `src/features/chat/use-chat-streaming.ts:301`). A rollback API should reuse that clearing path and then reload DB messages.
- `chat.deleteSession` hard-deletes all session messages (`electron/workers/db/actions/chat-actions.ts:178`); there is no existing message-tail delete primitive.

## Feasible approaches

### Approach 1: Per-tool inverse operation log in the AI tool layer

Capture a pre-state in each AI tool before calling `db.request`, then write an `ai_tool_effects` row after a successful result. Rollback reads effects for the deleted tail in reverse order and applies inverse DB actions.

Pros:
- Smallest conceptual change to the DB action layer.
- Easy to link effects to `session_id`, runtime `messageId`, and the persisted user message id once `chat:send` stores the insert result.
- Lets the UI show "this rollback will revert N tool actions" later.

Cons:
- Not atomic with the underlying DB mutation; a crash between mutation success and effect-log insert leaves an untracked side effect.
- Tool-layer prefetches must mirror DB action internals. Complex actions like `project_delete`, `project_complete`, and `task_convertToProject` require broad snapshots and are easy to get wrong.
- Inverses implemented as public domain actions may trigger user-facing trash restore fallback semantics instead of exact restoration.

Best use:
- Acceptable as a prototype only if the first milestone limits AI rollback to simple creates/updates/tags and blocks or warns on complex tools.

### Approach 2: DB-worker mutation journal tied to AI context (recommended)

Add an optional AI mutation context to write action payloads or to a DB-worker scoped action wrapper: `{ source: 'ai_chat', session_id, run_message_id, user_message_id, tool_call_id, tool_name }`. Each relevant DB action captures before/after row snapshots inside its existing transaction and writes them to a journal table before commit.

Suggested schema shape:
- `ai_chat_effect_batches(id, session_id, user_message_id, run_message_id, tool_name, tool_call_id, created_at, reverted_at, rollback_chat_message_id)`
- `ai_chat_effect_rows(batch_id, order_index, table_name, entity_id, before_json, after_json, operation)`

Rollback flow:
1. Abort an inflight run for the active session when needed.
2. In one DB transaction, find the target user message and tail boundary.
3. Find effect batches whose `user_message_id` is in the deleted tail.
4. Apply effect rows in reverse batch/order.
5. Hard-delete chat tail rows from `chat_messages`.
6. Update `chat_sessions.updated_at`.
7. Broadcast `sync:dataChanged` / bump revision after success.

Pros:
- Captures precise state in the same transaction as each mutation, avoiding the crash gap.
- Reuses existing DB action knowledge and existing transaction boundaries.
- Can model cascade mutations exactly, including project delete/complete/cancel and task convert-to-project.
- Gives rollback an auditable, typed basis without relying on assistant text or transient stream events.

Cons:
- Requires touching every AI-exposed write path in task/project/tag action modules.
- Needs careful snapshot helpers to avoid hand-copying table column lists incorrectly.
- Needs conflict policy for rows changed after the AI effect.

Conflict policy recommendation:
- Default to guarded rollback. For each effect row, require the current row to still match `after_json` for changed fields or at least match the `after_json.updated_at`. If not, skip the row and return a typed `ROLLBACK_CONFLICT` with details. This avoids overwriting later user edits.
- For created rows, if the row still matches the AI-created `after_json`, mark it `deleted_at` or `purged_at` with a fresh timestamp rather than hard-deleting if sync may be enabled.
- For deleted/restored rows, restore exact `before_json` only when the current row is still in the AI-produced deleted/restored state and not purged by another action.

### Approach 3: SQLite savepoint/database snapshot around an AI run

Snapshot the local DB at the beginning of a chat run, execute all tools, and on rollback restore the snapshot.

Pros:
- Conceptually simple and exact for local state.
- Avoids writing inverse logic for each tool.

Cons:
- Too broad: it would revert unrelated user edits made while the AI run was active unless the app serializes all domain writes.
- Hard to reconcile with sync: older pushed changes cannot be unsent; restoring a whole database can regress timestamps and break LWW expectations.
- Heavyweight for a desktop app that may have large local data.
- Does not compose well with "rollback to an earlier turn" after many later non-AI user edits.

Best use:
- Not recommended for product behavior. A limited test-only snapshot can still be useful for DB tests of the rollback algorithm.

## Recommendation

Use Approach 2: a DB-worker mutation journal tied to the persisted user message id.

Implementation notes:
- First modify `chat:send` to retain the `chat.insertMessage` result and pass `persistedUserMessageId` into `makeTaskWriteTools` / `makeProjectTools`.
- Add optional AI context to each AI-exposed write call. Do not expose it through renderer/user IPC unless validation explicitly restricts it to trusted main-process callers.
- Add journal helpers in the DB worker for snapshotting rows from `tasks`, `projects`, `project_sections`, `task_tags`, `project_tags`, and any checklist/list-position rows touched by `task_convertToProject` or section deletion.
- Start with the AI-exposed write surface only. Read tools and ordinary renderer mutations should not create AI rollback effects.
- Treat rollback as compensating writes with fresh `updated_at` timestamps, not as historical timestamp restoration, so sync LWW remains coherent.
- Return typed partial/conflict results instead of silently skipping side effects. Chat tail deletion should probably happen only after side-effect rollback succeeds or the user explicitly chooses "delete chat only".

## Related specs

- `.trellis/spec/frontend/local-data-persistence.md` — chat tables, message ordering, insert/session update behavior, restart-safe chat UI.
- `.trellis/spec/frontend/state-management.md` — DB-backed state is loaded through `window.api`; refresh after mutations and bump revision rather than adding a broad cache.
- `.trellis/spec/server/sync-protocol.md` — sync uses E2EE payloads and LWW by `updated_at`; rollback must be represented as newer local changes.
- `.trellis/spec/guides/cross-layer-thinking-guide.md` — this feature crosses UI, IPC, DB worker, sync, and domain actions.

## Caveats / Not Found

- No existing code links a persisted chat user message to any tool write.
- No existing persisted tool-call rows exist; streamed tool calls are UI-only.
- No existing undo/history mechanism exists for tasks/projects beyond Trash restore, and Trash restore is not an exact inverse.
- `createLocalSyncRecorder` is currently a no-op; it cannot be reused as-is as a mutation journal.
- The current task resolver returned no active task in this sub-agent session, so this file was written to the explicit task path supplied by the parent request rather than an auto-detected `{TASK_DIR}`.
- Research was local-code only; no external references were consulted.
