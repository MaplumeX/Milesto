## Why

The project progress control is a high-frequency UI element across multiple surfaces, but its current visual and interaction details are suboptimal for clarity and navigation.

- The pie fill should start at 12 o'clock (matching the existing spec intent), but the current CSS rotation causes an off-by-90deg appearance.
- The fill currently touches the outer border, which makes the control feel visually heavy at small sizes and reduces legibility.
- In the Sidebar, the control's click behavior competes with navigation and drag-and-drop usage; we want the Sidebar indicator to be purely informational.

## What Changes

- Render the pie fill starting at 12 o'clock and filling clockwise.
- Add a background-colored gap ring between the outer border and the inner pie fill.
- Keep the gap ring in the done state, while keeping the outer border hidden (transparent) in the done style.
- Sidebar: move the indicator to the left of the project title and visually group it with the row, and make it display-only (no complete/reopen action from the Sidebar).
- Update the renderer self-test harness that currently relies on a focusable Sidebar progress button for keyboard reorder coverage.

- **BREAKING**: Sidebar progress indicator no longer provides a direct complete/reopen interaction.

## Capabilities

### New Capabilities

<!-- None. This change refines existing behavior and UI surfaces. -->

### Modified Capabilities

- `project-progress-indicator`: add a border-to-fill gap ring, clarify/ensure 12 o'clock fill start, and change the Sidebar surface to a display-only indicator.
- `sidebar-project-area-dnd`: relax the requirement that keyboard reorder depends on a focusable progress control; reorder remains available when focus is on the project row/link.

## Impact

- Renderer UI: `src/features/projects/ProjectProgressControl.tsx`, `src/index.css`, `src/app/AppShell.tsx`, and surfaces that render the control.
- Self-test harness: `src/app/selfTest.ts` selectors and keyboard reorder coverage.
- No backend API changes expected (progress counts and project complete/reopen APIs remain as-is).
