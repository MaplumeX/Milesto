## Context

Current state (renderer):

- Inline editing is implemented via `src/features/tasks/TaskEditorPaper.tsx` with `variant="inline"`, embedded in the open task row rendered by `src/features/tasks/TaskList.tsx` (virtualized list).
- Schedule/Due/Tags are currently edited by toggling an `inlinePanel` state and rendering additional inline sections inside the editor (`inlinePanel === 'schedule' | 'due' | 'tags'`). This increases the open-row height and can cause list reflow/jumps.
- The inline header includes a save status indicator and an explicit `Collapse` button.
- Closing is orchestrated by `src/features/tasks/TaskInlineEditorRow.tsx`, which calls `TaskEditorPaperHandle.flushPendingChanges()` before closing, and supports `Escape` / `Cmd/Ctrl+Enter`.
- Switching between open tasks is orchestrated by `src/app/AppShell.tsx`, which flushes the currently open editor before switching tasks to avoid data loss.

Constraints:

- No new third-party dependencies.
- Keep Electron boundaries: renderer uses `window.api.*` only; no new IPC shape changes.
- Maintain virtualization stability: open row height should change primarily due to notes auto-resize / checklist growth, not due to transient pickers.

## Goals / Non-Goals

**Goals:**

- Make inline editor look like the original task row expanded (row-like header): done toggle + title input aligned with the task row title position.
- Remove the explicit `Collapse` button; unify exit gestures:
  - `Enter/Return` closes only when the title input is focused
  - `Escape` and `Cmd/Ctrl+Enter` close from anywhere
  - click-away closes the editor (if a picker is open, close the picker first)
- Move Schedule/Due/Tags editing to pickers (popover / native date picker) that do not expand the inline editor height.
- Add footer left-side summary chips in the bottom-left of the editor:
  - show chips only when the corresponding value exists
  - chip click opens picker
  - chip `×` clears the value without opening the picker
- Footer right-side buttons:
  - `Schedule` and `Due` show only when no value exists (add-entry)
  - `Tags` is always visible
  - `Checklist` stays conditional (only when checklist is empty)
- Ensure close/switch always flushes and waits for both draft auto-save and tags persistence.

**Non-Goals:**

- Tag management (rename / delete / recolor) inside the inline editor. Tags picker is selection-only.
- Reworking the overlay editor experience beyond any necessary alignment for close semantics.
- Introducing a full custom calendar UI; prefer native date picker (`input.showPicker`) with a small fallback.

## Decisions

### 1) Replace inline expansion panels with floating pickers

Decision:

- Remove `inlinePanel`-driven inline sections for schedule/due/tags.
- Implement Schedule/Due as a picker that does not affect layout:
  - Prefer `HTMLInputElement.showPicker()` on a hidden `input[type=date]`.
  - Fallback to a small popover containing `input[type=date]` when `showPicker` is unavailable.
- Implement Tags picker as a lightweight popover anchored to the Tags button / Tags chip.

Rationale:

- Avoids open-row height spikes that interact poorly with virtualization and reduce visual stability.
- Keeps editing affordances close to where they are invoked (button/chip), without introducing an overlay modal.

Alternatives considered:

- Keep inline sections and refine list measuring: rejected because it still causes layout changes and scroll jumps.

### 2) Footer layout: left summary chips + right action buttons

Decision:

- Split the current `.task-inline-action-bar` into left and right regions.
- Left region displays chips for existing values:
  - `Scheduled` chip shown only when `draft.scheduled_at` exists
  - `Due` chip shown only when `draft.due_at` exists
  - `Tags` chip shown only when the selected tag set is non-empty
  - Each chip has an `×` button to clear
  - Clicking the chip body opens the relevant picker
- Right region keeps action buttons:
  - Hide `Schedule` and `Due` buttons when the value exists (chip becomes the discoverable entry)
  - Keep `Tags` always visible
  - Keep existing `Checklist` conditional behavior

Rationale:

- Chips provide an at-a-glance summary and a direct way to clear values, while keeping buttons minimal.

Alternatives considered:

- Encode values into button labels: rejected per UX preference (values should live in the bottom-left summary).

### 3) Close/dismiss model (no Collapse button)

Decision:

- Remove the explicit `Collapse` button from the inline header.
- Trigger close via:
  - `Enter` on title input only
  - `Escape` and `Cmd/Ctrl+Enter` anywhere
  - click-away outside the editor area
- If a picker is open, click-away closes the picker first (without closing the editor).

Click-away event handling (important detail):

- Implement click-away on `pointerdown` capture to ensure it runs before list selection handlers.
- The click-away dismissal consumes the click (stops propagation to the target) to avoid a race where:
  - an outside click selects another task while the editor fails to flush and stays open.
- Resulting behavior: clicking outside closes (or attempts to close) the editor; selecting another row may require a second click.

Rationale:

- Close is async (flush required). Consuming the click is the simplest deterministic behavior that avoids selection/UI mismatch on flush failure.

Alternatives considered:

- Allow click-through and attempt to replay the click after flush: higher complexity and more edge cases (double actions, focus conflicts).

### 4) Flush semantics include tags persistence (close/switch waits for tags)

Decision:

- Extend `TaskEditorPaperHandle.flushPendingChanges()` to wait for:
  - draft auto-save worker completion (existing)
  - the latest in-flight tags mutation (new)
- Track tags persistence as a dedicated in-flight promise reference plus a sequence number to ignore stale responses.
- If tags persistence fails, flush returns `false` and the editor remains open.

Rationale:

- User expectation: tags changes are part of the edit session; exiting/switching must not lose them.

Alternatives considered:

- Treat tags as best-effort background updates: rejected (breaks “flush before switch” guarantee).

### 5) Focus and error targeting on failed flush

Decision:

- Keep existing focus restoration on successful close via `AppShell` (last focus target tracking).
- On flush failure, focus should move to the most relevant entry point:
  - draft save failure: focus title
  - tags failure: focus Tags button (or Tags chip if present)
- Implement this either by adding a new handle method (e.g. `focusLastErrorTarget`) or by having the editor internally focus before returning `false`.

Rationale:

- Avoids the current behavior where every failure routes focus to the title, which is confusing when the failure is tags-related.

## Risks / Trade-offs

- [Click-away consumes clicks] → Mitigation: keep keyboard exit paths (`Enter`/`Escape`/`Cmd/Ctrl+Enter`) prominent; consider a later enhancement to replay the click after successful flush.
- [Native `showPicker()` availability varies] → Mitigation: feature-detect and fall back to a small popover date input.
- [Popover positioning inside a scrollable virtualized list] → Mitigation: render popovers via portal to `document.body`, close on scroll/resize, and re-measure/close on task switch.
- [Async race conditions in tags saving] → Mitigation: sequence-number gating to ignore stale responses; store in-flight promise in a ref; integrate error state with flush.
- [Accessibility regressions from custom popovers] → Mitigation: keep ARIA roles minimal and consistent; ensure `Escape` closes popover; restore focus to invoker.
