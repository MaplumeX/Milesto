## 1. Shared status contracts

- [x] 1.1 Extend shared task/project status schemas, localized status labels, and preload/window API contracts to accept `cancelled`
- [x] 1.2 Add explicit `task.cancel` and `project.cancel` IPC actions while preserving the existing complete/reopen entry points
- [x] 1.3 Update any shared status helpers and row/control props so renderer surfaces can distinguish `done` vs `cancelled`

## 2. DB worker terminal-state semantics

- [x] 2.1 Implement `task.cancel` and ensure task restore continues to reopen both `done` and `cancelled` tasks
- [x] 2.2 Implement `project.cancel` as an atomic project + open-child-task cancellation transaction
- [x] 2.3 Update closed-task, closed-project, Logbook, progress-count, and `include_logbook` search queries to treat `done` and `cancelled` as the terminal-state set

## 3. Renderer task and project surfaces

- [x] 3.1 Update shared task row / checkbox / title styling so cancelled tasks render with an `x` affordance and line-through title
- [x] 3.2 Add `Cancel` / `Restore` handling to the task context menu and overlay task editor while keeping the editor/menu open-state rules intact
- [x] 3.3 Update the Project page header, overflow menu, and `Completed` collapse so cancelled projects and tasks follow the new closed-state behavior
- [x] 3.4 Update `ProjectProgressControl` and related project-list surfaces so cancelled projects render an `x` state and closed progress includes both `done` and `cancelled`
- [x] 3.5 Update Logbook rendering so done and cancelled entries share the same grouped list while preserving distinct title styling and restore/reopen affordances

## 4. Verification

- [x] 4.1 Add or extend self-tests for task cancel/restore, project cancel/reopen, Logbook closed-entry rendering, and closed progress counts
- [x] 4.2 Run the relevant verification commands for touched surfaces and fix any regressions before applying the change
