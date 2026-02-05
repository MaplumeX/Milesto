## ADDED Requirements

### Requirement: Project page drag-and-drop drop animation respects reduced-motion preference
When the user has enabled reduced motion, the system SHALL disable (or reduce to effectively instant) the drag preview's drop animation on the Project page.

#### Scenario: Reduced motion disables drop animation on Project page
- **WHEN** the user has enabled reduced motion
- **AND** the user drags a task on the Project page
- **AND** the user releases the pointer to drop
- **THEN** the system SHALL complete the reorder or move
- **AND** the transition at drop SHALL NOT use a visible animated drop motion

## MODIFIED Requirements

### Requirement: Project page supports drag-and-drop reordering within a section
On the Project page tasks list, the system SHALL allow users to reorder open tasks within the same section via drag-and-drop, with a visible drag preview.

The drag preview SHALL use the same horizontal layout as the in-list task row being dragged (e.g. reserved space for the drag handle) to avoid a visible horizontal jump at drop.

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

The drag preview SHALL use the same horizontal layout as the in-list task row being dragged (e.g. reserved space for the drag handle) to avoid a visible horizontal jump at drop.

#### Scenario: User drags a task into a different section
- **WHEN** the user drags a task from one project section group to another
- **THEN** the system SHALL show a drag preview
- **AND** the drag preview SHALL match the in-list row layout (no visible horizontal jump)
- **AND** if reduced motion is not enabled, releasing the pointer SHALL animate the drag preview to its final position with a short ease-out drop animation
- **AND** releasing the pointer SHALL move the task into the destination section
- **AND** the task SHALL appear in the destination section group after refresh
