# task-list-reordering Specification

## Purpose
TBD - created by archiving change task-dnd. Update Purpose after archive.
## Requirements
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

### Requirement: Reordering persists per list context
When a user reorders tasks within a supported list view, the system SHALL persist that ordering for that list context.

Reordering in one list context SHALL NOT change the ordering in other list contexts.

#### Scenario: Reorder persists after refresh
- **WHEN** the user reorders tasks within Inbox
- **AND** the user refreshes the list view (navigation away and back, or data refresh)
- **THEN** the tasks in Inbox SHALL appear in the same order as last arranged

#### Scenario: Reordering does not affect other views
- **WHEN** the user reorders tasks within Anytime
- **THEN** the order of the same tasks in Project or Today (if present) SHALL remain unchanged

### Requirement: Drag preview is not clipped by scrolling containers
The drag preview SHALL remain visible while dragging even if the list is within a scroll container and even if list rows are virtualized.

#### Scenario: Drag preview remains visible while scrolling
- **WHEN** the user is dragging a task
- **AND** the user scrolls the main content area during the drag
- **THEN** the drag preview SHALL remain visible and track the pointer

### Requirement: Drag interactions do not interfere with existing row controls
Drag initiation SHALL NOT occur from controls intended for other actions (e.g. the completion checkbox or text inputs).

#### Scenario: Clicking the checkbox does not start a drag
- **WHEN** the user clicks the completion checkbox of a task row
- **THEN** the system SHALL toggle completion
- **AND** the system SHALL NOT enter drag mode

### Requirement: Keyboard equivalent exists for reordering in supported lists
The system SHALL provide a keyboard-only interaction to reorder tasks within a supported list view.

#### Scenario: Keyboard move up/down reorders the selected task
- **WHEN** a supported list view has focus
- **AND** a task row is selected
- **WHEN** the user invokes the reorder keyboard shortcut to move the task up or down by one position
- **THEN** the system SHALL reorder the task accordingly
- **AND** the system SHALL persist the updated order for that list context
- **AND** the system SHALL keep the selected task visible by scrolling as needed

### Requirement: Reordering respects the single-scroll-container constraint
Task list views MUST continue to use a single main scroll container for content scrolling.

#### Scenario: Drag-and-drop does not introduce a nested scroll container
- **WHEN** drag-and-drop reordering is enabled in a supported list view
- **THEN** the task list SHALL NOT introduce a secondary scroll container

