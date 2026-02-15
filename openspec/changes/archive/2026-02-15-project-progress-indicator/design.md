## Context

Milesto currently represents project completion as a binary checkbox:

- `src/pages/ProjectPage.tsx` renders a header checkbox that completes the project (with confirmation) and is disabled when the project is `done`.
- Project lists (Sidebar, Area page, Logbook) render project titles as links only, with no progress signal or completion/reopen affordance.

To support a progress-driven control across multiple lists, we also need a per-project task completion ratio. Today, the only count API is `task.countProjectDone(projectId)` which is single-project and does not provide totals.

Constraints:

- UI must remain minimal and keyboard-first (see `docs/ui.md`).
- List views must avoid N IPC calls (performance + responsiveness).
- Sidebar project rows are also drag-and-drop activators; adding a separate clickable control must not break DnD or navigation.
- Electron/Chromium is the runtime (modern CSS features are available).

## Goals / Non-Goals

**Goals:**

- Introduce a reusable Project progress control:
  - Pie fill starts at 12 o'clock and fills clockwise based on task completion (0-100%).
  - `0%` is an empty interior.
  - `done` state is a high-contrast solid circle with a checkmark.
- Use the same control in:
  - Project page header
  - Sidebar open projects list
  - Area page project list
  - Logbook completed projects list
- Make interactions consistent:
  - `open` click -> confirmation -> `project.complete`.
  - `done` click -> `project.update({ status: 'open' })` (no confirmation).
- Provide an efficient batch counts API for per-project `{done_count, total_count}`.

**Non-Goals:**

- Allow editing progress (progress is derived from tasks; the control is not a progress editor).
- Redesign other list row layouts beyond what is required to place the new control safely.
- Introduce new external UI dependencies (e.g. shadcn/tailwind migration) as part of this change.

## Decisions

### Decision: Render the visual pie with `conic-gradient`

We will implement the pie fill using modern CSS:

- A base circular button with a 1px border (using existing tokens like `--border`).
- When `0%`, render no fill.
- When `>0%` and project is `open`, render a `conic-gradient(...)` fill from 12 o'clock.
- When project is `done`, ignore the pie and show the done style (solid + check).

**Alternatives considered:**

- SVG wedge path + mask: precise but more verbose and harder to style consistently across sizes.
- Pure SVG arc: better for ring-style progress, but the chosen design is a pie fill.

### Decision: Use a standalone `<button>` (not a nested checkbox input)

The control is visually not a checkbox, and it must coexist next to links and DnD activators. A dedicated `button` makes it straightforward to:

- Avoid nested interactive elements (do not place it inside a `NavLink`).
- Stop propagation to prevent accidental navigation or drag activation.
- Implement consistent keyboard activation (Enter/Space) and focus ring.

Accessibility approach:

- Provide a stable accessible name describing the action (complete vs reopen).
- Provide a description string that includes progress (e.g. "Progress 30%") via `aria-describedby` or by embedding into the accessible label.

### Decision: Add a batch per-project task counts IPC API

Add an API that returns per-project `{project_id, total_count, done_count}` for a list of project ids. This enables list views to render progress without per-row IPC.

Recommended shape:

- Input: `{ project_ids: string[] }`
- Output: array of `{ project_id: string, total_count: number, done_count: number }`

DB query should:

- Exclude deleted tasks (`deleted_at IS NULL`).
- Include both `open` and `done` tasks in `total_count`.
- Count `done` tasks as `done_count`.

Large id lists:

- If the SQLite host parameter limit becomes a concern, the implementation can chunk requests in the renderer (e.g. batches of 500-900 ids) while still being dramatically better than N calls.

**Alternatives considered:**

- Embed counts into `sidebar.listModel` / `project.listOpenByArea` / `project.listDone` responses. This reduces calls further but increases schema churn across multiple endpoints.
- Provide scope-based count endpoints (open/done/area) to avoid `IN (...)`. More complex surface area; revisit only if needed.

### Decision: Keep refresh behavior tied to existing revision bumps

All affected views already refresh on `useAppEvents().revision`.

- Sidebar: `AppShell` refreshes `sidebar.listModel()` on revision changes.
- AreaPage and LogbookPage refresh their data on revision changes.

Counts fetching should follow the same refresh trigger to keep progress consistent after mutations.

## Risks / Trade-offs

- **[DnD interference in Sidebar]** → Ensure the progress button is not the sortable activator; stop propagation on pointer events for the button.
- **[Nested interactive elements]** → Render the button as a sibling of the `NavLink`, not a child.
- **[Batch counts performance]** → Use a single grouped query; only refetch on revision changes.
- **[Large project lists exceeding SQLite parameter limit]** → Chunk `project_ids` in the renderer while keeping behavior correct.
- **[Confusing `open 100%` vs `done`]** → Distinguish visually: `open` uses a low-contrast wash fill; `done` uses a high-contrast solid fill + checkmark.

## Migration Plan

- Add the new batch counts schema + IPC endpoint.
- Introduce the shared progress control component (list size + header size variants).
- Replace the ProjectPage header checkbox with the new control (including reopen-on-click).
- Add the control to Sidebar / AreaPage / Logbook project lists.
- Update the self-test harness (if applicable) to cover completion + reopen via the new control.

## Open Questions

- Should the control ever show numeric percent text (currently not required; pie fill only)?
- If a user has an unusually large number of projects, do we need a scope-based count endpoint instead of id batching?
