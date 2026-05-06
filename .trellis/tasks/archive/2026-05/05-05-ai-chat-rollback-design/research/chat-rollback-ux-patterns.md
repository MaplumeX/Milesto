# Research: AI chat rollback UX patterns

- Query: Common UX/product patterns for AI chat undo, edit previous message, regenerate, rollback, and branching behavior; map them to Milesto's current chat architecture.
- Scope: mixed
- Date: 2026-05-05

## Findings

### Comparable product patterns

- ChatGPT separates three related actions: edit a user message, retry an assistant response, and branch from an earlier point into a new chat. The current help text says message editing is exposed from the user message affordance, retry is exposed under assistant responses, and branch creates a new chat continuing from the selected point.
  - Reference: https://help.openai.com/en/articles/11909943-gpt-53-and-gpt-55-in-chatgpt
  - Product signal: "edit" is a corrective action, "retry" is assistant-response variation, and "branch" is used when preserving the original path matters.

- Gemini supports editing a prompt, which regenerates the response, and also supports response regeneration / alternate drafts with navigation. Its help docs emphasize that regeneration is limited to the most recent response in some flows.
  - References: https://support.google.com/gemini/answer/13275745 and https://support.google.com/gemini/answer/14262426
  - Product signal: limiting regeneration/editing to the latest turn is a valid simplification when the product wants a linear conversation model and lower state complexity.

- Claude Code checkpointing is not a consumer chat UX, but it is relevant for the "rewind" mental model. It presents a list of prior prompts, then lets the user restore conversation, restore files, restore both, or summarize from that point. After rewind, the original prompt is restored to the input field for editing/resending.
  - Reference: https://code.claude.com/docs/en/checkpointing
  - Product signal: rollback is safer when the UI names which state is affected. For Milesto this matters because chat rollback must not imply reverting task/project side effects.

- Branching chat implementations model conversations as a tree: editing a user message creates a new branch; regenerating an assistant response creates a sibling branch; branch navigation lets users switch variants. LangChain's branching chat docs and Parallel Works' AI chat docs both describe this as preserving original paths while exploring alternatives.
  - References: https://docs.langchain.com/oss/python/langchain/frontend/branching-chat and https://parallelworks.com/docs/ai/ai-chat/branching-conversations
  - Product signal: full branching is the richer long-term model, but it requires parent/sibling metadata and active-branch selection instead of a flat message list.

### Common conventions and trade-offs

- Edit previous user message:
  - Common UX: pencil/edit action on a user bubble, inline editor or composer prefill, then regenerate from that point.
  - Benefit: best correction flow for typos, missing context, or changing instructions.
  - Cost: needs draft state and failure handling if the tail delete succeeds but resend fails.

- Regenerate assistant response:
  - Common UX: retry/regenerate action under assistant response, often with version navigation.
  - Benefit: easy answer variation without rewriting the prompt.
  - Cost: to preserve previous responses, the storage model needs sibling assistant messages or branch metadata. Without that, regenerate is effectively destructive tail replacement.

- Rollback / rewind:
  - Common UX: "go back to before this turn" or "rewind to here" action, often confirmed when more than the latest turn is removed.
  - Benefit: makes model context predictable by removing later turns.
  - Cost: destructive hard delete is simple but not recoverable. It must be clear that domain side effects caused by tools are not reverted.

- Branch:
  - Common UX: branch from a message into a new chat or show sibling branch navigation in-place.
  - Benefit: preserves the old path and supports experimentation.
  - Cost: higher schema, query, and UI complexity; needs active branch state, branch naming/navigation, and possibly export/sync implications.

### Mapping to Milesto

- Current persistence is a linear session/message model. `chat_sessions` has `id`, `title`, `created_at`, `updated_at`; `chat_messages` has `id`, `session_id`, `role`, `content`, `tool_calls`, `tool_call_id`, and `created_at`, with no parent, branch, deleted marker, or version field (`electron/workers/db/db-bootstrap.ts:36`).

- The shared chat schema mirrors that flat shape and exposes only message role/content/tool metadata (`shared/schemas/chat.ts:29`). There is currently no cross-layer input schema for rollback/edit/branch.

