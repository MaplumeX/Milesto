# content-bottom-bar-actions Specification

## Purpose
TBD - created by archiving change enhance-content-bottom-bar-actions. Update Purpose after archive.
## Requirements
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

### Requirement: Schedule button opens an anchored schedule popover
Clicking `Schedule` SHALL open an anchored popover at the `Schedule` button.

The schedule popover MUST:
- be dismissible via `Escape`
- be dismissible via click/tap outside
- close on selection of a schedule option
- restore focus to the `Schedule` button on close

#### Scenario: Clicking Schedule opens an anchored popover
- **WHEN** a task is selected
- **AND** the user clicks the `Schedule` button
- **THEN** a schedule popover becomes visible
- **AND** the popover is positioned relative to the `Schedule` button

#### Scenario: Escape closes the schedule popover and restores focus
- **WHEN** the schedule popover is open
- **WHEN** the user presses `Escape`
- **THEN** the schedule popover closes
- **AND** focus returns to the `Schedule` button

### Requirement: Schedule popover edits the selected task schedule state
The schedule popover SHALL allow setting the selected task schedule state to one of:

- `None` (no scheduled date and not Someday)
- `Someday`
- a concrete scheduled date

#### Scenario: Choosing Someday sets Someday schedule state
- **WHEN** the schedule popover is open
- **AND** the user chooses `Someday`
- **THEN** the selected task is persisted with `is_someday=true`
- **AND** the selected task is persisted with `scheduled_at=null`

#### Scenario: Choosing a date sets a concrete scheduled date
- **WHEN** the schedule popover is open
- **AND** the user chooses a date
- **THEN** the selected task is persisted with `scheduled_at=<date>`
- **AND** the selected task is persisted with `is_someday=false`

#### Scenario: Choosing None clears scheduling
- **WHEN** the schedule popover is open
- **AND** the user chooses `None`
- **THEN** the selected task is persisted with `scheduled_at=null`
- **AND** the selected task is persisted with `is_someday=false`

### Requirement: Move button opens an anchored move popover
Clicking `Move` SHALL open an anchored popover at the `Move` button.

The move popover MUST:
- offer destinations grouped by `Areas` and `Projects`
- be dismissible via `Escape`
- be dismissible via click/tap outside
- close after a destination is selected
- restore focus to the `Move` button on close

#### Scenario: Clicking Move opens an anchored popover
- **WHEN** a task is selected
- **AND** the user clicks the `Move` button
- **THEN** a move popover becomes visible
- **AND** the popover is positioned relative to the `Move` button

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

### Requirement: Search button opens the floating search overlay
Clicking `Search` SHALL open the centered floating search overlay (SearchPanel) and focus the search input.

#### Scenario: Clicking Search opens the overlay and focuses input
- **WHEN** no task editor is currently open
- **AND** the user clicks the `Search` button
- **THEN** the floating search overlay becomes visible
- **AND** the search input receives focus

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

### Requirement: Schedule Today uses the current local today date
When the user uses the content bottom bar `Schedule` action and selects `Today`, the system SHALL set the selected task's schedule date to the current local date at the time of the action.

The system MUST NOT compute the `today` date once at application or component mount and reuse it across a local date rollover.

#### Scenario: Today action after midnight schedules to the new day
- **WHEN** the app has been open across a local midnight boundary
- **AND** the user opens the content bottom bar schedule popover
- **AND** the user selects `Today`
- **THEN** the selected task is persisted with `scheduled_at=<current local date>`

