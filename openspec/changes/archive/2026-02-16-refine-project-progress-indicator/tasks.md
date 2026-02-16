## 1. Progress Control Visuals (12 o'clock start + gap ring)

- [x] 1.1 Update `src/index.css` so `.project-progress-control` renders its fill on an inset inner layer (`::before`) to create a border-to-fill gap ring
- [x] 1.2 Define size-based gap variables (list vs header) and validate the gap renders as background (empty ring) on all supported surfaces
- [x] 1.3 Remove the `from -90deg` rotation so partial progress starts at 12 o'clock and fills clockwise
- [x] 1.4 Ensure `done` style keeps the gap ring while hiding the outer border (transparent) and does not reintroduce a visible border on hover

## 2. Sidebar Display-Only Indicator (left of title, no complete/reopen)

- [x] 2.1 Add a Sidebar-friendly display-only progress indicator variant that reuses progress calculation but does not render an interactive button
- [x] 2.2 Update `src/app/AppShell.tsx` Sidebar project rows to render the indicator on the left, visually grouped with the title (inside the project link), and remove Sidebar complete/reopen wiring
- [x] 2.3 Update Sidebar CSS (`.nav-project-row`) to lay out indicator + label like `.nav-area-row` and preserve truncation, hover, and active styling

## 3. Self-Test & Verification

- [x] 3.1 Update `src/app/selfTest.ts` to stop relying on a focusable Sidebar `button.project-progress-control` for keyboard reorder coverage (focus the project row activator/link instead)
- [x] 3.2 Manually verify: Sidebar navigation clicks, drag-and-drop reorder, keyboard reorder chord, and progress visuals on Project header + Area list + Logbook list
- [x] 3.3 Run `npm run build` and address any failures introduced by this change
