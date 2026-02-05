## ADDED Requirements

### Requirement: Project page uses task title area as the drag activator
On the Project page tasks list, the system SHALL allow users to initiate pointer-based drag-and-drop by dragging the task title area.

The system SHALL NOT require a dedicated visible drag handle control to initiate drag-and-drop.

#### Scenario: User starts Project drag from the task title
- **WHEN** the user presses on a task title area on the Project page
- **AND** the user drags beyond the activation threshold
- **THEN** the system SHALL enter drag mode
- **AND** the system SHALL show a drag preview

## MODIFIED Requirements

### Requirement: Project page supports drag-and-drop reordering within a section
On the Project page tasks list, the system SHALL allow users to reorder open tasks within the same section via drag-and-drop, with a visible drag preview.

The drag preview SHALL use the same horizontal layout as the in-list task row being dragged to avoid a visible horizontal jump at drop.

#### Scenario: User reorders a task within its section
- **WHEN** the user drags a task within the same project section
- **THEN** the system SHALL show a drag preview
- **AND** the drag preview SHALL match the in-list row layout (no visible horizontal jump)
- **AND** if reduced motion is not enabled, releasing the pointer SHALL animate the drag preview to its final position with a short ease-out drop animation
- **AND** releasing the pointer SHALL update the task order within that section
- **AND** the updated order SHALL persist after refresh

### Requirement: Project page supports moving tasks across sections via drag-and-drop
On the Project page tasks list, the system SHALL allow users to drag a task from one section group to another section group.

Dropping onto an empty section group SHALL be supported.

The drag preview SHALL use the same horizontal layout as the in-list task row being dragged to avoid a visible horizontal jump at drop.

#### Scenario: User drags a task into a different section
- **WHEN** the user drags a task from one project section group to another
- **THEN** the system SHALL show a drag preview
- **AND** the drag preview SHALL match the in-list row layout (no visible horizontal jump)
- **AND** if reduced motion is not enabled, releasing the pointer SHALL animate the drag preview to its final position with a short ease-out drop animation
- **AND** releasing the pointer SHALL move the task into the destination section
- **AND** the task SHALL appear in the destination section group after refresh
