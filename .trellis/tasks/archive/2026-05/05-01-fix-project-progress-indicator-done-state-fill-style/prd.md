# Fix Project Progress Indicator Done State Fill Style

## Problem
When a project is marked as done, the progress indicator only fills the inner SVG circle area, leaving a visible ring (the container's border area) unfilled. The expected behavior is that the entire circle should be filled.

## Root Cause
The `.project-progress-control.is-done` class sets `background: transparent`. The fill is rendered only by the inner SVG `<circle>` element, which is inset from the container edge by `--ppc-gap` (1.5px or 2px). This creates the appearance of an unfilled outer ring.

## Solution
Change the `background` property of `.project-progress-control.is-done` from `transparent` to the fill color (`var(--ppc-color)` for default, `var(--text)` for sidebar), so the entire circular area is filled.

## Files to Modify
- `src/index.css` — update `.project-progress-control.is-done` and `.sidebar .project-progress-control.is-done` background styles

## Verification
- Run `npm run lint` to ensure no CSS issues
- Visual check: completed project indicators should show a fully filled circle with the checkmark icon on top
