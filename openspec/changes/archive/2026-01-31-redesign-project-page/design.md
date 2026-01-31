## Context

Current state:

- Project detail route is `src/pages/ProjectPage.tsx` (`/projects/:projectId`).
- The page is fragmented:
  - An Area selector lives in its own top block.
  - The project title + “no section” tasks are rendered via `src/features/tasks/TaskList.tsx`.
  - Sections are rendered as separate cards with a simplified task list (no keyboard-first behavior, no inline editor, no virtual scrolling).
- Tasks fetched via `window.api.task.listProject(projectId)` only include `status = 'open'` (DB worker query filters on open).
  - This means completed tasks cannot be shown in Project context.
- The codebase currently uses native `prompt/confirm/alert` for many CRUD and destructive actions.
  - There is no shared dropdown/overflow menu component.
  - There are existing custom overlay patterns (`TaskEditorOverlayPaper`) and portal-based popovers (`TaskEditorPaper`).

Constraints:

- Must preserve Electron boundary rules: Renderer uses `window.api.*` only; DB writes happen in DB worker; payloads validated.
- Must keep a single primary scroll container (AppShell’s `.content-scroll`), and keep lists virtualized at scale.
- Avoid adding new external dependencies for this change.

## Goals / Non-Goals

**Goals:**

- Redesign Project page into one consistent hierarchy: header (status checkbox + title + overflow menu) -> notes -> tasks.
- Provide a project-level completion checkbox that (after confirmation) marks the project as done and completes all tasks in that project.
- Keep the user on the Project page after completing the project, even though completed projects disappear from the sidebar (open-project-only).
- Show tasks grouped by section (including empty sections), with completed tasks available in context.
- Default-collapse completed tasks with a single toggle, and do not persist the toggle state.
- Add an editable Project notes section immediately below the header.

**Non-Goals:**

- Migrating the app to shadcn/ui + Tailwind (the repo does not currently have those dependencies wired up).
- Adding project deletion or new project fields.
- Making completed-toggle state persistent.
- Changing global task semantics (Inbox/Today/Upcoming rules, etc.).

## Decisions

### Decision: Implement project completion as a single transactional DB action

We will add a DB worker action (e.g. `project.complete`) that performs the project + tasks completion in one transaction.

Rationale:

- Avoids N IPC calls + inconsistent partial states.
- Aligns with redlines: DB writes must be transactional.

Alternatives considered:

- UI loops over `task.toggleDone` for each task (rejected: slow, non-atomic, difficult error recovery).

### Decision: Keep reopen non-symmetric (reopen project does not restore tasks)

Reopening a project only flips `project.status` back to `open`. Tasks remain `done`.

Rationale:

- Matches explicit product decision.
- Avoids surprising mass state changes when reopening.

Trade-off:

- Users can reopen a project and see “0 open, N done”. The UI should display counts clearly.

### Decision: Expose completed tasks without loading large fields; prefer lazy loading

We will continue to treat list views as “lightweight rows” (no notes/checklists). Completed tasks should be available for Project context, but the default state is collapsed.

Approach:

- Keep existing `task.listProject(projectId)` behavior (open tasks only) for backward compatibility.
- Add a lightweight way to compute completed count for the “Completed (N)” toggle.
- Load completed tasks list only when the user expands the toggle.

Alternatives considered:

- Always load open+done tasks on page load (rejected: unnecessary work when completed is collapsed; could impact large projects).
- Modify existing `task.listProject` signature to include options (possible, but risks unintended behavioral coupling; additive endpoints are safer).

### Decision: Use a single virtualized, keyboard-first list surface for project tasks

Project tasks should follow the same interaction quality as existing task lists:

- One scroll element: AppShell’s `.content-scroll` (via `useContentScrollRef`).
- Virtualization via `@tanstack/react-virtual`.
- Keyboard-first selection (ArrowUp/Down) and open-on-Enter.

Implementation approach:

- Introduce a Project grouped list rendering model similar to `src/features/tasks/UpcomingGroupedList.tsx`:
  - Row types: section header rows + task rows.
  - When completed is collapsed: only open tasks are present as task rows.
  - When expanded: completed tasks appear in their section after open tasks.

Alternatives considered:

- Render multiple `TaskList` instances (one per section) (rejected: multiple listboxes and header duplication; risks nested scroll confusion).
- Keep the current simple `<ul>` for section tasks (rejected: loses keyboard-first + inline editor parity and scales poorly).

### Decision: Use existing dialog patterns (native confirm) and a lightweight custom overflow menu

- Confirmation: use `confirm()` for the “complete project + complete tasks” action (consistent with existing codebase usage).
- Overflow menu: implement a lightweight anchored popover menu using existing portal/outside-click patterns (similar to `TaskEditorPaper` popovers).

Rationale:

- No existing shared menu component.
- Avoids adding shadcn/radix dependencies in this change.

## Risks / Trade-offs

- [Completed projects disappear from sidebar but user stays on page] → Add a subtle inline hint/toast after completion; ensure Logbook lists completed projects and links back.
- [Large numbers of completed tasks] → Default collapse + lazy-load completed task list; keep virtualization for rendering.
- [More UI complexity from menu + grouped list] → Reuse `UpcomingGroupedList` + `TaskList` patterns for selection, virtualization, and a11y.
- [Non-symmetric reopen can confuse] → Show clear counts in header meta (open/done/total) and in Tasks toggle.

## Migration Plan

- Additive IPC/API changes only (new DB actions and `window.api` methods).
- No schema migrations required (reuse existing `projects.status`, `projects.notes`, `tasks.status`).
- Rollback: revert renderer usage of new APIs; additive endpoints can remain without affecting existing flows.

## Open Questions

- Ordering of completed tasks within a section (keep rank order vs completed_at order). Default plan: keep the same rank/created_at ordering and render completed tasks after open tasks.
