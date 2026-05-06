# AI Chat Rollback Design

## Goal

Let the current AI chat support undo-style rollback like common AI tools: the user can return a conversation to an earlier user turn, remove later chat context, and send a revised prompt without the old tail continuing to affect future responses.

## What I Already Know

* The current app is Electron + React + DB worker.
* Chat UI lives under `src/features/chat/`.
* Chat IPC is exposed through `shared/window-api.ts` and `electron/preload.ts`.
* Chat sessions/messages are persisted by `electron/workers/db/actions/chat-actions.ts`.
* The chat runtime in `electron/main.ts` loads all persisted messages for a session into LangChain history before sending the next prompt.
* `chat:abort` stops an inflight run, but does not delete the user message already inserted for that run.
* There is no existing turn, branch, snapshot, or soft-delete marker in `chat_messages`.

## Requirements

* Add an explicit rollback affordance to the chat UI for previous user messages.
* Rolling back to a user message must remove that user message and every later message from the active conversation context.
* After rollback succeeds, the removed user message content must be restored into the composer so the user can revise and resend.
* If the rollback target is the last user message and a response is currently streaming, the inflight run must be aborted before messages are removed.
* After rollback, future sends must build model history only from the remaining visible messages.
* The UI must refresh the message list after rollback and clear stale streaming/tool/confirmation state for the affected run.
* Rollback should be session-scoped and must not affect other chat sessions.
* Rollback must also revert task/project data changes made by AI tools in the rolled-back chat tail.
* AI tool side-effect rollback must be based on persisted mutation metadata, not assistant text or transient streaming events.
* Rollback must not silently overwrite later user edits to the same task/project.
* When side-effect rollback encounters later edits, it must partially roll back non-conflicting effects, preserve conflicting rows, and report the conflicts to the user.

## Acceptance Criteria

* [ ] A user can undo the latest completed user turn and its assistant response from the active session.
* [ ] A user can roll back to an earlier user turn, deleting that turn and all later messages.
* [ ] The next AI response does not include deleted messages in history.
* [ ] Rolling back during streaming aborts the run and leaves no partial assistant tail.
* [ ] AI-created tasks/projects/sections in the rolled-back tail are removed or soft-deleted as rollback effects.
* [ ] AI updates/completions/cancellations/deletions/tag changes in the rolled-back tail restore the affected rows to their pre-tool state when no later conflict exists.
* [ ] AI side-effect rollback partially succeeds when conflicts exist: non-conflicting effects are reverted, conflicting rows are preserved, and conflict details are returned.
* [ ] Rolling back a missing session/message returns a typed error.
* [ ] DB tests cover rollback deletion boundaries and session isolation.
* [ ] DB tests cover AI mutation journal capture, reverse application, and conflict handling.
* [ ] Renderer tests cover rollback button visibility and state refresh.

## Out of Scope

* Persistent branching UI with multiple alternate conversation paths.
* Full undo history after rollback has been confirmed.
* Inline editing inside historical message bubbles; the MVP restores removed text into the composer instead.

## Technical Approach

Recommended MVP: hard-delete a conversation tail from `chat_messages`, scoped by `session_id` and chronological order.

* Add a DB action such as `chat.rollbackToMessage` with input `{ session_id, message_id }`.
* Validate that the target message belongs to the session and is a `user` message.
* Delete all messages in that session where `(created_at, id)` is greater than or equal to the target message's ordering tuple.
* Update `chat_sessions.updated_at` after deletion so the session list remains deterministic.
* Add IPC/preload/window API methods for rollback.
* In `useChatStreaming`, add a `rollbackToMessage` method that aborts any inflight run for the active session, calls the DB action, reloads messages, and clears transient state.
* In `ChatMessages`, show an undo/rollback icon action on user messages. The safest initial placement is hover/focus action on user bubbles, with accessible label text from i18n.
* Use a confirmation dialog for non-latest rollbacks because they can remove multiple turns.
* Add domain-side rollback semantics for AI tool writes before deleting the chat tail.
* Recommended domain rollback mechanism: DB-worker mutation journal tied to the persisted user message id. Each AI-exposed write action records before/after snapshots inside the same DB transaction as the mutation. Rollback finds journal batches for user messages in the deleted tail, applies them in reverse order, then deletes the chat tail.
* Treat rollback as fresh compensating writes with current `updated_at` timestamps so sync can propagate the rollback as normal newer local changes.
* Conflict policy: partially roll back. For each journal row, if the current row still matches the AI-produced `after_json` for the relevant fields, restore it toward `before_json`; if it has diverged, keep the current row and include a conflict item in the rollback result. The chat rollback UI should show the conflict summary after completion.

