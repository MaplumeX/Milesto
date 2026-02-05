## Why

Task rows currently show a dedicated drag handle (grip). This adds visual clutter and consumes horizontal space in dense lists. Making the task title area the drag activator preserves reordering while simplifying the row UI.

## What Changes

- Remove the visible per-row drag handle UI in supported sortable task lists.
- Change drag activation from a dedicated handle to the task title button/area.
- Keep the existing safety boundary: drag initiation must not occur from other controls (e.g. completion checkbox, inline editors).
- Update drag preview (DragOverlay) layout to match the in-list row without requiring a handle placeholder.
- Update self-test automation that currently targets `.task-dnd-handle`.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `task-list-reordering`: drag activation area changes (title becomes activator); row layout no longer reserves space for a visible handle.
- `project-page`: same change for Project task lists (within/cross-section reorder UX and overlay layout).

## Impact

- Renderer: `src/features/tasks/TaskList.tsx`, `src/features/tasks/ProjectGroupedList.tsx`, `src/features/tasks/TaskRow.tsx`
- Styles: `src/index.css` (handle styles removed; title activator styling likely scoped to DnD-enabled lists)
- Self-test: `src/app/selfTest.ts` selectors and drag helpers
- No new dependencies; remains on `@dnd-kit/*`.
