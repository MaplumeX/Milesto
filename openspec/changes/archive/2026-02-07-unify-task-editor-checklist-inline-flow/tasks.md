## 1. Checklist component refactor

- [x] 1.1 Refactor `src/features/tasks/TaskEditorPaper.tsx` `Checklist` to use row-level editable inputs with a local row view model (stable local key + optional persisted id + draft title state).
- [x] 1.2 Remove legacy checklist UI pieces in `Checklist`: `.checklist-create` block, standalone `Add` button, per-row `Delete` button, and `prompt`-based rename path.
- [x] 1.3 Keep inline + overlay rendering on the same `Checklist` implementation, avoiding variant-specific behavior forks.

## 2. Entry and focus behavior unification

- [x] 2.1 Update inline empty-state entry (`Checklist` action button path in `TaskEditorPaper`) so click creates an empty checklist row and focuses its title input.
- [x] 2.2 Implement overlay empty-state entry in checklist area with the same behavior: create empty row and focus input.
- [x] 2.3 Implement deterministic focus restoration after create/delete using row key–based refs (next row, then previous row, then inline `Checklist` action button fallback).

## 3. Keyboard and submit semantics

- [x] 3.1 Implement `Enter` submit for checklist row title inputs (IME-safe via composition guard) and auto-create/focus the next empty row after successful non-empty submit.
- [x] 3.2 Implement `Blur` submit for checklist rows without auto-creating a next row.
- [x] 3.3 Implement empty-title submit semantics: persisted row -> delete API; temporary row -> local discard without creating empty persisted data.
- [x] 3.4 Preserve inline collapse behavior when checklist becomes empty and re-show the Action Bar `Checklist` button.

## 4. Persistence safety and autosave isolation

- [x] 4.1 Keep checklist persistence on existing APIs (`window.api.checklist.create/update/delete`) and maintain incremental `detail.checklist_items` updates without refetch.
- [x] 4.2 Track checklist in-flight mutations and include them in `TaskEditorPaperHandle.flushPendingChanges()` close/switch safety.
- [x] 4.3 Ensure checklist failures set actionable error state without clobbering title/notes/other field drafts.

## 5. UI contract and regression updates

- [x] 5.1 Update checklist-related styles in `src/index.css` to match row-input structure and remove obsolete `.checklist-create`/button-dependent styling.
- [x] 5.2 Update `src/app/selfTest.ts` checklist scenario assertions to validate new flow (click creates focused row input, Enter creates next, empty submit removes row).
- [x] 5.3 Update any selector assumptions tied to `Add checklist item…` placeholder or `Delete` text so self-test remains stable.

## 6. Verification

- [ ] 6.1 Manual QA inline editor checklist flow (empty-state entry, Enter chaining, empty-title removal, final-item collapse, focus continuity).
- [ ] 6.2 Manual QA overlay editor checklist flow using the same interaction model and keyboard behavior.
- [x] 6.3 Run repository validation commands required by current project workflow (at least `npm run build`) and resolve regressions introduced by this change.
