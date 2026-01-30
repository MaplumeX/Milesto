## 1. List Rendering: Single Row Expansion (Remove editor row insertion)

- [x] 1.1 Update `src/features/tasks/TaskList.tsx` to stop inserting `{ type: 'editor' }` rows; virtualizer `count` should be `tasks.length` and keys should be stable per task.
- [x] 1.2 In `src/features/tasks/TaskList.tsx`, render the inline editor inside the same `li.task-row` when `openTaskId === task.id` (title row button not rendered in open state).
- [x] 1.3 Update `src/features/tasks/UpcomingGroupedList.tsx` to remove `editor` row type and instead render editor content inside the matching `task` row (keep header rows).
- [x] 1.4 Update `src/pages/SearchPage.tsx` to remove separate editor rows and render the editor within the selected task row when opened.

## 2. Virtualization & Interaction Correctness

- [x] 2.1 Adjust virtualization estimates for open rows: when `openTaskId` matches a task row, `estimateSize` returns a conservative expanded height; continue using `measureElement` to avoid overlap.
- [x] 2.2 Ensure keyboard navigation remains correct:
  - TaskList: ArrowUp/Down moves selection; Enter opens selected; Space toggle remains list-level only when editor is not focused.
  - UpcomingGroupedList: Arrow navigation skips header rows; Enter opens selected.
- [x] 2.3 Verify focus restoration still works after collapse (`AppShell` uses `[data-task-focus-target][data-task-id]`) given that open-state rows no longer render the focus target button.

## 3. Inline Editor Header: Done Toggle Inside Editor

- [x] 3.1 Add a done checkbox to `TaskEditorPaper` inline header (`variant === 'inline'`) that toggles `window.api.task.toggleDone(taskId, done)`.
- [x] 3.2 Update editor local state after toggle so the UI immediately reflects done/open; editor remains open (no auto-collapse).
- [x] 3.3 Ensure editor keyboard handling still prevents listbox handlers from firing (Space/Arrow/Enter). Validate checkbox interaction does not bubble to list-level Space toggle.

## 4. Visual Merge (No second card/paper layer)

- [x] 4.1 Introduce an open-state style (`.task-row.is-open`) to allow the row to contain the full editor layout (switch from row `flex` to column/block as needed).
- [x] 4.2 Under `.task-row.is-open`, de-skin `.task-inline-paper` (no border/radius/background/padding) so the editor visually becomes part of the task row.
- [x] 4.3 Reconcile borders/dividers: avoid double borders between the row’s `border-bottom` and editor section dividers; keep the overall look lightweight.

## 5. Update Self Test Expectations

- [x] 5.1 Update `src/app/selfTest.ts` to avoid holding stale `.task-title-button` references across open/close (open state removes the button).
- [x] 5.2 Add/adjust assertions to validate the new structure:
  - Opening an editor makes the corresponding task row expand (no separate editor row required).
  - Expanded editor still passes no-overlap checks while notes grow / checklist changes.
  - Done toggle exists in editor header and does not collapse the editor.

## 6. Verification

- [x] 6.1 Run the self-test path (dev self-test) to validate no-overlap, scroll jump bounds, and keyboard behavior.
- [ ] 6.2 Manual smoke test in Inbox/Today/Upcoming/Search:
  - Single click selects only
  - Enter/double-click opens inline editor in-row
  - Escape / Cmd(Ctrl)+Enter collapses after successful flush; blocks on save error
  - Done checkbox toggles without collapsing
