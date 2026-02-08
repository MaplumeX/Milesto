# content-bottom-bar-actions Specification

## Purpose
TBD - created by archiving change enhance-content-bottom-bar-actions. Update Purpose after archive.
## Requirements
### Requirement: Content bottom bar provides Schedule / Move / Search actions
When no task editor is open, the global content bottom bar SHALL provide an action group with three buttons:

- `Schedule`
- `Move`
- `Search`

#### Scenario: Action group is visible when no task editor is open
- **WHEN** no task editor is currently open
- **THEN** the content bottom bar displays the `Schedule`, `Move`, and `Search` buttons

#### Scenario: Action group is hidden when a task editor is open
- **WHEN** a task editor is currently open
- **THEN** the content bottom bar MUST NOT display the `Schedule`, `Move`, and `Search` buttons

### Requirement: Schedule and Move are enabled only when a task is selected
The `Schedule` and `Move` buttons MUST be disabled when there is no selected task.

#### Scenario: No selected task disables Schedule and Move
- **WHEN** there is no selected task
- **THEN** the `Schedule` button is disabled
- **AND** the `Move` button is disabled

#### Scenario: Selected task enables Schedule and Move
- **WHEN** a task is selected
- **THEN** the `Schedule` button is enabled
- **AND** the `Move` button is enabled

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
The move popover SHALL allow moving the selected task to either:

- a target Area, or
- a target Project

Section selection MUST NOT be part of this change.

Moving MUST clear the task's `section_id`.

Move semantics:
- Move to Area: set `area_id=<targetAreaId>`, set `project_id=null`, set `section_id=null`
- Move to Project: set `project_id=<targetProjectId>`, set `area_id=null`, set `section_id=null`

#### Scenario: Move to Area clears project and section
- **WHEN** the move popover is open
- **AND** the user selects an Area destination
- **THEN** the selected task is persisted with `area_id=<targetAreaId>`
- **AND** the selected task is persisted with `project_id=null`
- **AND** the selected task is persisted with `section_id=null`

#### Scenario: Move to Project clears area and section
- **WHEN** the move popover is open
- **AND** the user selects a Project destination
- **THEN** the selected task is persisted with `project_id=<targetProjectId>`
- **AND** the selected task is persisted with `area_id=null`
- **AND** the selected task is persisted with `section_id=null`

### Requirement: Search button opens the floating search overlay
Clicking `Search` SHALL open the existing floating search overlay (Command Palette style) and focus the search input.

#### Scenario: Clicking Search opens the overlay and focuses input
- **WHEN** no task editor is currently open
- **AND** the user clicks the `Search` button
- **THEN** the floating search overlay becomes visible
- **AND** the search input receives focus

