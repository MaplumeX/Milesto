## MODIFIED Requirements

### Requirement: Supported task list views allow drag-and-drop reordering with a drag preview
The system SHALL allow users to reorder tasks via drag-and-drop within these task list views:

- Inbox
- Anytime
- Someday
- Today
- Area

The system SHALL show a drag preview while dragging a task.

#### Scenario: User drags a task to reorder within a list
- **WHEN** the user drags a task row within a supported list view
- **THEN** the system SHALL show a drag preview for the dragged task
- **AND** the system SHALL indicate the insertion position by live list reflow (neighboring items move to show the target slot)
- **AND** the system SHALL NOT render a separate insertion indicator line
- **AND** releasing the pointer SHALL reorder the task to the indicated position