## Implementation Plan

### PR1: Chat rollback and composer restore

* Add chat rollback schemas and `window.api.chat.rollbackToMessage`.
* Add DB action to delete a session-scoped chat tail from a target user message.
* Add hook/UI behavior to abort an active run, rollback messages, reload messages, and restore the removed prompt into the composer.
* Add DB and renderer tests for chat-only rollback.

### PR2: AI mutation journal foundation

* Add journal tables for AI tool effect batches and affected rows.
* Change `chat:send` to retain the persisted user message id and pass trusted AI context into AI write tools.
* Add journal helpers for capturing before/after snapshots inside DB transactions.
* Add tests for journal capture and reverse ordering.

### PR3: Instrument AI task/project write tools

* Journal AI-exposed task writes: create, update, toggle done, cancel, restore, delete, convert to project, set tags.
* Journal AI-exposed project writes: create, update, complete, cancel, delete, set tags, create/rename/delete section.
* Cover cascade cases such as project complete/cancel/delete and task convert-to-project.

### PR4: Domain rollback execution and conflict reporting

* Apply journal batches in reverse before deleting chat tail.
* Implement partial rollback conflict detection.
* Return rollback result with reverted effects, skipped conflict items, and restored prompt content.
* Surface conflict summary in the chat UI.

### PR5: Final verification and sync behavior

* Ensure rollback uses fresh timestamps for compensating writes.
* Broadcast data changes after successful domain rollback.
* Add integration-style tests for chat rollback plus domain side effects.

## Feasible Approaches

### Approach A: Tail Delete by User Message (Recommended)

Rollback deletes the selected user message and every later message.

Pros:
* Simple mental model: "go back to before I asked this."
* Small schema/API change.
* Guarantees deleted text no longer enters model context.

Cons:
* Deleted conversation tail is not recoverable.
* Does not preserve alternate branches.

### Approach B: Edit Previous User Message + Tail Delete

User chooses "edit", the app pre-fills the composer with the selected message content, deletes that user message and later messages, then lets the user resend.

Pros:
* Closest to ChatGPT/Claude-style correction flow.
* Better than rollback alone for prompt typo fixes.

Cons:
* More UI state in composer.
* Needs careful handling if rollback fails after prefill.

Selected for MVP.

### Approach C: Soft Delete / Branch Pointer

Keep all messages in SQLite, add `deleted_at` or conversation branch metadata, and filter active history.

Pros:
* Enables future restore, audit, or branch switching.
* Safer if users expect rollback to be reversible.

Cons:
* Larger schema and query complexity.
* Requires import/export/sync thought if chat history is later synced.

## Domain Side-Effect Rollback Approaches

### Approach 1: Per-tool inverse operation log

Each AI tool captures pre-state, calls the normal DB action, then writes an inverse log.

Pros:
* Smaller initial surface.
* Easy to associate with a tool call.

Cons:
* Not atomic with the DB mutation.
* Complex tools require broad prefetch logic that can drift from DB action internals.
* Public restore/delete APIs are not exact inverses.

### Approach 2: DB-worker mutation journal (Recommended)

AI write actions carry an internal AI context, and DB actions record affected rows before/after inside their existing transactions.

