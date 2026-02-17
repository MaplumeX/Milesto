## Context

Current state:

- The Logbook route is `src/pages/LogbookPage.tsx` (`#/logbook`).
- The UI is split into two blocks:
  - Completed tasks are rendered via `src/features/tasks/TaskList.tsx`.
  - Completed projects are rendered as a separate list with a section header (`logbook.completedProjects`).
- Completed task rows rely on the shared task row styling (`src/index.css`). The global `.task-row.is-done .task-title` rule applies a line-through.
- Logbook currently disables done toggling for tasks (`onToggleDone={undefined}`) and instead exposes a Restore button via `TaskRow` (`onRestore` -> `window.api.task.restore`).
- Lists that need grouping and virtualization already use a flat "row model" approach (e.g. `src/features/tasks/UpcomingGroupedList.tsx` + `buildUpcomingRows`).

Constraints:

- Must keep a single primary scroll container (AppShell `.content-scroll`), and remain virtualization-friendly for large lists.
- Avoid cross-boundary violations: renderer uses `window.api.*` only; DB actions stay in the DB worker.
- Prefer reusing existing patterns/utilities (virtualization, date prefix styling) over introducing new dependencies.

## Goals / Non-Goals

**Goals:**

- Render Logbook as one mixed list of completed tasks and completed projects.
- Group entries by completion month (local time) with most recent months first.
- Show completion date (M/D) between the status control and the entry title.
- Remove the Restore button from Logbook while keeping "recycle" capability:
  - Tasks restore by toggling the checkbox (done -> open).
  - Projects reopen via `ProjectProgressControl` (done -> open), not nested inside the title link.
- Do not show strikethrough styling in Logbook.
- Keep performance characteristics similar to existing virtualized list surfaces.

**Non-Goals:**

- No DB schema changes and no new DB worker actions.
- No new UI dependency adoption (shadcn/radix migration is out of scope).
- No bulk restore/reopen or undo stack work.
- No changes to search semantics or other list pages.

## Decisions

### Decision: Implement Logbook as a dedicated grouped, virtualized list component

We will implement a Logbook-specific grouped list (similar to `UpcomingGroupedList`) instead of trying to shoehorn the existing `TaskList` (task-only) surface.

Rationale:

- Logbook needs mixed row types (month headers + task rows + project rows).
- Logbook needs an extra inline column (completion date) and Logbook-specific done styling.
- Avoids changing `TaskRow` in ways that could affect all other list surfaces.

Alternatives considered:

- Extend `TaskList`/`TaskRow` with slots for date prefix + row kinds (rejected: high coupling and high regression risk across all list pages).

### Decision: Merge tasks + projects using a linear merge, not a full re-sort

Inputs:

- `window.api.task.listLogbook()` returns done tasks ordered by `completed_at DESC`.
- `window.api.project.listDone()` returns done projects ordered by `completed_at DESC`.

We will merge these two already-sorted arrays in O(n) time to create a single descending stream.

Rationale:

- Keeps the per-refresh cost predictable for large logbooks.
- Avoids allocating and sorting a potentially large concatenated array.

Alternatives considered:

- `entries = [...tasks, ...projects].sort(...)` (rejected: O(n log n) and more allocations; unnecessary given DB ordering).

### Decision: Group by local-month derived from completion timestamps

We will derive grouping keys using the local time interpretation of `completed_at` (ISO datetime).

- `monthKey = YYYY-MM` (local) used as a stable grouping key.
- Month label uses "current year omits year" rule.

Rationale:

- Matches user expectations for "monthly review" (local calendar months).
- Avoids confusing edge cases around UTC midnight boundaries.

### Decision: Reuse existing "date prefix" visual rhythm

The completion date (M/D) will be rendered as a fixed-width prefix between the status control and the title, using the same visual rhythm as `UpcomingGroupedList` (tabular numbers, muted color, min-width alignment).

Notes:

- Even though the CSS class name is currently `upcoming-date-prefix`, we can either reuse it or create a Logbook-specific alias class with identical styling.

### Decision: Remove strikethrough by avoiding global done styling triggers

We will not rely on `.task-row.is-done .task-title` for Logbook rows.

Approach options:

- Prefer: do not apply the `is-done` class to Logbook task rows.
- If `is-done` is required for some reason, override within a Logbook root scope so `text-decoration: none`.

### Decision: Replace Restore button with status-control toggles

- Tasks: use `window.api.task.toggleDone(taskId, false)` when the user unchecks a done task in Logbook.
- Projects: keep `ProjectProgressControl` as the interactive reopen affordance, backed by `window.api.project.update({ id, status: 'open' })`.

Rationale:

- Matches the PRD rule: restore only affects `status` and `completed_at` for tasks.
- Keeps the row surface minimal and avoids a third control per row.

### Decision: Keep keyboard listbox behavior task-focused (projects via Tab/click)

We will keep the Logbook list as a listbox surface consistent with other task list pages, using `useTaskSelection()` for task selection/open.

Trade-off:

- ArrowUp/Down selection can continue to skip non-task rows (month headers and project rows) to keep the existing task selection contract intact.
- Project rows remain accessible by Tab and pointer.

Alternative (deferred): implement a Logbook-local selection model that can include projects, then map task selection into `useTaskSelection`.

## Risks / Trade-offs

- [Mixed row types complicate selection and a11y] -> Keep the listbox semantics consistent and skip non-task rows for ArrowUp/Down; ensure project rows are reachable via Tab.
- [Timezone boundary differences between UTC and local] -> Explicitly define grouping and display in local time; add scenarios for edge timestamps.
- [Nullable `completed_at` on legacy rows] -> Treat missing `completed_at` as a fallback to `updated_at` for ordering/grouping, but keep requirements focused on done entries.
- [Performance regressions on large logbooks] -> Use O(n) merge + virtualization; keep row heights stable and avoid expensive per-row computations.

## Migration Plan

- Renderer-only change: restructure Logbook page rendering and interactions.
- No schema migrations; no new DB actions.
- Rollback: revert Logbook renderer to the previous split layout; existing APIs remain compatible.

## Open Questions

- Should project rows participate in ArrowUp/Down selection (requires broader selection state), or remain Tab/click-only? Default plan: Tab/click-only.
