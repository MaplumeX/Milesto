## MODIFIED Requirements

### Requirement: Sidebar project rows support an additional progress control without breaking reordering
When rendering Projects in the Sidebar, the system SHALL render a project progress affordance next to the project title.

In this change, the Sidebar progress affordance SHALL be a display-only indicator:

- The indicator MUST NOT provide complete/reopen behavior.
- The indicator MAY be nested inside the project title navigation link.
- The indicator SHALL NOT be a separate focusable control.

Keyboard reordering (Cmd/Ctrl+Shift+ArrowUp/ArrowDown) SHALL continue to work when focus is on the project row link.

Pointer drag-and-drop for project rows SHALL continue to work as before.

#### Scenario: Sidebar project row renders a progress indicator inside the link
- **WHEN** the Sidebar renders a project row
- **THEN** the progress indicator is rendered to the left of the project title
- **AND THEN** the indicator is visually grouped with the row

#### Scenario: Keyboard reorder works when focus is on the project link
- **WHEN** a Sidebar project row renders the progress indicator
- **AND WHEN** the project title link has focus
- **WHEN** the user triggers the reorder keyboard shortcut (Cmd/Ctrl+Shift+ArrowUp/ArrowDown)
- **THEN** the owning Project row SHALL move up/down by one position within its group

#### Scenario: Drag-and-drop reorder remains available
- **WHEN** the Sidebar renders project rows with the progress indicator
- **AND WHEN** the user drags a Project row to reorder it
- **THEN** the Sidebar reorder behavior remains correct
