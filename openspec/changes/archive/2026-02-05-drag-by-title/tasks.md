## 1. TaskRow Title Activator Wiring

- [x] 1.1 Extend `src/features/tasks/TaskRow.tsx` API to allow passing an activator ref and props to the title button (without affecting non-DnD usages)
- [x] 1.2 Ensure the title button wiring preserves existing click (select) and double-click (open) behavior

## 2. TaskList (Single List) DnD Activator Migration

- [x] 2.1 Update `src/features/tasks/TaskList.tsx` to bind `setActivatorNodeRef` + `listeners` + `attributes` to the TaskRow title activator (remove `.task-dnd-handle` injection)
- [x] 2.2 Preserve “select on drag start” behavior by moving the `onPointerDown` selection hook onto the title activator
- [x] 2.3 Update `DragOverlay` row rendering to remove the drag-handle placeholder column and keep layout stable

## 3. ProjectGroupedList (Project Page) DnD Activator Migration

- [x] 3.1 Update `src/features/tasks/ProjectGroupedList.tsx` to bind `setActivatorNodeRef` + `listeners` + `attributes` to the TaskRow title activator (remove `.task-dnd-handle` injection)
- [x] 3.2 Preserve “select on drag start” behavior by moving the `onPointerDown` selection hook onto the title activator
- [x] 3.3 Update Project `DragOverlay` row rendering to remove the drag-handle placeholder column and keep layout stable

## 4. Styling Cleanup and Affordance

- [x] 4.1 Remove unused handle styles from `src/index.css` (`.task-dnd-handle`, `.task-dnd-grip`, `.task-dnd-handle-placeholder`) after migration
- [x] 4.2 Add a scoped drag affordance (e.g. `cursor: grab` on the title) that only applies in DnD-enabled lists (avoid affecting Upcoming/other non-DnD views)

## 5. Self-Test Updates

- [x] 5.1 Update `src/app/selfTest.ts` drag helpers to locate and drag from the title activator instead of `.task-dnd-handle`
- [x] 5.2 Update self-test assertions that rely on `.task-dnd-handle` presence/absence in views where DnD is disabled

## 6. Verification

- [x] 6.1 Manual smoke: verify click-to-select, double-click-to-open, checkbox toggle, and drag-to-reorder in TaskList and Project page
- [x] 6.2 Verify drag does not start from checkbox/inputs; tune `activationConstraint.distance` only if accidental drags are observed
- [x] 6.3 Run `npx tsc -p tsconfig.json` and `npm run build` to ensure typecheck and build succeed
