## 1. Data + IPC (Batch Progress Counts)

- [x] 1.1 Add batch progress count schemas (input + output) under `shared/schemas/task-list.ts`
- [x] 1.2 Add `window.api.task.countProjectsProgress(projectIds: string[])` type signature in `shared/window-api.ts`
- [x] 1.3 Wire preload mapping in `electron/preload.ts` for `db:task.countProjectsProgress`
- [x] 1.4 Register `handleDb('db:task.countProjectsProgress', 'task.countProjectsProgress', ...)` in `electron/main.ts`
- [x] 1.5 Implement DB worker action `task.countProjectsProgress` in `electron/workers/db/actions/task-actions.ts` using a grouped query over tasks (`deleted_at IS NULL`, conditional counts)
- [x] 1.6 Ensure projects with zero tasks are represented with `done_count=0,total_count=0` in the returned payload
- [x] 1.7 Update `tests/renderer/window-api-mock.ts` to include the new window API method

## 2. Shared UI Primitive (Project Progress Control)

- [x] 2.1 Create a reusable project progress control component (list + header size variants)
- [x] 2.2 Implement pie fill rendering with `conic-gradient` starting at 12 o'clock and filling clockwise
- [x] 2.3 Implement done style: high-contrast solid circle + checkmark; do not render any checkmark in open state
- [x] 2.4 Implement accessibility text: open state indicates progress and that completion requires confirmation; done state indicates reopen action
- [x] 2.5 Add focus-visible styling using existing `--focus` token and ensure hit area is at least 28-32px in lists
- [x] 2.6 Add reduced-motion behavior for state transitions (no continuous animation; respect prefers-reduced-motion)

## 3. Project Page Header Integration

- [x] 3.1 Replace the Project header checkbox in `src/pages/ProjectPage.tsx` with the new progress control
- [x] 3.2 Preserve completion confirmation behavior when status is `open` (uses `project.completeConfirm`)
- [x] 3.3 Implement reopen-on-click when status is `done` (calls `window.api.project.update({ status: 'open' })` without confirmation)
- [x] 3.4 Ensure the page remains on `/projects/:projectId` after complete and after reopen

## 4. Sidebar Open Projects Integration (DnD + Keyboard Reorder Safe)

- [x] 4.1 Refactor sidebar project row DOM in `src/app/AppShell.tsx` to render the progress control as a sibling of the project `NavLink` (no nesting)
- [x] 4.2 Ensure pointer drag-and-drop reorder continues to work (activator stays on the intended element)
- [x] 4.3 Ensure click suppression during/after drag (`suppressClickRef`) also prevents accidental progress activation
- [x] 4.4 Ensure keyboard reorder chord works even when focus is on the progress control (may require moving `data-sidebar-dnd-kind/id` to the row wrapper)
- [x] 4.5 Fetch batch progress counts for Sidebar open projects and render progress pies in the Sidebar

## 5. Area Page Projects List Integration

- [x] 5.1 Update Area page Projects list rows in `src/pages/AreaPage.tsx` to render the progress control next to each project title link (as a sibling)
- [x] 5.2 Fetch batch progress counts for the Area projects list and render progress pies per project

## 6. Logbook Completed Projects Integration

- [x] 6.1 Update Logbook completed projects rows in `src/pages/LogbookPage.tsx` to render the progress control next to each project title link (as a sibling)
- [x] 6.2 Implement reopen-on-click for done projects in Logbook and ensure the reopened project disappears from the list after refresh

## 7. Verification / Self-Test Updates

- [x] 7.1 Update `src/app/selfTest.ts` selectors and flows impacted by Sidebar DOM changes (project rows, reorder chord focus behavior)
- [x] 7.2 Add/extend self-test coverage: complete from ProjectPage header control; reopen from header; reopen from Logbook list
- [x] 7.3 Add/extend self-test coverage: Sidebar reorder chord works when focus is on the progress control
