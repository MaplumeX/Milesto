## ADDED Requirements

### Requirement: Project task list selection includes section headers
On the Project page, the project tasks list (grouped by section) SHALL allow selection to move across both:

- Task rows
- Project section header rows (group headers)

Selection is a highlighted "current row" used for keyboard navigation and activation.

#### Scenario: Arrow keys navigate across task and section rows
- **WHEN** the user is on `/projects/:projectId`
- **AND** the project tasks listbox has focus
- **WHEN** the user presses `ArrowDown` or `ArrowUp`
- **THEN** the selected row SHALL move to the next/previous rendered row in the list
- **AND** the selected row MAY be either a task row or a section header row
- **AND** the list SHALL scroll as needed to keep the selected row visible

#### Scenario: First ArrowDown selects the first row
- **WHEN** the user is on `/projects/:projectId`
- **AND** the project tasks listbox has focus
- **AND** there is no currently selected row
- **WHEN** the user presses `ArrowDown`
- **THEN** the first rendered row in the list SHALL become selected

### Requirement: Selecting a section clears task selection
When a project section header row becomes selected, the system SHALL clear the selected task (if any).

#### Scenario: Click section header selects section and clears task selection
- **WHEN** the user clicks a project section header row
- **THEN** that section header row SHALL become the selected row
- **AND** the selected task (if any) SHALL become null
- **AND** the system SHALL NOT automatically enter section title edit mode

#### Scenario: Arrow navigation can select an empty section
- **WHEN** an empty project section group is rendered (a section exists with zero tasks)
- **AND** the project tasks listbox has focus
- **WHEN** the user navigates with `ArrowDown`/`ArrowUp`
- **THEN** the empty section header row SHALL be reachable as the selected row

### Requirement: Return enters section inline title editing
When a project section header row is selected, pressing `Return`/`Enter` SHALL enter inline title editing for that section.

If a task inline editor is currently open, the system MUST attempt to safely close it first by flushing pending changes.

#### Scenario: Return enters inline edit for selected section
- **WHEN** a project section header row is the selected row
- **AND** no task inline editor is currently open
- **WHEN** the user presses `Return`
- **THEN** the system SHALL enter inline title editing for that section
- **AND** the section title input SHALL receive focus

#### Scenario: Return closes open task editor before entering section edit
- **WHEN** a project section header row is the selected row
- **AND** a task inline editor is currently open
- **WHEN** the user presses `Return`
- **THEN** the system SHALL attempt to flush the open task editor's pending changes
- **AND** if flushing succeeds, the task inline editor SHALL close
- **AND** the system SHALL enter inline title editing for the selected section

#### Scenario: Flush failure prevents section edit and focuses the error target
- **WHEN** a project section header row is the selected row
- **AND** a task inline editor is currently open
- **AND** flushing pending changes for the open task editor fails
- **WHEN** the user presses `Return`
- **THEN** the system SHALL NOT enter section title edit mode
- **AND** the task editor SHALL remain open
- **AND** the system SHALL move focus to the task editor's last error target

### Requirement: Double-click enters section inline title editing
Double-clicking a project section header title area SHALL enter inline title editing for that section.

If a task inline editor is currently open, the system MUST attempt to safely close it first by flushing pending changes.

#### Scenario: Double-click enters inline edit for section
- **WHEN** the user double-clicks the title area of a project section header row
- **THEN** the system SHALL enter inline title editing for that section
