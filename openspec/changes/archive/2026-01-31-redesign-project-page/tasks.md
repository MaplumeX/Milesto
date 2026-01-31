## 1. DB Worker + IPC Surface

- [x] 1.1 Define a new DB worker action contract for completing a project (input schema + result schema)
- [x] 1.2 Implement the transactional DB worker action to mark the project `done` and mark all non-deleted tasks in that project `done`
- [x] 1.3 Wire the new action through `electron/main.ts` + `electron/preload.ts` and add a typed method to `shared/window-api.ts`

- [x] 1.4 Add a lightweight DB worker action to return the count of completed tasks for a project (for the "Completed (N)" toggle)
- [x] 1.5 Add a DB worker action to list completed tasks for a project as lightweight `TaskListItem[]` (no large fields), preserving stable ordering
- [x] 1.6 Wire the completed-task count + list APIs through `electron/main.ts` + `electron/preload.ts` + `shared/window-api.ts`

## 2. Project Page Data Loading

- [x] 2.1 Refactor `src/pages/ProjectPage.tsx` data fetching to support the new layout (project + sections + open tasks + completed count)
- [x] 2.2 Load completed task rows lazily only when the user expands the Completed toggle
- [x] 2.3 Ensure sidebar stays consistent by bumping app revision after project status changes (complete/reopen) and after area changes

## 3. Header UX (Complete Checkbox + Overflow Menu)

- [x] 3.1 Replace the current split layout with a single Project header containing: completion checkbox, project title, overflow menu button
- [x] 3.2 Add a confirmation step when checking the completion checkbox (cancel => no changes)
- [x] 3.3 On confirm, call the new atomic completion API; keep the user on `/projects/:projectId` after completion
- [x] 3.4 Add a reopen action (from the overflow menu) that flips only the project status back to `open` (tasks remain `done`)

## 4. Notes Section

- [x] 4.1 Add a Project notes section below the header with an empty-state affordance
- [x] 4.2 Persist notes via `project.update({ id, notes })` (auto-save via debounce and/or save-on-blur), without nested scrolling

## 5. Tasks Section (Sections + Completed Toggle)

- [x] 5.1 Implement a single virtualized, keyboard-first task surface for Project tasks (section header rows + task rows), using AppShell `.content-scroll`
- [x] 5.2 Ensure tasks are grouped by section, including a top "no section" group and empty section groups
- [x] 5.3 Add a global "Completed (N)" toggle in the Tasks area header (default collapsed, not persisted)
- [x] 5.4 When collapsed, render only open tasks; when expanded, render completed tasks within their section groups
- [x] 5.5 Ensure per-task completion toggles still work (checkbox toggles done/open) and update counts + lists correctly

## 6. Overflow Menu + Accessibility/Polish

- [x] 6.1 Implement a lightweight overflow popover menu (no new deps) with outside-click + Escape close, and proper `aria-*` attributes
- [x] 6.2 Consolidate existing project-level actions into the menu (rename project, move to area, new section, reopen/mark done)
- [x] 6.3 Ensure key interactions remain keyboard-friendly (focus handling for menu + listbox)

## 7. Verification

- [x] 7.1 Extend `src/app/selfTest.ts` (or equivalent) to cover the project completion flow and completed toggle behavior
- [x] 7.2 Run `npm run build` and fix any regressions introduced by the change
