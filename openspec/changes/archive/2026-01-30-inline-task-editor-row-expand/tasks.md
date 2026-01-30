## 1. Virtual Row Model (TaskList / Upcoming)

- [x] 1.1 Refactor `src/features/tasks/TaskList.tsx` to render from a `rows` array (task rows + optional editor row) instead of directly indexing `tasks[virtualRow.index]`.
- [x] 1.2 Add a stable `getItemKey` in `src/features/tasks/TaskList.tsx` to keep virtualization stable when inserting/removing the editor row.
- [x] 1.3 Update `src/features/tasks/UpcomingGroupedList.tsx` row model to support an `editor` row type inserted after the opened task.
- [x] 1.4 Ensure both lists keep selection navigation correct (ArrowUp/Down skips non-task rows like headers/editor where appropriate).

## 2. Dynamic Height Virtualization

- [x] 2.1 Enable dynamic measurement for virtual rows: attach `ref={rowVirtualizer.measureElement}` and `data-index={virtualRow.index}` on rendered row elements in `src/features/tasks/TaskList.tsx`.
- [x] 2.2 Enable dynamic measurement similarly in `src/features/tasks/UpcomingGroupedList.tsx` (including editor row).
- [x] 2.3 Add scroll jump mitigation:
  - apply `overflow-anchor: none` to the scroll container used by the virtualized lists
  - ensure `estimateSize` covers the editor row with a conservative value
- [x] 2.4 Verify expanding + editing (notes growth, checklist add/remove) does not cause overlapping rows.

## 3. Inline Editor Rendering & Layout

- [x] 3.1 Introduce a row-inline editor wrapper component (new file under `src/features/tasks/`) that renders the editor content suitable for list embedding (no scrim, no aria-modal).
- [x] 3.2 Adjust the editor UI to match specs:
  - Notes input is borderless / backgroundless and visually part of the title block; placeholder is "备注" (muted)
  - Checklist section renders under notes; supports add/toggle/rename/delete
  - Bottom-right action bar shows Schedule/Tags/Due always
  - Bottom-right `Checklist` button only appears when checklist is empty and focuses the add-item input
  - When the last checklist item is deleted, collapse the checklist section and re-show the `Checklist` button
- [x] 3.3 Ensure editor content prevents nested scrolling (no internal scroll areas).

## 4. Open/Close Semantics, Auto-save, Focus

- [x] 4.1 Replace overlay open behavior with inline expand behavior while keeping `openTaskId` as the single expanded task source of truth.
- [x] 4.2 Implement close/collapse triggers:
  - `Escape` collapses
  - `Cmd/Ctrl+Enter` collapses
  - collapse MUST call `flushPendingChanges()` first; on failure, keep expanded and show error
- [x] 4.3 Preserve focus restoration on collapse using the existing `[data-task-focus-target]` mechanism.
- [x] 4.4 Ensure keyboard events inside editor do not trigger list-level handlers (Arrow/Enter/Space).

## 5. Remove/Relax Overlay-specific Behavior (Behavioral Parity)

- [x] 5.1 Remove content lock behavior tied to `.content-scroll.is-locked` when editing inline (no background lock).
- [x] 5.2 Re-enable Command Palette while inline editor is open (remove `openTaskId`-based suppression).
- [x] 5.3 Ensure bottom bar remains visible and unobstructed during inline editing.

## 6. Verification

- [x] 6.1 Manual verification: Inbox/Today/Upcoming lists can expand a task inline, edit title/notes/checklist, and observe auto-save status.
- [x] 6.2 Manual verification: checklist empty-state button behavior (show only when empty; focuses add input; delete last collapses).
- [x] 6.3 Manual verification: scroll stability (no overlap, minimal jump) while editing notes and adding/removing checklist items.
- [x] 6.4 Manual verification: keyboard behavior (list navigation vs editor input) and focus restoration on collapse.
