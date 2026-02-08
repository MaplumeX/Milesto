## Context

- The global content bottom bar is rendered in `src/app/AppShell.tsx` as `.content-bottom-bar`.
- Task selection state is managed by `TaskSelectionProvider` and exposes:
  - `selectedTaskId` (highlight/navigation)
  - `openTaskId` (editing)
  - `requestCloseTask()` and `registerOpenEditor()` (flush/close semantics)
  See `src/features/tasks/TaskSelectionContext.tsx` and the wiring in `src/app/AppShell.tsx`.
- The codebase uses custom, manual overlays/popovers (no Radix/Headless UI dependency):
  - Anchored popovers: `createPortal` + `position: fixed` + `getBoundingClientRect()` in `src/features/tasks/TaskEditorPaper.tsx`.
  - Floating search overlay (Command Palette): `src/app/CommandPalette.tsx` + `.palette-overlay` styles in `src/index.css`.
- Data updates are performed via business-level preload API `window.api.*`.
  - Scheduling and moving tasks can use `window.api.task.update` (`shared/schemas/task.ts`, `electron/workers/db/actions/task-actions.ts`).

Constraints / existing invariants:
- Bucket normalization rules exist in DB (`normalizeBucketFlags` in `electron/workers/db/actions/task-actions.ts`).
  - Any concrete schedule or project assignment clears Inbox.
- List ordering is per-list via `list_positions` and does not automatically migrate when a task changes list context.

## Goals / Non-Goals

**Goals:**
- Add a bottom-bar action group with `Schedule`, `Move`, `Search` in the content area.
- Match existing UI patterns and avoid introducing new UI libraries.
- Visibility / enablement rules:
  - When `openTaskId != null`: do NOT show this action group (a different editor-specific group may be added later).
  - When `openTaskId == null`: show the group.
  - `Schedule` and `Move` are enabled only when `selectedTaskId != null`.
- `Schedule` opens an anchored popover at the button for editing schedule state.
- `Move` opens an anchored popover at the button and allows moving the selected task to another Area or Project.
  - No section choice; moving always clears `section_id`.
- `Search` opens the existing floating search UI (Command Palette) from a click.

**Non-Goals:**
- Adding section-level move support or section selection UI.
- Implementing a new global search system or new DB search features.
- Changing the task editor’s existing action bar.
- Automatically preserving or migrating manual ordering (`list_positions`) across lists when moving tasks.

## Decisions

### Decision: Keep action group as a child of `.content-bottom-left`

Rationale:
- Minimizes layout churn: existing `+ Task` / `+ Section` remain in place.
- Keeps actions near the existing keyboard hint and aligns with the “bottom bar as action strip” pattern.

Alternative considered:
- Put actions on the right (`.content-bottom-right`). Rejected because the right side is currently informational (`Local, offline`) and the action group benefits from being near creation actions.

### Decision: Hide the action group when an editor is open (`openTaskId != null`)

Rationale:
- Avoids duplicate affordances: the inline editor already contains Schedule controls.
- Avoids state contention: the editor maintains a local draft and serialized auto-save; updating the same task from the bottom bar while editing could cause confusing “last write wins” behavior.

### Decision: Popover implementation reuses the existing manual portal pattern

Implementation approach:
- Model popovers after `src/features/tasks/TaskEditorPaper.tsx` and `src/pages/ProjectPage.tsx` menu:
  - Anchor element stored in state (`anchorEl`).
  - Compute `top/left` from `getBoundingClientRect()`.
  - Render via `createPortal` at `document.body`.
  - Dismiss on:
    - `pointerdown` outside
    - `Escape`
    - `scroll`/`resize` (to avoid stale placement)

Rationale:
- Consistency: avoids mixing interaction models.
- Keeps dependencies stable.

### Decision: Search button triggers Command Palette via a custom event

Current state:
- `CommandPalette` is opened by an internal keydown listener and does not expose an imperative API.

Approach:
- Add an event listener inside `CommandPalette` (or a small shared event bus) to open the palette when receiving a custom event (e.g. `milesto:ui.openCommandPalette`).
- The bottom bar’s `Search` button dispatches this event.

Rationale:
- Minimal surface area: avoids hoisting palette open state up to `AppShell`.
- Preserves keyboard shortcut behavior.

Alternative considered:
- Lift palette `open` state to `AppShell` and pass props. Rejected for now because it increases coupling and changes component API.

### Decision: Move semantics (Area vs Project) are “exclusive” and always clear `section_id`

Confirmed requirement:
- Move to Area: set `area_id=target`, set `project_id=null`, set `section_id=null`.
- Move to Project: set `project_id=target`, set `area_id=null`, set `section_id=null`.

Rationale:
- Aligns with the requested mental model (a task belongs either to an Area bucket or a Project bucket).
- Avoids “task appears in both contexts” ambiguity.

Data source for destinations:
- Prefer `window.api.sidebar.listModel()` since `AppShell` already fetches it for sidebar rendering.
- If needed for completeness, fall back to `window.api.area.list()` and `window.api.project.listOpen()`.

Refresh behavior:
- After applying `task.update`, call `bumpRevision()` to refresh list views (they already depend on `revision`).

## Risks / Trade-offs

- [Manual ordering changes] → After moving/scheduling, the task will appear in the target list without a stored `rank` (`list_positions`), so ordering falls back to the default query sort.
  → Mitigation: accept as v0 behavior; optionally document in spec and consider a follow-up change to seed `list_positions` for the target list.

- [Palette open coupling] → Introducing a custom event is a small global contract.
  → Mitigation: scope event name (`milesto:ui.*`), and keep it inside renderer only.

- [Popover clipping on small windows] → Bottom bar is near viewport edge; popovers must avoid clipping.
  → Mitigation: reuse viewport padding logic from existing popovers; close on resize/scroll.

- [Accessibility gaps] → Custom popovers/menus require explicit focus management.
  → Mitigation: follow ARIA APG patterns for dialog/menu-like popovers; ensure Esc closes and focus returns to trigger.
