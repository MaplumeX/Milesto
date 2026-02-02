## 1. Project Setup

- [x] 1.1 Add `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` dependencies (and update lockfile)
- [x] 1.2 Add minimal shared DnD helpers for list ids (e.g. `inbox`, `anytime`, `someday`, `today`, `area:<id>`, `project:<projectId>:<sectionId|none>`)
- [x] 1.3 Add CSS/UI styles for dragging state, placeholder row, drop indicator, and drag preview overlay

## 2. DB Ordering Support

- [x] 2.1 Update `task.listInbox` to join `list_positions` (list_id=`inbox`) and order by rank-first then created_at
- [x] 2.2 Update `task.listAnytime` to join `list_positions` (list_id=`anytime`) and order by rank-first then created_at
- [x] 2.3 Update `task.listSomeday` to join `list_positions` (list_id=`someday`) and order by rank-first then created_at
- [x] 2.4 Update `task.listArea` to join `list_positions` (list_id=`area:<areaId>`) and order by rank-first then created_at
- [x] 2.5 Update `task.listProject` to ensure rank-first ordering matches `project:<projectId>:<sectionId|none>` list ids

## 3. TaskList Drag-and-Drop (Inbox/Anytime/Someday/Today/Area)

- [x] 3.1 Implement a presentational TaskRow component that can be rendered both in-list and inside `DragOverlay` (no `useDraggable` usage inside overlay)
- [x] 3.2 Integrate `DndContext` + `SortableContext` into `src/features/tasks/TaskList.tsx` while preserving virtualized layout
- [x] 3.3 Ensure transform separation: virtualizer `translateY` stays on the outer row wrapper; dnd-kit transform applies to an inner wrapper
- [x] 3.4 Implement drag activation constraints and disallow drag start from checkbox and inline editor inputs
- [x] 3.5 On drag end, compute the new ordering and call `window.api.task.reorderBatch(listId, orderedTaskIds)`; refresh list data
- [x] 3.6 Add `DragOverlay` preview (portal to `document.body`) and a clear drop indicator

## 4. ProjectGroupedList Drag-and-Drop (Cross-Section)

- [x] 4.1 Identify draggable rows (tasks only) and define droppable targets for sections (including empty sections)
- [x] 4.2 Implement per-section sortable containers using `@dnd-kit/sortable` (multiple containers) without breaking section header selection behavior
- [x] 4.3 Support reordering within a section and persist with `reorderBatch(project:<projectId>:<sectionId>, orderedTaskIds)`
- [x] 4.4 Support moving tasks across sections:
  - persist `task.update({ id, section_id: <dest|null> })`
  - persist ordering for both source and destination list ids via `reorderBatch`
- [x] 4.5 Ensure dropping into an empty section works (visible indication + successful move)

## 5. Keyboard Equivalent

- [x] 5.1 Define and implement a keyboard shortcut for reorder that does not conflict with Space/Enter (candidate: `Cmd/Ctrl+Shift+ArrowUp/ArrowDown`)
- [x] 5.2 Implement keyboard reorder in `TaskList` (move selected task by one position; persist with `reorderBatch`)
- [x] 5.3 Implement keyboard reorder on Project page within the selected task's current section (persist with `reorderBatch`)

## 6. Verification

- [x] 6.1 Run `npx tsc -p tsconfig.json` and fix any type errors
- [x] 6.2 Manual smoke test in the app:
  - Inbox/Anytime/Someday/Today/Area: drag reorder shows preview and persists after refresh
  - Project: reorder within section and move across sections (including empty section), with preview and persistence
  - Upcoming/Logbook/Search: no drag reorder affordance
  - Keyboard reorder shortcut works and does not break existing Arrow/Enter/Space behaviors
  - No nested scroll container is introduced in task list views