- The renderer API exposes session CRUD, `listMessages`, `send`, `abort`, streaming event subscriptions, and confirmation response; it has no rollback/edit/regenerate method (`shared/window-api.ts:225`).

- The DB action layer lists messages by `session_id` ordered by `created_at ASC, id ASC` (`electron/workers/db/actions/chat-actions.ts:227`) and inserts one message at a time while bumping the session timestamp (`electron/workers/db/actions/chat-actions.ts:275`, `electron/workers/db/actions/chat-actions.ts:288`).

- Sending currently loads all persisted messages for the session and converts them into LangChain history before inserting the current user message (`electron/main.ts:1254`, `electron/main.ts:1292`). Therefore, deleting a tail from `chat_messages` is enough to remove that tail from future model context, as long as `chat.listMessages` remains the history source.

- Abort is run-scoped by generated streaming `messageId`, stored in `inflightRuns`, and removes the runtime/controller without deleting the already inserted user message (`electron/main.ts:1162`, `electron/main.ts:1382`). A rollback during streaming must abort first, then delete the persisted user message and any later persisted messages.

- The chat UI currently renders message bubbles without per-message actions (`src/features/chat/ChatMessages.tsx:54`) and owns send/abort/session state through `ChatPanel` and `useChatStreaming` (`src/features/chat/ChatPanel.tsx:21`, `src/features/chat/use-chat-streaming.ts:263`). Adding rollback as a hook method plus a bubble affordance fits current ownership.

### Recommendation for MVP

- Implement destructive, session-scoped "rollback to before this user message" first.
- Show the action on user messages, using an accessible icon-only control with a contextual label.
- Confirm when the selected user message is not the latest user turn or when more than one assistant/user turn will be removed.
- After success, refresh messages from `window.api.chat.listMessages`, clear streaming/tool/confirmation state for the affected session, and leave the composer ready for a revised prompt. If the product wants the friendlier edit flow, prefill the composer with the removed user message only after rollback succeeds.
- Do not label the MVP as "branch", "restore", or "undo history"; those imply recoverability or alternate paths that the schema will not support.

### Future branch-capable design

- Add `parent_message_id`, `branch_id`, and an active branch pointer, or a separate branch table with message parent links.
- Treat user edit as creating a new branch from the edited message's parent.
- Treat assistant regenerate as creating a sibling assistant branch for the same user turn.
- Add branch navigation UI only after storage can preserve siblings; otherwise the UI will imply unavailable recoverability.

## Files Found

- `.trellis/tasks/05-05-ai-chat-rollback-design/prd.md` - Current task PRD already scopes rollback as removing the target user message and later context, with branch UI out of scope.
- `src/features/chat/ChatPanel.tsx` - Owns active session, send/abort handlers, and passes state into messages/composer.
- `src/features/chat/use-chat-streaming.ts` - Owns message/session loading, streaming state, tool-call state, errors, and confirmation state.
- `src/features/chat/ChatMessages.tsx` - Renders chat bubbles and is the natural place for a user-message rollback affordance.
- `src/features/chat/ChatComposer.tsx` - Owns draft input and would need an explicit prefill/edit-draft API if MVP includes edit-after-rollback.
- `shared/schemas/chat.ts` - Source of truth for cross-process chat entities and inputs.
- `shared/window-api.ts` - Renderer API contract; rollback must be added here and mirrored in preload/main.
- `electron/preload.ts` - IPC bridge for `window.api.chat`.
- `electron/main.ts` - Main-process chat send/abort runtime and DB IPC handlers.
- `electron/workers/db/actions/chat-actions.ts` - Chat persistence actions; best location for tail deletion action.
- `electron/workers/db/db-bootstrap.ts` - Chat SQLite schema; confirms no branch/soft-delete metadata exists.
- `tests/db/chat-actions.test.ts` - Existing DB tests and ordering caveat for message ordering.
- `tests/renderer/use-chat-streaming.test.tsx` - Likely target for hook-level rollback/refresh tests.
- `tests/renderer/chat-panel-session-restore.test.tsx` - Existing chat panel integration-style renderer tests.

