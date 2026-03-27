## 1. Section transfer backend

- [x] 1.1 Add shared schema, preload, and `window.api` support for a new `project.section.move` action.
- [x] 1.2 Implement `project.section.move` in the DB worker as one transaction that validates source/target projects, treats current-project selection as a no-op, updates the section owner, updates child task `project_id` values, appends the section to the target project's section order, compacts the source order, and records sync/list mutations.
- [x] 1.3 Migrate per-section task ordering for moved sections from the source `project:<projectId>:<sectionId>` list scope to the target project list scope and cover failure rollback paths.

## 2. Sidebar context menu infrastructure

- [x] 2.1 Add Sidebar Area and Project secondary-click entrypoints in `AppShell` without breaking existing navigation, collapse controls, drag/drop, or keyboard reorder behavior.
- [x] 2.2 Implement Sidebar context-menu dismissal, pointer anchoring, and focus restoration for Area and Project rows.
- [ ] 2.3 Reuse or factor shared menu subviews/helpers only where they reduce duplication without forcing parity with existing overflow menus.

## 3. Sidebar Area and Project actions

- [x] 3.1 Implement the Sidebar Area context menu with `Rename`, `Delete`, and `Tags`, including inline Sidebar rename editing and ordered tag management.
- [x] 3.2 Implement the Sidebar Project context menu with `Plan`, `Move`, `Tags`, `Due`, `Mark Done`, `Cancel Project`, `Rename`, and `Delete`.
- [x] 3.3 Ensure Sidebar Project `Move` uses an Area picker with current-selection no-op behavior and refreshes Sidebar state correctly after ownership or status changes.

## 4. Project section context menu and page behavior

- [x] 4.1 Add Project section-header secondary-click handling in `ProjectGroupedList`, including selecting the section row before opening its context menu and restoring focus on dismiss.
- [x] 4.2 Implement the section context menu root and Project picker subview for `Move`, including current-project selected state and cross-project transfer calls.
- [x] 4.3 Expose `Delete` from the section context menu and refresh the current Project page in place after move/delete.
- [x] 4.4 Add deterministic selection fallback on the current Project page when the selected section disappears after move or delete.

## 5. Verification

- [ ] 5.1 Extend self-tests for Sidebar Area context menus, Sidebar Project context menus, and their route/focus/status side effects.
- [ ] 5.2 Extend Project page self-tests for section context-menu open/dismiss, section delete rehoming, and cross-project section move behavior.
- [x] 5.3 Run the relevant verification commands and confirm the new change is ready for implementation.
