## 1. Task Editor Safe-Close API (for section edit)

- [x] 1.1 Extend `src/features/tasks/TaskSelectionContext.tsx` to expose a safe-close method (e.g. `requestCloseTask(): Promise<boolean>`), documented as "flush and close the open task editor if present"
- [x] 1.2 Implement the safe-close method in `src/app/AppShell.tsx` using `openEditorHandleRef` and existing `flushPendingChanges()` / `focusLastErrorTarget()` semantics
- [x] 1.3 Ensure the safe-close method returns `false` on flush failure without changing `openTaskId` (editor stays open)

## 2. Project Page Plumbing for Existing Section Inline Edit

- [x] 2.1 Add a new callback prop to `src/features/tasks/ProjectGroupedList.tsx` to start editing a specific section (sets `editingSectionId`)
- [x] 2.2 Wire the new callback from `src/pages/ProjectPage.tsx` (implement as `setEditingSectionId(sectionId)`)
- [x] 2.3 Verify existing “+ Section creates and focuses inline edit” flow remains unchanged

## 3. ProjectGroupedList Row Selection Model (Tasks + Section Headers)

- [x] 3.1 Add local selection state for the mixed `rows` model in `src/features/tasks/ProjectGroupedList.tsx` (e.g. `selectedRowIndex`)
- [x] 3.2 Update listbox `onKeyDown` in `src/features/tasks/ProjectGroupedList.tsx` so ArrowUp/ArrowDown moves selection across both `group` and `task` rows (no longer skipping `group`)
- [x] 3.3 Implement initial behavior: when no row is selected, first `ArrowDown` selects `rows[0]` (and scrolls to it if needed)
- [x] 3.4 Keep selection + task selection aligned:
  - selecting a task row sets `selectTask(taskId)`
  - selecting a section row sets `selectTask(null)` (clears task selection)
- [x] 3.5 Implement activation on `Return`:
  - task row -> `openTask(taskId)` (existing)
  - section row -> call safe-close; if ok, enter section title inline edit; if not ok, do nothing (editor focused on error target)
- [x] 3.6 Add mouse interactions for section rows in `src/features/tasks/ProjectGroupedList.tsx`:
  - click title area selects the section row
  - double-click title area enters inline edit (same safe-close semantics)
  - ensure action buttons (Rename/Delete) do not accidentally trigger selection/edit via event propagation
- [x] 3.7 Add selection fallback behavior when `rows` refreshes (clamp/adjust selected index so it remains valid)

## 4. Styling

- [x] 4.1 Add a selected style for section header rows in `src/index.css` (e.g. `.project-group-header.is-selected`) aligned with `.task-row.is-selected` but visually appropriate for headers

## 5. Self-Test Coverage

- [x] 5.1 Extend `src/app/selfTest.ts` with a Project page scenario that:
  - navigates to a project with at least one section
  - focuses the Project listbox
  - uses Arrow keys to land selection on a section header row
  - presses Return to enter inline title editing (assert input visible + focused)
- [x] 5.2 Add coverage for the safe-close success path:
  - open a task inline editor
  - select a section header row and press Return
  - assert the task editor closed and section title input is visible

## 6. Verification

- [x] 6.1 Run `npx tsc -p tsconfig.json`
- [x] 6.2 Run `npm run build`
- [x] 6.3 Run the self-test flow (`?selfTest=1`) and confirm the new scenarios pass
