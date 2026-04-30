# fix: stabilize project progress indicator rendering

## Goal

Replace the CSS-only project progress circle rendering with an SVG-based rendering path so the indicator stays visually centered and consistent on Windows, Linux, and macOS.

## What I Already Know

- The user selected the SVG rendering approach.
- The current project progress affordance is implemented in `ProjectProgressControl` and styled through `src/index.css`.
- The current visual fill uses an absolutely positioned pseudo-element with `inset: 1.5px` and `conic-gradient`, which can produce platform-specific anti-aliasing and subpixel offset differences.
- Existing tests cover progress state mapping, accessible labels, and terminal-state icons.

## Assumptions

- The public component API should remain unchanged.
- The control should keep the same list/header sizes and the same interactive behavior.
- The existing progress semantics should remain intact: empty, partial, full, done, and cancelled.

## Requirements

- Render the progress circle and pie fill with SVG coordinates instead of CSS `::before` plus `conic-gradient`.
- Preserve the 12 o'clock clockwise fill behavior for partial progress.
- Preserve the visible ring gap between the outer border and the fill.
- Preserve the fill's outer radius during progress changes; the animation must not make the filled circle appear to shrink or pulse.
- Preserve visual distinction between open 100% progress, done, and cancelled states.
- Preserve accessible labels for the interactive button variant.
- Preserve the non-focusable sidebar/display-only indicator variant.
- Keep reduced-motion behavior for progress angle transitions.

## Acceptance Criteria

- [ ] Open project with zero tasks renders an outlined empty circle.
- [ ] Partial progress renders as a centered SVG pie fill starting at 12 o'clock and filling clockwise.
- [ ] Progress changes do not animate by morphing between path shapes in a way that visually shrinks the fill.
- [ ] Open 100% progress renders as full progress without terminal-state icons.
- [ ] Done state renders a checkmark with done styling.
- [ ] Cancelled state renders an x with cancelled styling.
- [ ] Existing renderer tests pass, with updates covering SVG rendering where appropriate.
- [ ] Lint/type-check/build relevant to frontend passes.

## Definition of Done

- Tests added or updated at the renderer/component layer.
- Project lint/type-check/build is green for the changed frontend code.
- No unrelated refactors or style churn.
- Spec update considered after implementation.

## Out of Scope

- Changing project progress data calculation.
- Changing completion/reopen behavior.
- Redesigning the project row layout or colors beyond what SVG rendering requires.

## Technical Notes

- Relevant component: `src/features/projects/ProjectProgressControl.tsx`.
- Relevant styles: `src/index.css` `.project-progress-control`.
- Relevant tests: `tests/renderer/project-progress-control.test.tsx`.
- Relevant product spec: `openspec/specs/project-progress-indicator/spec.md`.
