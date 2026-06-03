# Area Drag Overlay: Show Area Bar Style with Collapse Animation

## Goal

Make the sidebar area entry drag overlay look similar to the normal (non-dragging) area entry, and animate the collapse of the area's projects when entering drag mode — so the user has a clear and familiar visual during drag.

## What I already know

* Current drag overlay for areas is a plain text label (`SidebarDragOverlay` lines 2131-2175 in AppShell.tsx)
* Normal area entry shows: Folder icon + title text + ChevronDown toggle button (`SortableSidebarAreaGroup` lines 1946-2129)
* Area collapse/expand state is maintained in `collapsedAreaIds` (line 189)
- Drag overlay CSS: `.sidebar-dnd-overlay` has min-width 180px, max-width 260px, padding, border-radius, background, shadow
- Project drag overlay already shows progress indicator + title (more similar to its non-drag form)
- Drop animation duration: 160ms with ease-out easing
- `isHiddenForOverlay` hides original row (visibility hidden) while drag overlay is active

## Assumptions (validated)

* The overlay matches the area header row but WITHOUT the ChevronDown toggle (not operable during drag)
* Collapse animation plays when drag starts; area reverts to its original expanded/collapsed state after drag ends
* Animation is fast (~150-200ms) to not delay drag interaction

## Open Questions

(none remaining)

## Requirements (evolving)

* Area drag overlay visually matches the non-dragging area header (Folder icon + title text, same height/styling)
* When drag starts, the projects under the area animate closed (collapse animation)
* After drag ends, the area returns to its original expanded/collapsed state
* Animation should be fast and not interfere with drag responsiveness

## Acceptance Criteria (evolving)

* [ ] Area drag overlay shows Folder icon + title (like normal area row)
* [ ] Projects animate closed when drag starts
* [ ] Area returns to original state after drag ends
* [ ] No layout jank or visual regressions during/after drag

## Definition of Done

* Lint / typecheck green
* No visual regressions in sidebar
* Test manually in dev mode

## Out of Scope (explicit)

* Project drag overlay changes (already reasonably styled)
* Drag overlay for top-level nav items (Inbox, Today, etc.)
* Changes to drop behavior or collision detection

## Technical Notes

* Key file: `src/app/AppShell.tsx` — all sidebar DnD logic is here
* `SidebarDragOverlay` component (lines 2131-2175): renders overlay content
* `SortableSidebarAreaGroup` (lines 1946-2129): normal area rendering
* `handleDragStart` (lines 1105-1126): sets `activeAreaId`, saves snapshot
* `handleDragEnd` (lines 1238-1331): persists final order
* CSS in `src/index.css` lines 1942-1959: overlay styles
* Drop animation: `src/features/tasks/dnd-drop-animation.ts`
