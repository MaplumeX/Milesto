## 1. Data Model And Schemas

- [x] 1.1 Add project plan Someday field to `ProjectSchema` and inputs (`is_someday` + invariants with `scheduled_at`)
- [x] 1.2 Add DB migration to add `projects.is_someday` with default 0 and backfill
- [x] 1.3 Update all DB queries that parse `ProjectSchema` to include/select `is_someday`
- [x] 1.4 Update export/import paths that use `ProjectSchema` to handle the new field consistently

## 2. Project Delete End-To-End

- [x] 2.1 Add `ProjectDeleteInputSchema` and `project.delete` typing to `shared/window-api.ts`
- [x] 2.2 Implement `project.delete` DB worker action (soft delete + cascade to project tasks and sections)
- [x] 2.3 Wire IPC for `db:project.delete` (main handler + preload API)

## 3. ProjectPage Data Fetch And Meta Row

- [x] 3.1 Switch ProjectPage refresh to use `window.api.project.getDetail` (project + ordered tags)
- [x] 3.2 Add meta row between header and notes to display plan/due/tags chips when present
- [x] 3.3 Implement chip close (x) behaviors: clear plan, clear due, remove a single tag (persist via update/setTags)

## 4. Project Overflow Menu (Single Popover With Subviews)

- [x] 4.1 Move overflow trigger button to sit closer to the title in the header layout
- [x] 4.2 Replace menu root items with: Complete/Reopen, Plan, Due, Move, Tags, Delete (no values shown on root)
- [x] 4.3 Implement Plan subview with DayPicker and quick actions (Someday, Today, Clear)
- [x] 4.4 Implement Due subview with DayPicker and quick actions (Clear; optionally Today)
- [x] 4.5 Implement Move subview to set project area (Area list + None)
- [x] 4.6 Implement Tags subview by reusing the task tags picker interaction (list + create + checkboxes)
- [x] 4.7 Implement Delete action with confirmation and navigate away after success
- [x] 4.8 Ensure focus/keyboard behavior: Escape closes whole popover, Back returns to root, close restores focus to trigger

## 5. i18n And Self-Test

- [x] 5.1 Update i18n keys/messages for new menu labels and confirmations (en + zh-CN parity)
- [x] 5.2 Update `src/app/selfTest.ts` if needed to reflect the new menu structure while preserving Reopen coverage

## 6. Verification

- [x] 6.1 Run typecheck/build and fix any regressions introduced by schema + DB changes
- [x] 6.2 Run the self-test flow and validate Project completion/reopen, tags, and deletion paths