Pros:
* Atomic with task/project mutations.
* Handles cascades such as project complete/cancel/delete and task convert-to-project.
* Gives rollback a durable source of truth linked to the chat user message.

Cons:
* Requires touching every AI-exposed write path.
* Needs careful snapshot helpers and conflict checks.

### Approach 3: Whole DB snapshot per AI run

Snapshot local SQLite before the AI run and restore the snapshot on rollback.

Pros:
* Exact local rewind in simple cases.

Cons:
* Too broad; can revert unrelated user edits.
* Poor fit for sync because old changes may already have propagated.
* Heavyweight and risky for normal product behavior.

## Decision (ADR-lite)

**Context**: The user wants rollback to feel like common AI tools, where a previous prompt can be revised and resent.

**Decision**: Use "rollback and restore prompt to composer" as the chat UX.

**Consequences**: The UI must expose a way for `ChatMessages`/`ChatPanel` to set composer draft text after rollback succeeds. Rollback failure must leave the current composer text untouched.

**Open decision**: The user also requires rollback of task/project data mutated by AI tools. This requires a domain mutation undo design, not just chat message deletion.

**Domain rollback decision**: Use a DB-worker mutation journal tied to the persisted chat user message id.

**Domain rollback consequences**: `chat:send` must keep the inserted user message id and pass it as trusted AI context to write tools. DB actions touched by AI write tools must persist mutation batches/rows. Rollback must apply batches in reverse before deleting chat messages.

**Conflict policy decision**: Rollback uses partial success. It reverts non-conflicting AI side effects, preserves later user edits, and reports conflict details instead of blocking the whole rollback or force-overwriting user changes.

## Research References

* `research/chat-rollback-ux-patterns.md` — comparable tools separate edit, regenerate, rollback, and branch; Milesto should start with linear tail rollback before adding branch/version metadata.
* `research/tool-side-effect-rollback.md` — current AI write tools lack any persisted side-effect linkage; recommended design is a DB-worker mutation journal bound to the persisted user message id.

## Research Notes

* Common UX patterns:
  * Edit previous user message: show an edit action on user bubbles, restore text into an editor/composer, then regenerate from that point.
  * Regenerate assistant response: retry the latest assistant answer or maintain response variants.
  * Rollback/rewind: return to a prior turn and remove later context.
  * Branch: preserve the old path while creating a new path from a message.
* Current repo constraint: Milesto stores chat as a flat `chat_sessions` + `chat_messages` list. There is no message parent, branch id, deleted marker, or assistant response version field.
* Product copy caveat: do not call MVP rollback "branch", "restore", or "undo history" because those imply recoverability that the schema will not provide.
* Tool rollback constraint: streamed tool calls are UI-only today, and the final assistant row is stored without `tool_calls`; rollback cannot infer side effects unless new mutation metadata is persisted.
* Sync constraint: rollback should use fresh timestamps as compensating writes, not restore old `updated_at` values, because sync conflict behavior is last-write-wins by timestamp.

## Technical Notes

* Files inspected:
  * `src/features/chat/ChatPanel.tsx`
  * `src/features/chat/use-chat-streaming.ts`
  * `src/features/chat/ChatMessages.tsx`
  * `src/features/chat/ChatComposer.tsx`
  * `shared/schemas/chat.ts`
  * `shared/window-api.ts`
  * `electron/preload.ts`
  * `electron/main.ts`
  * `electron/workers/db/actions/chat-actions.ts`
  * `electron/workers/db/db-bootstrap.ts`
  * `tests/db/chat-actions.test.ts`
* Ordering caveat: existing tests note `uuidv7` is not strictly monotonic within the same millisecond, so rollback deletion should not rely on `id` alone unless message insertion ordering is made stronger.
* Tool side effects are now in scope per user requirement. Need research into existing task/project write tools and whether mutations can be captured as inverse operations or database snapshots.
* Research recommendation: use a DB-worker mutation journal, not a tool-layer inverse log or whole DB snapshot.
