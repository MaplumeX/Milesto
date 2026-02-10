## ADDED Requirements

### Requirement: Project plan (schedule) supports None / Someday / Date
Projects SHALL support a three-state plan schedule:

- None: `scheduled_at=null` and `is_someday=false`
- Someday: `scheduled_at=null` and `is_someday=true`
- Date: `scheduled_at=<YYYY-MM-DD>` and `is_someday=false`

The system MUST enforce the invariants:
- `is_someday=true` implies `scheduled_at` is null
- `scheduled_at` is non-null implies `is_someday=false`

#### Scenario: Choosing Someday sets Someday plan state
- **WHEN** the user sets the project plan to `Someday`
- **THEN** the project SHALL be persisted with `is_someday=true`
- **AND** the project SHALL be persisted with `scheduled_at=null`

#### Scenario: Choosing a date sets a concrete planned date
- **WHEN** the user sets the project plan to a concrete date
- **THEN** the project SHALL be persisted with `scheduled_at=<date>`
- **AND** the project SHALL be persisted with `is_someday=false`

#### Scenario: Clearing plan sets the plan state to None
- **WHEN** the user clears the project plan
- **THEN** the project SHALL be persisted with `scheduled_at=null`
- **AND** the project SHALL be persisted with `is_someday=false`

### Requirement: Project due date supports set and clear
Projects SHALL support an optional due date stored as a local date string `YYYY-MM-DD`.

#### Scenario: Setting due persists a due date
- **WHEN** the user sets a due date for the project
- **THEN** the project SHALL be persisted with `due_at=<YYYY-MM-DD>`

#### Scenario: Clearing due persists a null due date
- **WHEN** the user clears the due date for the project
- **THEN** the project SHALL be persisted with `due_at=null`

### Requirement: Project metadata is visible as a meta row under the title
When viewing a project page, the UI SHALL display a meta row directly below the header and above notes.

The meta row SHALL show the current values as chips:
- plan chip when plan state is Someday or Date
- due chip when due is non-null
- one chip per tag when tags are non-empty

If plan is None, due is null, and tags are empty, the meta row SHOULD NOT be rendered.

#### Scenario: Meta row is hidden when there is no metadata
- **WHEN** a project has plan=None, due=null, and zero tags
- **THEN** the project page SHALL NOT render the meta row

#### Scenario: Meta row shows schedule, due, and tags when present
- **WHEN** a project has any of plan, due, or tags set
- **THEN** the project page SHALL render the meta row
- **AND** the meta row SHALL render chips for the values that are present

### Requirement: Metadata chips provide one-click clear/remove controls
The meta row chips SHALL provide an inline close ("x") control.

Close semantics:
- closing the plan chip clears plan (sets plan state to None)
- closing the due chip clears due (sets `due_at=null`)
- closing a tag chip removes that single tag from the project

#### Scenario: Clicking plan chip close clears plan
- **WHEN** the plan chip is visible
- **AND** the user clicks the plan chip close control
- **THEN** the project plan SHALL be cleared and persisted

#### Scenario: Clicking due chip close clears due
- **WHEN** the due chip is visible
- **AND** the user clicks the due chip close control
- **THEN** the project due date SHALL be cleared and persisted

#### Scenario: Clicking tag chip close removes that tag
- **WHEN** a tag chip is visible
- **AND** the user clicks that tag chip close control
- **THEN** the project tags SHALL be persisted with that tag removed

### Requirement: Project overflow menu edits metadata without showing current values in the root view
The Project overflow menu SHALL provide actions to edit plan, due, move, and tags.

The overflow menu root view MUST NOT display current plan/due/tags values.

#### Scenario: Opening overflow menu does not reveal current metadata values
- **WHEN** the user opens the project overflow menu
- **THEN** the root view SHALL present actions without showing current plan/due/tags values

### Requirement: Overflow menu uses a single anchored popover with internal subviews
The overflow menu UI MUST be a single anchored popover (dialog-like surface) that switches internal subviews for plan/due/move/tags.

Dismissal and navigation:
- Escape closes the entire popover
- click/tap outside closes the entire popover
- a Back control returns to the root view from any subview
- closing the popover restores focus to the overflow trigger

#### Scenario: Escape closes the menu
- **WHEN** a project overflow menu is open (in any subview)
- **AND** the user presses `Escape`
- **THEN** the entire popover closes
- **AND** focus returns to the overflow menu trigger

#### Scenario: Back returns to root view
- **WHEN** the user is in a plan/due/move/tags subview
- **AND** the user activates Back
- **THEN** the menu returns to the root view
