## 1. Shared Schema & Cross-Layer Contract

- [x] 1.1 Update `shared/schemas/area.ts` to allow `title: ''` for entity/create/update schemas (remove `min(1)` constraints)
- [x] 1.2 Update `shared/schemas/project.ts` to allow `title: ''` for entity/create/update schemas (remove `min(1)` constraints)
- [x] 1.3 Confirm DB worker actions continue to parse persisted rows with empty titles (area/project actions return `ok: true` with `title:''`)

## 2. Placeholder Rendering for Empty Titles (No Invisible Rows)

- [x] 2.1 Update Sidebar rendering in `src/app/AppShell.tsx` to display `t('common.untitled')` when `project.title.trim()` is empty
- [x] 2.2 Update Sidebar rendering in `src/app/AppShell.tsx` to display `t('common.untitled')` when `area.title.trim()` is empty (including drag overlay labels)
- [x] 2.3 Update `src/pages/AreaPage.tsx` header title rendering to use placeholder when persisted title is empty
- [x] 2.4 Update `src/pages/AreaPage.tsx` project list rendering (NavLink list) to use placeholder when `p.title.trim()` is empty
- [x] 2.5 Update `src/pages/LogbookPage.tsx` completed project list to use placeholder when `p.title.trim()` is empty
- [x] 2.6 Update dropdown/menu surfaces:
- [x] 2.7  - `src/app/ContentBottomBarActions.tsx` area/project labels use placeholder when empty
- [x] 2.8  - `src/features/tasks/TaskEditorPaper.tsx` project/area `<option>` labels use placeholder when empty

## 3. Sidebar Instant Create UX (Create Immediately, Then Navigate)

- [x] 3.1 Change `.sidebar-create` UI in `src/app/AppShell.tsx` from input-based to choice-based (Project/Area actions create immediately)
- [x] 3.2 Update `handleCreate` in `src/app/AppShell.tsx` to create with `title:''` (no trim guard), handle errors, and prevent double-creates while pending
- [x] 3.3 After create success, close the create UI, `bumpRevision()`, and `navigate` to `/projects/:id?editTitle=1` or `/areas/:id?editTitle=1`

## 4. Auto-Enter Title Editing After Navigation

- [x] 4.1 In `src/pages/ProjectPage.tsx`, read one-time `editTitle` flag and enter title edit mode after project data is loaded; then clear the flag with replace navigation
- [x] 4.2 In `src/pages/AreaPage.tsx`, read one-time `editTitle` flag and enter title edit mode after area data is loaded; then clear the flag with replace navigation
- [x] 4.3 Ensure title focus uses existing `useLayoutEffect + requestAnimationFrame` pattern and does not steal focus when the user already interacted

## 5. Title Commit Semantics (Allow Empty)

- [x] 5.1 Remove/adjust the non-empty guard in `src/pages/AreaPage.tsx` `commitTitleEdit` so committing whitespace-only persists `title:''`
- [x] 5.2 Decide and implement normalization rule: commit should persist `''` for whitespace-only inputs (use `trim()` then store `''`)

## 6. Ordering & Display Consistency

- [x] 6.1 Define and implement sorting rule for empty-titled projects in `src/pages/AreaPage.tsx` (if kept alphabetical): treat display label as placeholder for ordering to avoid odd ordering

## 7. Test Harness Updates

- [x] 7.1 Update Sidebar create flow in `src/app/selfTest.ts` to match the new UI (remove dependency on `.sidebar-create input.input`)
- [x] 7.2 Add/adjust selfTest assertions to verify:
- [x] 7.3  - creation navigates to the new page
- [x] 7.4  - title input is focused (or edit mode is active)
- [x] 7.5  - sidebar rows are visible and show placeholder when title is empty

## 8. Verification

- [x] 8.1 Run TypeScript typecheck (`npx tsc -p tsconfig.json`) and fix any regressions
- [x] 8.2 Run build (`npm run build`) to ensure bundling succeeds
