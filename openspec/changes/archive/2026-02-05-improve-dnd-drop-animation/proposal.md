## Why

Drag-and-drop reordering currently ends with a noticeable snap/flash and a horizontal "jump" when the pointer is released. This feels visually broken and inconsistent with Milesto's minimal, keyboard-first interaction quality bar.

## What Changes

- Make the drag preview (DragOverlay) complete a short drop animation on pointer release instead of disappearing immediately.
- Ensure the drag preview uses the same row layout as the in-list row (no horizontal shift due to missing drag-handle column).
- Respect reduced-motion preferences by disabling or shortening the drop animation when the user requests reduced motion.
- Keep changes scoped to renderer drag-and-drop behavior; no new dependencies and no changes to persistence semantics.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `task-list-reordering`: Drag preview drop behavior is updated to avoid snap/flash and horizontal jump on release; reduced-motion is respected.
- `project-page`: Project drag-and-drop (within-section reorder and cross-section move) drop behavior is updated to avoid snap/flash and horizontal jump on release; reduced-motion is respected.

## Impact

- Renderer components: `src/features/tasks/TaskList.tsx`, `src/features/tasks/ProjectGroupedList.tsx`, `src/features/tasks/TaskRow.tsx`
- Styles: `src/index.css` (may add/adjust overlay/row layout alignment and reduced-motion behavior)
- Self-test expectations around `.task-dnd-overlay` visibility timing: `src/app/selfTest.ts`
- Libraries/APIs: `@dnd-kit/core` `DragOverlay` `dropAnimation` and `defaultDropAnimationSideEffects` (no new dependencies)
