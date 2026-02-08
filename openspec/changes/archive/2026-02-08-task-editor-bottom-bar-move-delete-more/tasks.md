## 1. Shared Types, Schemas, and i18n

- [x] 1.1 Add a `TaskDeleteInputSchema` (and type) for `{ id }` payload (mirror existing delete inputs)
- [x] 1.2 Extend `shared/window-api.ts` `WindowApi.task` with `delete(id: string): Promise<Result<{ deleted: boolean }>>`
- [x] 1.3 Add i18n strings for `More` (and delete confirmation copy if needed) in `shared/i18n/messages.ts`

## 2. DB Worker + IPC Plumbing (task.delete)

- [x] 2.1 Implement `task.delete` DB action in `electron/workers/db/actions/task-actions.ts` (soft delete via `deleted_at`, transactional, `WHERE deleted_at IS NULL`)
- [x] 2.2 Register IPC handler in `electron/main.ts` via `handleDb('db:task.delete', 'task.delete', ...)` with schema validation
- [x] 2.3 Expose `window.api.task.delete` in `electron/preload.ts` mapping to `db:task.delete`
- [x] 2.4 Verify deleted tasks are excluded from list/search/detail surfaces (queries already filter `deleted_at IS NULL`; confirm `getDetail` returns NOT_FOUND after delete)

## 3. Renderer: Edit-Mode Bottom Bar Actions

- [x] 3.1 Update `src/app/AppShell.tsx` bottom bar branching: when `openTaskId !== null`, render only `Move` / `Delete` / `More` (no `+ Task`, no `+ Section`, no `Schedule`, no `Search`)
- [x] 3.2 Reuse existing move popover behavior for edit mode, targeting the open task (not selection)
- [x] 3.3 Implement edit-mode `Delete` flow: confirm → flush open editor pending changes → call `window.api.task.delete(openTaskId)` → close editor + refresh; on flush failure keep editor open and focus error target
- [x] 3.4 Implement `More` placeholder button (clickable, no menu)
- [x] 3.5 Validate focus behavior after delete (no focus loss to `body`; falls back reasonably when the deleted row unmounts)

## 4. Self-Test Coverage

- [x] 4.1 Add/adjust self-test anchors for edit-mode bottom bar actions (distinct from `[data-content-bottom-actions="true"]` used by list-mode actions)
- [x] 4.2 Extend `src/app/selfTest.ts` to assert edit-mode bottom bar shows `Move/Delete/More` and hides other buttons
- [x] 4.3 Add a self-test case for confirm-delete cancel vs confirm-delete success (and ensures the editor closes only on success)

## 5. Verification

- [x] 5.1 Run `npx tsc -p tsconfig.json` and fix any new type errors
- [x] 5.2 Run `npm run build` to ensure the app bundles successfully
