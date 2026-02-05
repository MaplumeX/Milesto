## Context

- Drag-and-drop is implemented in the renderer using `@dnd-kit/core` + `@dnd-kit/sortable` with a portal-mounted `DragOverlay`.
- Affected list views:
  - `src/features/tasks/TaskList.tsx` (single list)
  - `src/features/tasks/ProjectGroupedList.tsx` (grouped list with sections)
- Current behavior at pointer release feels unnatural for two user-visible reasons:
  1) The overlay is effectively removed immediately on `onDragEnd` by clearing `activeTaskId`, which causes the overlay to disappear and the original row to re-appear in the same render pass (snap/flash).
  2) The overlay content does not include the drag-handle column while the in-list row does, causing a horizontal jump at drop.
- UI motion guidance (`docs/ui.md`) recommends restrained motion and short durations (~120-200ms) with reduced-motion support.

## Goals / Non-Goals

**Goals:**

- Drop feels "fast and clean": on pointer release, the drag preview animates to its final position with a short ease-out animation (target ~160ms; keep within 200ms).
- No flash/snap at drop: avoid abrupt overlay unmount + row visibility flip in the same frame.
- No horizontal jump: overlay row layout matches the in-list row layout (including the handle column).
- Respect reduced-motion: if the user requests reduced motion, drop animation is disabled (or reduced to effectively instant).
- Keep persistence, sorting, collision detection, and virtualization architecture unchanged.

**Non-Goals:**

- Switching drag-and-drop libraries or introducing spring/physics-based motion.
- Changing the drag interaction model (sensors, activation constraints, collision strategy).
- Changing list ordering persistence semantics or any database/IPC behavior.

## Decisions

1) Configure `DragOverlay` drop animation explicitly (duration + easing)

- Use `DragOverlay`'s `dropAnimation` configuration to ensure a short ease-out drop animation.
- Rationale: the default `@dnd-kit` drop animation is longer (default duration is 250ms) and is currently not reliably perceived due to overlay unmount timing.
- Alternative: rely on defaults. Rejected because the current UX requires tighter control and alignment with `docs/ui.md`.

2) Keep `DragOverlay` mounted through drop animation

- Ensure `DragOverlay` is rendered consistently (not conditionally unmounted at drop), and delay clearing the local `activeTaskId` until the drop animation completes.
- Rationale: unmounting `DragOverlay` immediately prevents the drop animation from being visible and causes a snap/flash.
- Alternative: attempt to coordinate purely via CSS transitions on the original row. Rejected due to virtualization constraints and the existing overlay-based architecture.

3) Match overlay row layout to in-list row layout

- Render the overlay with the same `TaskRow` structure as the in-list draggable row, including a non-interactive drag-handle placeholder to preserve horizontal alignment.
- Rationale: the current overlay omits the handle column, producing a visible lateral jump when switching from overlay to in-list row at drop.
- Alternative: restructure `TaskRow` so the handle is always present. Rejected to avoid wider layout churn.

4) Respect reduced-motion using runtime preference detection

- Detect reduced motion (`prefers-reduced-motion: reduce`) and set `dropAnimation` to `null` (or a 0ms duration) when enabled.
- Rationale: `@dnd-kit` does not automatically apply reduced-motion preferences for drop animation; Milesto UI guidelines require reduced-motion support.
- Alternative: only use CSS media queries. Rejected because the drop animation is driven by Web Animations API configuration.

## Risks / Trade-offs

- [Delaying `activeTaskId` clear can extend `.task-dnd-overlay` visibility]  Mitigation: keep duration short (~160ms) and update `src/app/selfTest.ts` timeouts only if required.
- [Underlying list reorders while overlay is still animating]  Mitigation: use `defaultDropAnimationSideEffects` so the active node remains visually suppressed during the drop; keep overlay mounted until the animation is complete.
- [Timing drift (setTimeout vs actual animation completion)]  Mitigation: use a single source of truth for duration (shared constant used by both dropAnimation config and cleanup delay).
- [Accessibility/interaction conflicts]  Mitigation: overlay remains `pointer-events: none` and the handle placeholder is `aria-hidden` / non-focusable.

## Migration Plan

- No migration required. This is a renderer-only behavioral change.
- Rollback: revert the renderer changes to restore current behavior.

## Open Questions

- Should `TaskList`'s post-drop `scrollToIndex` be delayed until after the drop animation (to avoid perceived "tail" movement), or only run when the destination is outside the viewport?
- Do we want to tune `@dnd-kit/sortable` layout transition duration/easing to better match the 160ms drop animation, or keep defaults to minimize change surface?
