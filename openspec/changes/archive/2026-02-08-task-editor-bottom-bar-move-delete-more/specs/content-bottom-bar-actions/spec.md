## MODIFIED Requirements

### Requirement: Content bottom bar provides Schedule / Move / Search actions
When no task editor is open, the global content bottom bar SHALL provide three buttons:

- `Schedule`
- `Move`
- `Search`

#### Scenario: Actions are visible when no task editor is open
- **WHEN** no task editor is currently open
- **THEN** the content bottom bar displays the `Schedule`, `Move`, and `Search` buttons

#### Scenario: List-mode Schedule and Search are hidden when a task editor is open
- **WHEN** a task editor is currently open
- **THEN** the content bottom bar MUST NOT display the `Schedule` button
- **AND** the content bottom bar MUST NOT display the `Search` button

### Requirement: Schedule and Move are enabled only when a task is selected
When no task editor is currently open, the `Schedule` and `Move` buttons MUST be disabled when there is no selected task.

When a task editor is currently open, the edit-mode `Move` button MUST be enabled because it targets the open task.

#### Scenario: No selected task disables Schedule and Move in list mode
- **WHEN** no task editor is currently open
- **AND** there is no selected task
- **THEN** the `Schedule` button is disabled
- **AND** the `Move` button is disabled

#### Scenario: Selected task enables Schedule and Move in list mode
- **WHEN** no task editor is currently open
- **AND** a task is selected
- **THEN** the `Schedule` button is enabled
- **AND** the `Move` button is enabled

#### Scenario: Edit-mode Move is enabled when a task editor is open
- **WHEN** a task editor is currently open
- **THEN** the `Move` button is enabled

### Requirement: Move popover moves the selected task to an Area or a Project
The move popover SHALL allow moving a task to either:

- a target Area, or
- a target Project

Section selection MUST NOT be part of this change.

Moving MUST clear the task's `section_id`.

Move semantics:
- Move to Area: set `area_id=<targetAreaId>`, set `project_id=null`, set `section_id=null`
- Move to Project: set `project_id=<targetProjectId>`, set `area_id=null`, set `section_id=null`

In list mode (no task editor open), `Move` targets the selected task.

In edit mode (task editor open), `Move` targets the open task.

#### Scenario: List-mode Move to Area clears project and section
- **WHEN** no task editor is currently open
- **AND** the move popover is open
- **AND** the user selects an Area destination
- **THEN** the selected task is persisted with `area_id=<targetAreaId>`
- **AND** the selected task is persisted with `project_id=null`
- **AND** the selected task is persisted with `section_id=null`

#### Scenario: List-mode Move to Project clears area and section
- **WHEN** no task editor is currently open
- **AND** the move popover is open
- **AND** the user selects a Project destination
- **THEN** the selected task is persisted with `project_id=<targetProjectId>`
- **AND** the selected task is persisted with `area_id=null`
- **AND** the selected task is persisted with `section_id=null`

#### Scenario: Edit-mode Move to Area clears project and section
- **WHEN** a task editor is currently open
- **AND** the move popover is open
- **AND** the user selects an Area destination
- **THEN** the open task is persisted with `area_id=<targetAreaId>`
- **AND** the open task is persisted with `project_id=null`
- **AND** the open task is persisted with `section_id=null`

#### Scenario: Edit-mode Move to Project clears area and section
- **WHEN** a task editor is currently open
- **AND** the move popover is open
- **AND** the user selects a Project destination
- **THEN** the open task is persisted with `project_id=<targetProjectId>`
- **AND** the open task is persisted with `area_id=null`
- **AND** the open task is persisted with `section_id=null`

## ADDED Requirements

### Requirement: Edit-mode content bottom bar provides Move / Delete / More actions
When a task editor is currently open, the content bottom bar SHALL display exactly three actions:

- `Move`
- `Delete`
- `More`

While a task editor is open, the content bottom bar MUST NOT display other bottom bar actions (e.g. `+ Task`, `+ Section`, `Schedule`, `Search`).

#### Scenario: Edit-mode action set replaces the bottom bar actions
- **WHEN** a task editor is currently open
- **THEN** the content bottom bar displays `Move`, `Delete`, and `More`
- **AND** the content bottom bar MUST NOT display `+ Task`
- **AND** the content bottom bar MUST NOT display `+ Section`
- **AND** the content bottom bar MUST NOT display `Schedule`
- **AND** the content bottom bar MUST NOT display `Search`

### Requirement: More is a placeholder action
The `More` action SHALL be reserved for future work.
Clicking `More` MUST NOT open a menu in this change.

#### Scenario: Clicking More does not open UI
- **WHEN** a task editor is currently open
- **AND** the user clicks `More`
- **THEN** no additional menu or dialog becomes visible
