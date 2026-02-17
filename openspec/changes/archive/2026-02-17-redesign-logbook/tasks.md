## 1. Data Model and Grouping

- [x] 1.1 Define a Logbook entry view model (task/project union) with `kind`, `id`, `title`, `completedAt`, and `updatedAt` derived from list APIs
- [x] 1.2 Implement an O(n) merge of the already-sorted `task.listLogbook()` and `project.listDone()` results into one descending stream
- [x] 1.3 Derive local-month grouping keys (`YYYY-MM`) from the completion timestamp (use `completed_at`, fall back to `updated_at` when needed)
- [x] 1.4 Implement month header labeling with the "current year omits year" rule (e.g., `12月` vs `2025年12月`)
- [x] 1.5 Build a flat virtual row model: month header rows + task rows + project rows, with stable keys for the virtualizer

## 2. Logbook Grouped List UI

- [x] 2.1 Create a Logbook-specific grouped list component (similar to `UpcomingGroupedList`) using `@tanstack/react-virtual` and `useContentScrollRef` (single scroll container)
- [x] 2.2 Render month header rows in the virtual list (visually aligned with existing grouping headers)
- [x] 2.3 Render task rows as: checkbox (interactive) + completion date prefix (M/D) + title button (select + open)
- [x] 2.4 Render project rows as: `ProjectProgressControl` (interactive) + completion date prefix (M/D) + full-width project title button (select + open)
- [x] 2.5 Ensure the project progress control is a sibling of the project title button (not nested) on Logbook rows

## 3. Interactions and Keyboard Behavior

- [x] 3.1 Replace the Logbook Restore button with checkbox-based restore: unchecking a done task calls `window.api.task.toggleDone(taskId, false)` and refreshes the list
- [x] 3.2 Keep project reopen via `ProjectProgressControl` for done projects (status -> open), bump revision for sidebar refresh, and refresh the Logbook list
- [x] 3.3 Keep Logbook as a keyboard-first listbox surface: ArrowUp/Down selects task rows (skip headers/projects), Enter opens selected task
- [x] 3.4 Ensure Logbook does not expose drag-and-drop/manual ordering affordances (no listId / no DnD activator)

## 4. Styling and Localization

- [x] 4.1 Ensure Logbook entry titles are not rendered with line-through decoration (avoid global done styling triggers or add a Logbook-scoped override)
- [x] 4.2 Implement the completion date prefix styling (fixed min-width, muted color, tabular numbers) and reuse the existing date-prefix visual rhythm where appropriate
- [x] 4.3 Remove the separate "Completed Projects" block from `LogbookPage` and remove usage of `logbook.completedProjects`
- [x] 4.4 Confirm the completion date is rendered between the status control and title for both task and project rows

## 5. Self-Test and Verification

- [x] 5.1 Update `src/app/selfTest.ts` Logbook assertions that depend on the old "Completed Projects" section to match the new mixed list structure
- [x] 5.2 Add/adjust self-test checks to ensure the Logbook project progress control exists and is not nested inside the project title link
- [x] 5.3 Keep/adjust the self-test assertion that Logbook has no DnD activator
- [x] 5.4 Run `npx tsc -p tsconfig.json` and `npm run build` and confirm both succeed
- [x] 5.5 Manual smoke: complete a task -> it appears under the correct month; uncheck in Logbook restores/removes it; reopen a project from Logbook removes it and shows it in the sidebar
