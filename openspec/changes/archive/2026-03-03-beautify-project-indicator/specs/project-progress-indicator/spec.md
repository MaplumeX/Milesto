## ADDED Requirements

### Requirement: Progress pie fill updates animate smoothly and respect reduced motion
When the derived progress (`done_count / total_count`) changes for an open project, the UI SHALL animate the pie fill angle change with a short ease-out transition.

The animation duration SHALL be between 120ms and 200ms.

If the user has enabled reduced motion (`prefers-reduced-motion: reduce`), the UI SHALL update the fill without animation.

#### Scenario: Progress updates animate by default
- **WHEN** a project has `status = open`
- **AND WHEN** the rendered progress pie changes from one non-zero value to another (e.g., 20% -> 40%)
- **AND WHEN** `prefers-reduced-motion` is not `reduce`
- **THEN** the progress pie fill updates with a smooth animated sweep (not a snap)
- **AND THEN** the animation completes within 120ms to 200ms

#### Scenario: Reduced motion disables progress animation
- **WHEN** a project has `status = open`
- **AND WHEN** the rendered progress pie changes
- **AND WHEN** `prefers-reduced-motion: reduce` is active
- **THEN** the progress pie fill updates without animation
