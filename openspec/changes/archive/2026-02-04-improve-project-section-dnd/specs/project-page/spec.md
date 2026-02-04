## MODIFIED Requirements

### Requirement: Project page supports moving tasks across sections via drag-and-drop
On the Project page tasks list, the system SHALL allow users to drag a task from one section group to another section group.

Dropping onto an empty section group SHALL be supported.

#### Scenario: User drags a task into a different section
- **WHEN** the user drags a task from one project section group to another
- **THEN** releasing the pointer SHALL move the task into the destination section
- **AND** the task SHALL appear in the destination section group after refresh

#### Scenario: User drops into an empty section
- **WHEN** a project section group is empty
- **AND** the user drags a task over that empty section group
- **THEN** the UI SHALL indicate that dropping is allowed by showing the same insertion feedback used for non-empty sections (list reflow / placeholder slot)
- **AND** the UI SHALL NOT rely on section header highlight to provide this feedback
- **AND** releasing the pointer SHALL move the task into that empty section

## ADDED Requirements

### Requirement: Project drag-and-drop insertion feedback is reflow-based and consistent across sections
On the Project page, drag-and-drop sorting and cross-section moves SHALL use the same insertion feedback: live list reflow that makes the insertion slot clear.

The system SHALL NOT render a separate insertion indicator line.

#### Scenario: Cross-section drag shows list reflow in destination section
- **WHEN** the user drags a task from one section towards another section
- **THEN** the destination section's task list SHALL reflow during the drag to show the intended insertion slot

#### Scenario: Within-section drag shows list reflow without an insertion line
- **WHEN** the user drags a task within a project section
- **THEN** the task list within that section SHALL reflow during the drag to show the intended insertion slot
- **AND** the UI SHALL NOT render a separate insertion indicator line
