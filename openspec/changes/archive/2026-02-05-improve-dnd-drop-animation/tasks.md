## 1. Define Drop Animation Behavior

- [x] 1.1 Define a single drop animation config (target ~160ms, `ease-out`) using `@dnd-kit/core` `dropAnimation` + `defaultDropAnimationSideEffects`
- [x] 1.2 Add reduced-motion detection for drop animation (`prefers-reduced-motion: reduce`) and decide behavior (`dropAnimation: null` vs 0ms)

## 2. TaskList: Remove Snap/Flash on Drop

- [x] 2.1 Update `src/features/tasks/TaskList.tsx` to keep `DragOverlay` mounted (do not conditionally unmount on drop)
- [x] 2.2 Delay clearing `activeTaskId` until after the drop animation completes; ensure `onDragCancel` clears immediately
- [x] 2.3 Make the overlay row layout match the in-list draggable row by providing a non-interactive drag-handle placeholder (prevents horizontal jump)
- [x] 2.4 Evaluate `rowVirtualizer.scrollToIndex` timing on drop; if it contributes to perceived end-jank, delay until after drop animation or only scroll when needed

## 3. ProjectGroupedList: Remove Snap/Flash on Drop

- [x] 3.1 Update `src/features/tasks/ProjectGroupedList.tsx` to keep `DragOverlay` mounted and apply the shared dropAnimation config
- [x] 3.2 Delay clearing `activeTaskId` until after the drop animation completes; keep snapshot rollback semantics unchanged on error
- [x] 3.3 Make the overlay row layout match the in-list draggable row by providing a non-interactive drag-handle placeholder (prevents horizontal jump)

## 4. Styling and Reduced Motion

- [x] 4.1 Add/adjust CSS in `src/index.css` for the overlay handle placeholder (invisible but reserves space; non-interactive)
- [x] 4.2 Verify reduced-motion behavior: drop animation disabled/instant while preserving correct drop semantics

## 5. Verification

- [x] 5.1 Run/adjust `src/app/selfTest.ts` drag expectations if needed (overlay may remain visible briefly after mouseup)
- [x] 5.2 Manual verification: TaskList + ProjectGroupedList drops feel fast/clean; no flash/snap; no horizontal jump
- [x] 5.3 Run `npx tsc -p tsconfig.json` and `npm run build` to ensure typecheck/build pass
