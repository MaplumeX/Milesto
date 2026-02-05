## ADDED Requirements

### Requirement: Drag-and-drop drop animation respects reduced-motion preference
When the user has enabled reduced motion, the system SHALL disable (or reduce to effectively instant) the drag preview's drop animation.

#### Scenario: Reduced motion disables drop animation
- **WHEN** the user has enabled reduced motion
- **AND** the user drags a task row within a supported list view
- **AND** the user releases the pointer to drop
- **THEN** the system SHALL reorder the task to the indicated position
- **AND** the transition at drop SHALL NOT use a visible animated drop motion

## MODIFIED Requirements

### Requirement: Supported task list views allow drag-and-drop reordering with a drag preview
The system SHALL allow users to reorder tasks via drag-and-drop within these task list views:

- Inbox
- Anytime
- Someday
- Today
- Area

The system SHALL show a drag preview while dragging a task.

The drag preview SHALL use the same horizontal layout as the in-list task row being dragged (e.g. reserved space for the drag handle) to avoid a visible horizontal jump at drop.

#### Scenario: User drags a task to reorder within a list
- **WHEN** the user drags a task row within a supported list view
- **THEN** the system SHALL show a drag preview for the dragged task
- **AND** the drag preview SHALL match the in-list row layout (no visible horizontal jump)
- **AND** the system SHALL indicate the insertion position by live list reflow (neighboring items move to show the target slot)
- **AND** the system SHALL NOT render a separate insertion indicator line
- **AND** releasing the pointer SHALL reorder the task to the indicated position
- **AND** if reduced motion is not enabled, releasing the pointer SHALL animate the drag preview to its final position with a short ease-out drop animation
