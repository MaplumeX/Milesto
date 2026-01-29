## 1. State & Wiring (selection vs open)

- [x] 1.1 Add `openTaskId` state to `src/app/AppShell.tsx` (separate from `selectedTaskId`) and plumb open/close callbacks to children that need to trigger open.
- [x] 1.2 Track and restore focus target on open/close (store last focused task row/button element or taskId+index) to satisfy focus restoration requirement.
- [x] 1.3 Ensure `+ Task` creation in `src/app/AppShell.tsx` opens the editor immediately (open newly created task) and focuses title.

## 2. List Interactions (click, Enter, double-click)

- [x] 2.1 Update `src/features/tasks/TaskList.tsx` click behavior: `onClick` only selects; do not open.
- [x] 2.2 Implement `Enter` handling in `src/features/tasks/TaskList.tsx` to open Overlay Paper for `selectedTaskId`.
- [x] 2.3 Implement `onDoubleClick` in `src/features/tasks/TaskList.tsx` to open Overlay Paper for the clicked task.
- [x] 2.4 Implement `Enter` + double-click open in `src/features/tasks/UpcomingGroupedList.tsx` (keyboard on list container + double-click on task rows).
- [x] 2.5 Decide and implement mouse open behavior for non-virtual lists (e.g., search results in `src/pages/SearchPage.tsx`) to align with “double-click opens” and “single-click selects”.

## 3. Overlay Paper UI (layout, scrim, bottom bar visibility)

- [x] 3.1 Replace the 3-column right detail panel rendering in `src/app/AppShell.tsx` (currently `<TaskDetailPanel />` in `.content-grid`) with an Overlay Paper mounted inside `content-main`.
- [x] 3.2 Add Overlay Paper scrim + surface styling in `src/index.css` (reuse `.palette-overlay` aesthetic where appropriate) and ensure it does not cover bottom bar (reserve `--bottom-bar-height`).
- [x] 3.3 Implement background lock while overlay open: prevent interaction and scroll in `.content-scroll` (no click-to-select, no wheel/trackpad scroll affecting background).
- [x] 3.4 Implement `role="dialog" aria-modal="true"` and ensure focus starts in the title field.
- [x] 3.5 Ensure scrim click does not close overlay.

## 4. Command Palette Gating

- [x] 4.1 Disable `Cmd/Ctrl + K` while Overlay Paper is open (gate the global key handler in `src/app/CommandPalette.tsx` based on overlay-open state).
- [x] 4.2 Verify Esc behavior: Esc closes overlay when open; Esc closes palette when palette is open; no conflict/stacking.

## 5. Editor Refactor (extract reusable editor from TaskDetailPanel)

- [x] 5.1 Extract the core task editor UI from `src/features/tasks/TaskDetailPanel.tsx` into a reusable component (e.g., `TaskEditorPaper`) that can render in overlay mode.
- [x] 5.2 Change the editor data-loading trigger from `selectedTaskId` to `openTaskId` (load detail on open only).
- [x] 5.3 Remove dependency on `revision` for editor refetch while open; ensure external `bumpRevision` events do not overwrite local draft.

## 6. Auto-save Engine (full-field, debounced, serialized, flush-on-close)

- [x] 6.1 Implement draft model + “lastSaved snapshot” in the editor; detect dirty state.
- [x] 6.2 Implement debounced auto-save for title/notes and immediate/short-debounce saves for select/date fields.
- [x] 6.3 Implement serialized save queue (single in-flight `window.api.task.update`) and coalesce multiple edits into the latest snapshot.
- [x] 6.4 Implement save state UI (Saving/Saved/Error) and retry action for failures.
- [x] 6.5 Implement close flush: on Esc/Close/Cmd+Return, flush pending changes before closing; on failure, keep overlay open and preserve draft.
- [x] 6.6 Preserve existing base_list normalization rule (Inbox rule) on every save.

## 7. Tags & Checklist Integration

- [x] 7.1 Update tag toggling (`window.api.task.setTags`) to update local editor state without requiring refetch; ensure it does not reset field draft.
- [x] 7.2 Update checklist mutations (`window.api.checklist.*`) to update local editor state without requiring refetch; ensure it does not reset field draft.

## 8. Refresh & Selection After Close

- [x] 8.1 On successful close, call `bumpRevision()` once to refresh list + sidebar.
- [x] 8.2 After list refresh, ensure `selectedTaskId` behavior is reasonable when task moved out of current list (pick next/prev or clear).

## 9. Verification

- [x] 9.1 Manual keyboard flow: Arrow navigation selects, Return opens, Esc closes and restores focus, Cmd+Return flushes and closes.
- [x] 9.2 Manual mouse flow: single-click selects, double-click opens, scrim click does not close.
- [x] 9.3 Manual save robustness: rapid typing does not lose characters; simulated save failure preserves draft and blocks close.