## Code Patterns

- Cross-layer chat entities are defined in `shared/schemas/chat.ts` and validated with Zod before crossing boundaries (`shared/schemas/chat.ts:29`).
- Renderer code must go through `window.api.chat`; current chat API surface is declared in `shared/window-api.ts:225`.
- DB worker actions return typed `Result` objects and validate payloads with `safeParse`, as shown in `chat.listMessages` and `chat.insertMessage` (`electron/workers/db/actions/chat-actions.ts:200`, `electron/workers/db/actions/chat-actions.ts:242`).
- Chat message listing is session-scoped and chronological (`electron/workers/db/actions/chat-actions.ts:227`).
- Session recency is maintained by updating `chat_sessions.updated_at` after message insertion (`electron/workers/db/actions/chat-actions.ts:288`); rollback should do the same for deterministic session ordering.
- Main-process send loads persisted messages into model history before inserting the new user message (`electron/main.ts:1254`, `electron/main.ts:1292`).
- Abort cancels the runtime but does not clean persisted chat messages (`electron/main.ts:1397`).
- Renderer streaming completion refreshes messages from the persisted source of truth (`src/features/chat/use-chat-streaming.ts:207`).
- Frontend quality spec requires privileged/persisted actions through `window.api.*` and accessible names for icon-only controls (`.trellis/spec/frontend/quality-guidelines.md:21`, `.trellis/spec/frontend/component-guidelines.md:112`).

## External References

- OpenAI Help Center, "GPT-5.3 and GPT-5.5 in ChatGPT" - documents edit, retry, and branch-in-new-chat patterns.
  - https://help.openai.com/en/articles/11909943-gpt-53-and-gpt-55-in-chatgpt
- Google Gemini Apps Help, "Use Gemini Apps" - documents prompt editing that regenerates a response.
  - https://support.google.com/gemini/answer/13275745
- Google Gemini Apps Help, "Regenerate or modify responses from Gemini Apps" - documents regeneration and response-version switching, with latest-response limits.
  - https://support.google.com/gemini/answer/14262426
- Claude Code Docs, "Checkpointing" - documents rewind choices and restoring the original prompt into input after rewind.
  - https://code.claude.com/docs/en/checkpointing
- LangChain Docs, "Branching chat" - documents tree-based message structure for edit/regenerate/branch UX.
  - https://docs.langchain.com/oss/python/langchain/frontend/branching-chat
- Parallel Works Docs, "Branching Conversations" - documents parent-message tree, branch creation, and sibling branch navigation.
  - https://parallelworks.com/docs/ai/ai-chat/branching-conversations

## Related Specs

- `.trellis/spec/frontend/index.md` - Frontend guideline index and pre-development entry.
- `.trellis/spec/frontend/component-guidelines.md` - Component shape, global CSS patterns, and accessible icon-only actions.
- `.trellis/spec/frontend/state-management.md` - Keep feature-local state local and refresh DB-backed state after mutations.
- `.trellis/spec/frontend/type-safety.md` - Shared schemas/window API are the boundary source of truth.
- `.trellis/spec/frontend/quality-guidelines.md` - Renderer/main/preload boundaries, accessible names, and tests.

## Caveats / Not Found

- `task.py current --source` reported no active task, so the target research path was confirmed by the parent request rather than resolved from active-task runtime state.
- I did not find existing rollback, edit, regenerate, branch, soft-delete, or message-parent primitives in the current Milesto chat code.
- External product behavior can change. The cited docs were searched on 2026-05-05 and should be rechecked before copying exact UI copy.
- Claude Code checkpointing is an adjacent developer-tool pattern, not the same as a consumer assistant chat UI. It is useful mainly for the distinction between conversation rollback and file/domain rollback.
- Current DB ordering uses `created_at ASC, id ASC`; existing task notes warn that `uuidv7` is not strictly monotonic within one millisecond. Tail deletion should use a tested ordering strategy and not assume `id` alone preserves insert order.
