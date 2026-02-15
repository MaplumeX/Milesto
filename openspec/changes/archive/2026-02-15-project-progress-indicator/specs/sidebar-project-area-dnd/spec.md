## ADDED Requirements

### Requirement: Sidebar project rows support an additional progress control without breaking reordering
When rendering Projects in the Sidebar, the system SHALL render a separate focusable project progress control next to the project title.

The progress control SHALL NOT be nested inside the project title navigation link.

Keyboard reordering (Cmd/Ctrl+Shift+ArrowUp/ArrowDown) SHALL continue to work even when focus is on the progress control.

Pointer drag-and-drop for project rows SHALL continue to work as before.

#### Scenario: Progress control is a sibling of the project link
- **WHEN** the Sidebar renders a project row
- **THEN** the progress control is rendered as a sibling element of the project title link

#### Scenario: Keyboard reorder works when focus is on the progress control
- **WHEN** a Sidebar project row renders a focusable progress control
- **AND WHEN** the progress control has focus
- **WHEN** the user triggers the reorder keyboard shortcut (Cmd/Ctrl+Shift+ArrowUp/ArrowDown)
- **THEN** the owning Project row SHALL move up/down by one position within its group

#### Scenario: Drag-and-drop reorder remains available
- **WHEN** the Sidebar renders project rows with the progress control
- **AND WHEN** the user drags a Project row to reorder it
- **THEN** the Sidebar reorder behavior remains correct
