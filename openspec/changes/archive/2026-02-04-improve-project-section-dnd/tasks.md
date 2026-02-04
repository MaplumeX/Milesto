## 1. Spec and Self-Test Alignment

- [x] 1.1 Review delta specs for `task-list-reordering` and `project-page` to confirm they reflect: no insertion line, no header highlight, and reflow-based insertion feedback
- [x] 1.2 Update `src/app/selfTest.ts` to remove assertions that depend on `.project-group-header.is-drop-over`
- [x] 1.3 Ensure self-test still verifies Project cross-section move correctness (section_id updated + persisted ordering)

## 2. Remove Explicit Visual Indicators

- [x] 2.1 Remove insertion-line styling for `data-drop-indicator` in `src/index.css`
- [x] 2.2 Remove `.project-group-header.is-drop-over` styling in `src/index.css`
- [x] 2.3 Remove `.project-no-section-dropzone[data-drop-over='true']::after` styling in `src/index.css`
- [x] 2.4 Remove dragged-row opacity styling `.task-row.is-dragging` in `src/index.css`
- [x] 2.5 Remove now-unused indicator plumbing from `src/features/tasks/TaskRow.tsx` (e.g., `dropIndicator`/`data-drop-indicator`) if no longer needed

## 3. TaskList: Reflow-Based Insertion (Inbox/Anytime/Someday/Today/Area)

- [x] 3.1 Replace `TaskList` drag-over insertion-line logic with reflow-based ordering updates during drag (update order state during drag, not only on drop)
- [x] 3.2 Ensure drag initiation remains handle-only and does not interfere with checkbox/editor interactions
- [x] 3.3 Confirm drag preview overlay remains visible with virtualization and the single scroll container

## 4. ProjectGroupedList: Cross-Section Reflow During Drag

- [x] 4.1 Introduce a drag-time draft ordering map for `openItemsByContainer` so that cross-section drag updates destination container items during drag
- [x] 4.2 Ensure within-section and cross-section drags produce the same reflow behavior (only list movement + overlay)
- [x] 4.3 Support empty-section drops without header highlight by rendering a visible insertion slot via reflow/placeholder behavior
- [x] 4.4 Ensure persistence semantics remain correct on drop (update `section_id` and reorder both containers as needed)

## 5. Verification

- [x] 5.1 Run `npx tsc -p tsconfig.json` and fix any new type errors
- [ ] 5.2 Manual smoke test: TaskList reordering (no line/highlight/opacity) works and persists
- [ ] 5.3 Manual smoke test: Project reorder within section and cross-section move (including empty section) works and persists
