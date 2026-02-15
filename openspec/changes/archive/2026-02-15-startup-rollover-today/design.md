## Context

Current behavior:

- Milesto stores scheduling as a local-date string `scheduled_at` (`YYYY-MM-DD`).
- The Today view is a strict derived filter: open tasks where `scheduled_at = today`.
- The Upcoming/Plan pages filter future scheduled tasks using `scheduled_at > today`.

Two problems are observed:

1) Open tasks scheduled for a previous day (`scheduled_at < today`) are not surfaced in Today/Upcoming/Anytime, which makes them easy to lose.
2) Several renderer components memoize the local `today` string at mount (e.g. `useMemo(..., [])`). If the app stays open across midnight, actions labeled "Today" can write yesterday's date.

Constraints:

- Renderer must not call IPC directly; it uses `window.api.*` via preload.
- DB access must remain inside the DB worker. Main triggers DB worker actions.
- Date semantics must remain "local date" (no `new Date('YYYY-MM-DD')` UTC parsing pitfalls).
- Keep changes small and avoid new dependencies.

## Goals / Non-Goals

**Goals:**

- Ensure past scheduled open tasks are carried into Today by rolling `scheduled_at` forward to the current local date.
- Perform rollover at app startup before the renderer window is created, so the first render sees consistent data.
- Make "today" computation in the renderer realtime: it updates at local midnight and is computed at action time.
- Keep rollover behavior idempotent and safe across multiple startups.

**Non-Goals:**

- No new "Overdue" grouping or separate view.
- No configurable rollover time ("night owl" settings) in this change.
- No auto-archiving or long-term backlog management.
- No background timer in main to rollover while the app remains open (startup-only rollover).

## Decisions

### Decision: Implement rollover by rewriting `scheduled_at` at startup

We choose to implement rollover by updating the persisted `scheduled_at` for open tasks where `scheduled_at < today`.

Rationale:

- Matches the desired semantics: tasks scheduled for earlier days should appear in Today without manual rescheduling.
- Keeps Today as a simple strict filter (`scheduled_at = today`) with no extra query complexity.
- Preserves existing Today ordering persistence, since list ordering uses a stable list id (`list_positions.list_id = 'today'`).

Alternative considered:

- Expanding Today query to include `scheduled_at <= today` without rewriting data. Rejected because it does not align with the chosen behavior (explicitly changing schedule to today) and complicates the meaning of `scheduled_at` in UI chips.

### Decision: Rollover is executed in DB worker via a dedicated action, invoked from main startup

Implementation sketch:

- Add a DB worker action (e.g. `task.rolloverScheduledToToday`) that:
  - validates payload `{ today: LocalDate }`
  - runs a single transaction that updates matching tasks and sets `updated_at = nowIso()`
  - returns a small result, e.g. `{ rolled_count: number }`.
- In `electron/main.ts`, after creating `DbWorkerClient` and before `createWindow(...)`, compute `today` as a local-date string and invoke the action.

Rationale:

- Ensures a single source of truth for rollover logic (DB worker) and keeps boundary rules intact.
- Startup invocation ensures all list queries (Today/Upcoming/Search hints) operate on a consistent dataset.

### Decision: Renderer uses a single local-today source that updates at local midnight

We will introduce a small renderer utility/hook (e.g. `useLocalToday()` or `getLocalToday()` + `useLocalToday`) that:

- Computes `today` as `formatLocalDate(new Date())`.
- Schedules a `setTimeout` to fire shortly after the next local midnight and refresh the state.
- Recomputes and reschedules after firing.

This replaces `useMemo(() => formatLocalDate(new Date()), [])` in:

- `src/features/tasks/TaskEditorPaper.tsx`
- `src/app/ContentBottomBarActions.tsx`
- `src/app/SearchPanel.tsx`

Additionally, any "Today" action handler should compute the date at click-time from the current hook value (not from an initial memo).

Rationale:

- Fixes cross-midnight staleness without polling.
- Avoids introducing external date libraries.

Alternative considered:

- A global timer in main + pushing updates to renderer. Rejected for unnecessary complexity and cross-boundary churn.

### Optional optimization: Store last rollover date in app_settings

We may persist a key such as `tasks.rollover.lastDate` to skip running rollover more than once per day.

- Pros: avoids scanning/updating on repeated app starts within the same day.
- Cons: adds a new settings key and extra reads/writes.

This is optional because the rollover SQL is inherently idempotent (`scheduled_at < today` becomes `= today`).

## Risks / Trade-offs

- [Surprising schedule changes] -> This design intentionally rewrites `scheduled_at`, which may differ from some users' expectation of preserving the original plan date. Mitigation: make this behavior explicit in specs; consider future "overdue" UI.
- [Large backlog rollover floods Today] -> Rolling all past scheduled open tasks may overwhelm Today. Mitigation: keep as-is for now; consider future archive/limits settings.
- [Clock/timezone changes] -> If the OS timezone or date is changed, rollover and local-today updates may behave unexpectedly. Mitigation: local-date semantics only; keep logic simple and deterministic.
- [Sleep/wake around midnight] -> setTimeout may fire late. Mitigation: always recompute based on current time when the timer fires; re-arm on focus/visibility if needed later.
