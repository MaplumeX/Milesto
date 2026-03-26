## 1. Shared menu foundation

- [x] 1.1 Add renderer tests that cover task context menu open/close behavior and root actions before implementation
- [x] 1.2 Implement a shared task context menu controller and portal surface with root / secondary panel state
- [x] 1.3 Coordinate context menu opening with `TaskSelectionContext.requestCloseTask()` so an open inline editor is flushed before the menu opens

## 2. Menu actions and persistence

- [x] 2.1 Add failing renderer tests for schedule and due panel actions, then implement immediate-save behavior that closes the menu on success
- [x] 2.2 Add failing renderer tests for tags lazy-loading and immediate multi-toggle save semantics, then implement the existing-tags-only tags panel
- [x] 2.3 Add failing renderer tests for complete / restore root actions, then implement immediate status mutation and menu close behavior

## 3. Row integration across task surfaces

- [x] 3.1 Wire the shared context menu into `TaskList` / `TaskRow` based task surfaces
- [x] 3.2 Wire the shared context menu into custom task row renderers in `UpcomingGroupedList`
- [x] 3.3 Wire the shared context menu into completed / Logbook task rows without enabling it for non-task Logbook project entries

## 4. Verification and completion

- [x] 4.1 Run focused renderer tests for the new task context menu flows and fix regressions
- [x] 4.2 Run the broader verification command(s) needed for touched task-list renderer surfaces
