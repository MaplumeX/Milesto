## ADDED Requirements

### Requirement: Task title area is the drag activator for reordering
In supported task list views that enable drag-and-drop reordering, the system SHALL allow users to initiate pointer-based drag-and-drop reordering by dragging the task title area.

The system SHALL NOT require a dedicated visible drag handle control to initiate drag-and-drop reordering.

#### Scenario: User starts reorder drag from the task title
- **WHEN** the user presses on a task title area in a supported list view
- **AND** the user drags beyond the activation threshold
- **THEN** the system SHALL enter drag mode
- **AND** the system SHALL show a drag preview for the dragged task

## MODIFIED Requirements

### Requirement: Supported task list views allow drag-and-drop reordering with a drag preview
The system SHALL allow users to reorder tasks via drag-and-drop within these task list views:

- Inbox
- Anytime
- Someday
- Today
- Area

The system SHALL show a drag preview while dragging a task.

The drag preview SHALL use the same horizontal layout as the in-list task row being dragged to avoid a visible horizontal jump at drop.

#### Scenario: User drags a task to reorder within a list
- **WHEN** the user drags a task row within a supported list view
- **THEN** the system SHALL show a drag preview for the dragged task
- **AND** the drag preview SHALL match the in-list row layout (no visible horizontal jump)
- **AND** the system SHALL indicate the insertion position by live list reflow (neighboring items move to show the target slot)
- **AND** the system SHALL NOT render a separate insertion indicator line
- **AND** releasing the pointer SHALL reorder the task to the indicated position
- **AND** if reduced motion is not enabled, releasing the pointer SHALL animate the drag preview to its final position with a short ease-out drop animation
