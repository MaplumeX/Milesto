## ADDED Requirements

### Requirement: Project page supports drag-and-drop reordering of section headers
On the Project page tasks list, the system SHALL allow users to drag project section header rows to reorder section groups.

The ungrouped tasks area (`section_id = null`) SHALL NOT be treated as a draggable section header.

#### Scenario: User drags a section header to a new position
- **WHEN** the user drags a project section header row and drops it between other section headers
- **THEN** the section group order SHALL update to the dropped position
- **AND** all tasks that belong to the moved section SHALL remain in that section
- **AND** refreshing the Project page SHALL preserve the new section order

#### Scenario: Ungrouped area is not draggable as a section
- **WHEN** the user attempts to drag the ungrouped tasks area
- **THEN** the system SHALL NOT enter section-header drag mode

### Requirement: Section drag preview uses shadow-stacked edges without task thumbnails
When dragging a project section header row, the drag preview SHALL use a section-level overlay with shadow-stacked edges.

The preview SHALL NOT render real task-row thumbnails behind the section.

#### Scenario: Dragging a section with tasks shows stacked-shadow preview
- **WHEN** the dragged section contains one or more tasks
- **THEN** the drag preview SHALL display stacked shadow/edge depth behind the section header card
- **AND** the preview SHALL NOT render individual task-row content

#### Scenario: Reduced motion disables visible section drop animation
- **WHEN** the user has enabled reduced motion
- **AND** the user drops a dragged section header
- **THEN** the reorder SHALL complete correctly
- **AND** the drop transition SHALL be instant or effectively non-animated

### Requirement: Keyboard equivalent exists for section reordering on Project page
The system SHALL provide a keyboard-only interaction to reorder a selected section header row on the Project page.

#### Scenario: Keyboard move up/down reorders selected section
- **WHEN** the Project tasks list has focus
- **AND** a section header row is selected
- **WHEN** the user invokes the section reorder keyboard shortcut to move the section up or down by one position
- **THEN** the system SHALL reorder the section accordingly
- **AND** refreshing the Project page SHALL preserve the updated section order

## MODIFIED Requirements

### Requirement: Project page supports drag-and-drop reordering within a section
On the Project page tasks list, the system SHALL allow users to reorder open tasks within the same section via drag-and-drop, with a visible drag preview.

The drag preview SHALL use the same horizontal layout as the in-list task row being dragged to avoid a visible horizontal jump at drop.

Task drag behavior SHALL remain available after section-header drag-and-drop is enabled.

#### Scenario: User reorders a task within its section
- **WHEN** the user drags a task within the same project section
- **THEN** the system SHALL show a drag preview
- **AND** the drag preview SHALL match the in-list row layout (no visible horizontal jump)
- **AND** if reduced motion is not enabled, releasing the pointer SHALL animate the drag preview to its final position with a short ease-out drop animation
- **AND** releasing the pointer SHALL update the task order within that section
- **AND** the updated order SHALL persist after refresh

## REMOVED Requirements

### Requirement: Only tasks are draggable; section headers are not draggable
**Reason**: Project organization now requires direct section-level drag-and-drop reordering.
**Migration**: Use section header dragging (and its keyboard equivalent) to reorder sections; task dragging behavior remains unchanged.
