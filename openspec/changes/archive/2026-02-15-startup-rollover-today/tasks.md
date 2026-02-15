## 1. DB Worker: rollover action

- [x] 1.1 Add a shared zod input schema for rollover payload `{ today: LocalDate }` (and a small result schema if needed)
- [x] 1.2 Implement DB worker action `task.rolloverScheduledToToday` that updates `tasks.scheduled_at` for eligible open tasks in a transaction and sets `updated_at = nowIso()`
- [x] 1.3 Ensure rollover action is idempotent and does not touch `done` or `deleted` tasks
- [x] 1.4 Add a self-test or lightweight harness assertion that a past scheduled open task is rolled to today after startup

## 2. Electron Main: invoke rollover on startup

- [x] 2.1 Compute local `today` in `electron/main.ts` using existing local-date utilities semantics (no UTC parsing)
- [x] 2.2 Invoke `dbWorker.request('task.rolloverScheduledToToday', { today })` after DB worker creation and before `createWindow(...)`
- [x] 2.3 Optionally persist/consult `app_settings` key `tasks.rollover.lastDate` to skip repeated same-day rollover
- [x] 2.4 Verify self-test mode still works (startup remains deterministic)

## 3. Renderer: realtime local today source

- [x] 3.1 Introduce a renderer utility/hook (e.g. `useLocalToday`) that returns `formatLocalDate(new Date())` and updates shortly after local midnight via `setTimeout` (no polling)
- [x] 3.2 Replace mount-time memoized today (`useMemo(..., [])`) in `src/features/tasks/TaskEditorPaper.tsx` with the realtime today source
- [x] 3.3 Replace mount-time memoized today in `src/app/ContentBottomBarActions.tsx` with the realtime today source
- [x] 3.4 Replace mount-time memoized today in `src/app/SearchPanel.tsx` with the realtime today source

## 4. Verification

- [ ] 4.1 Manual QA: create a task scheduled for yesterday, keep it open, restart app, confirm it appears in Today and `scheduled_at` is rewritten to today
- [ ] 4.2 Manual QA: keep app open across midnight and confirm Schedule->Today and inline editor Schedule->Today write the new date
- [x] 4.3 Run `npm run build` (or at minimum `npx tsc -p tsconfig.json`) and ensure no new type errors
