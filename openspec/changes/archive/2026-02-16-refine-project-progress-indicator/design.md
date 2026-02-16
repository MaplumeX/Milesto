## Context

Milesto renders a reusable per-project progress control across multiple UI surfaces:

- Sidebar open projects list
- Area page projects list
- Logbook completed projects list
- Project page header

Current implementation details (renderer):

- `src/features/projects/ProjectProgressControl.tsx` renders a `<button class="project-progress-control">`.
- `src/index.css` draws progress using `background: conic-gradient(from -90deg, ...)` on the button itself.
- There is no explicit border-to-fill spacing: the fill touches the edge (inside the 1px border).
- In the Sidebar (`src/app/AppShell.tsx`), the progress control is a separate focusable sibling next to the project title link and is currently wired to complete/reopen the project.

Spec context:

- `openspec/specs/project-progress-indicator/spec.md` already requires a pie fill that starts at 12 o'clock and fills clockwise.
- `openspec/specs/sidebar-project-area-dnd/spec.md` currently assumes a separate focusable progress control (not nested in the link) and includes a keyboard reorder scenario when focus is on that control.

This change refines both the visuals (start angle + gap ring) and the Sidebar interaction model (display-only indicator, no complete/reopen).

## Goals / Non-Goals

**Goals:**

- Pie fill starts at 12 o'clock and fills clockwise on all surfaces.
- Add a background-colored gap ring between the outer border and the inner pie fill.
- Keep the gap ring in the done style while keeping the outer border hidden (transparent).
- Sidebar: show the indicator to the left of the project title and visually group it with the row.
- Sidebar: make the indicator display-only (no complete/reopen action from the Sidebar).
- Update the renderer self-test harness so keyboard reorder coverage does not depend on focusing the progress control.

**Non-Goals:**

- No change to how progress counts are computed (API and SQL semantics remain unchanged).
- No change to project completion semantics (still defined by `project-bulk-complete`).
- No redesign of colors, typography, or overall sidebar layout beyond positioning the indicator.
- No new external dependencies.

## Decisions

### Decision 1: Render the gap ring via an inset inner layer (pseudo-element)

We will treat the existing `.project-progress-control` element as the outer container:

- Outer container renders size + border.
- An inner layer renders the fill, inset from the border by a per-size gap.

ASCII sketch (top-down):

```
┌─────────────── outer border (1px) ───────────────┐
│   gap ring (transparent = background shows)      │
│     ┌──── inner fill layer (conic / solid) ───┐  │
│     │                                         │  │
│     └─────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

Implementation approach (CSS-level):

- Add a `::before` pseudo-element on `.project-progress-control`.
- `::before` is `position: absolute` and uses `inset: var(--ppc-gap)`.
- `--ppc-gap` is set per size:
  - list: `2px`
  - header: `3px`
- The outer element background stays `transparent` so the gap ring is effectively “empty” and shows the underlying surface background.

Progress fill rules:

- `partial`: `conic-gradient(...)` on the inner layer.
  - Remove the `from -90deg` rotation so the default 12 o'clock start is used.
- `full`: solid fill on the inner layer.
- `done`: solid fill on the inner layer + check icon.
  - Outer border remains present but uses `border-color: transparent`.
  - Hover styles must not reintroduce a visible border for `done`.

Alternatives considered:

- **Padding + background-clip/content-box**: possible but harder to reason about with multiple states and hover/focus styles.
- **SVG**: crisp, but would require replacing the existing CSS-driven approach and would be a larger refactor than necessary.

### Decision 2: Sidebar uses a display-only indicator nested in the project link

The Sidebar requirement is “left of the item, visually grouped, no click to complete/reopen”. The cleanest UX is:

- Render a non-interactive indicator as a decorative leading element *inside* the project `NavLink`.
- Clicking the indicator area navigates (same as clicking the row), because it is part of the link.

This implies:

- The Sidebar should no longer render the interactive `ProjectProgressControl` button as a sibling.
- The Sidebar should no longer wire `onActivate` to complete/reopen.
- The project row link (`.nav-project-row`) becomes a flex row similar to the Area row pattern (`.nav-area-row`), with an icon/indicator + ellipsized label.

Alternatives considered:

- **Sibling element left of the link**: would create a dead click target (clicking the indicator does nothing).
- **Keep a button but make it no-op**: would still add focus stops and intercept default click/navigation behavior.

### Decision 3: Update selfTest to focus the row activator for keyboard reorder

Current selfTest flows focus `button.project-progress-control` to exercise keyboard reorder for projects.

With the Sidebar indicator becoming non-focusable/non-button, selfTest should instead:

- Focus the project row activator (`findSidebarProjectHandle(projectId)`), which is the `NavLink`.
- Trigger the same reorder chord (Cmd/Ctrl+Shift+ArrowUp/ArrowDown).

This aligns with how `handleSidebarKeyDown` already finds the owning row via `closest('[data-sidebar-dnd-kind][data-sidebar-dnd-id]')`.

### Decision 4: Sidebar indicator accessibility

The existing aria-label text is action-oriented ("Complete project…") and is appropriate for the interactive button surfaces.

For the Sidebar display-only indicator:

- Treat it as decorative and set `aria-hidden="true"`.
- The Sidebar link text remains the accessible name for the row.

If we later want Sidebar progress to be announced, we can introduce a non-action aria string (e.g. "Progress: 72%") and apply it to the link, but that is out of scope for this change.

## Risks / Trade-offs

- **Spec alignment**: Existing specs currently require the Sidebar progress control to be focusable and not nested in the link. This change updates those requirements.
- **Visual regressions at small sizes**: Adding a gap reduces the inner fill area. We must validate the list (28px) and header (32px) sizes visually to avoid muddiness.
- **Hover/focus interactions**: The existing hover rule changes border color. Done state requires an override so the border stays hidden.

## Migration Plan

1. Update delta specs for `project-progress-indicator` and `sidebar-project-area-dnd`.
2. Implement the CSS inner layer (`::before`) for the progress control across states.
3. Add a Sidebar-specific display-only indicator variant and update Sidebar row layout.
4. Update `src/app/selfTest.ts` selectors and reorder coverage to focus the project row activator.
5. Verify in-app behavior (manual) and run `npm run build`.

Rollback is a simple revert of the change.

## Open Questions

- Confirm the exact gap sizes (we will start with list=2px and header=3px as the default).
- Done state: keep existing box-shadow or remove it for a fully borderless/weightless appearance.
