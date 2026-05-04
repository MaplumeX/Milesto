# Sidebar Resizable Width

## Goal

Allow users to drag the sidebar's right edge to resize the sidebar width, replacing the current hardcoded 280px width.

## Requirements

### Width Control

- Sidebar width is controlled by dragging the border-right divider between sidebar and content area
- No minimum width — user can drag the sidebar to completely hide it
- Maximum width: 40% of the current window width
- Default width: 280px (matches current hardcoded value)

### Hide / Reveal Behavior

- When the user releases the drag and the width is < 40px, the sidebar snaps to 0 (fully hidden) with a 0.2s ease animation
- When the sidebar is hidden, a 4px-wide invisible drag zone exists at the left edge of the window
- Dragging from the left edge reveals the sidebar; the width follows the pointer in real time (same as normal resize)
- When released in reveal mode, the same < 40px snap rule applies (snaps back to hidden if too narrow)

### Drag Handle

- Visual: the existing 1px `border-right` separator line — no additional visual element
- The clickable/draggable hot zone is transparent, extending a few pixels to the right of the separator into the content area (total ~6px effective hit area)
- On hover over the hot zone: cursor changes to `col-resize`; the separator line visually highlights (e.g., thicker or accent color)
- During drag: the separator line stays highlighted; sidebar width follows the pointer with no transition animation

### Double-Click to Reset

- Double-clicking the separator resets the sidebar width to the default 280px with a 0.2s ease transition

### Persistence

- Sidebar width is persisted alongside the existing `SidebarState` (which currently only stores `collapsedAreaIds`)
- The `SidebarState` type is extended to include a `width` field (number, in pixels)
- When `width` is 0, the sidebar is hidden
- On app launch, the persisted width is restored; if no width is persisted, default to 280px
- Width is saved after each drag completion (not during drag)

### Animation

- During drag: `transition: none` — width follows pointer immediately
- Snap to hidden (< 40px release): `transition: width 0.2s ease`
- Snap to default (double-click): `transition: width 0.2s ease`
- Reveal from hidden: no animation during drag; if released at < 40px, snap back animation

### Responsive Breakpoints

- Remove the existing `@media (max-width: 900px)` and `@media (max-width: 720px)` sidebar width rules
- Sidebar width is now fully user-controlled

### Keyboard Shortcuts

- No keyboard shortcut for toggling sidebar visibility; drag only

## Technical Notes

### Key Files to Modify

| File | Change |
|------|--------|
| `src/app/AppShell.tsx` | Add resize handle element, drag logic (pointerdown/move/up), width state, double-click handler |
| `src/index.css` | Remove hardcoded sidebar width, remove responsive breakpoints, add resize handle styles |
| `shared/window-api.ts` | Extend `SidebarState` type with `width` field |
| `electron/workers/db/actions/settings-actions.ts` | Persist/restore sidebar width in settings |
| `electron/preload.ts` | No change needed (already exposes sidebar state API) |

### Implementation Approach

- Use `useState` for sidebar width in `AppShell`
- On mount, load persisted width from `window.api.settings.getSidebarState()`
- After drag ends, persist via `window.api.settings.setSidebarState()`
- Use `pointerdown` / `pointermove` / `pointerup` events on the resize handle
- Set `user-select: none` on the body during drag to prevent text selection
- The resize handle is a positioned element overlaying the sidebar's right edge