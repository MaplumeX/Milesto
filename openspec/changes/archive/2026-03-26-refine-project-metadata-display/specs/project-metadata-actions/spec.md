## MODIFIED Requirements

### Requirement: Project metadata is visible as a meta row under the title
When viewing a project page, the UI SHALL display a meta row directly below the header and above notes.

The meta row SHALL show the current values as chips:
- a plan chip when plan state is Someday or Date
- a due chip when due is non-null
- up to 4 tag chips in persisted tag order when tags are non-empty
- a trailing `+N` summary chip when more than 4 tags exist, where `N` is the number of hidden tags

The meta row MUST be limited to plan, due, and tags. The project area MUST NOT be displayed in the meta row.
When tags are present, the tag chips and `+N` summary chip SHALL render on a dedicated line below the plan/due chips.

If plan is None, due is null, and tags are empty, the meta row SHALL NOT be rendered.

#### Scenario: Meta row is hidden when there is no metadata
- **WHEN** a project has plan=None, due=null, and zero tags
- **THEN** the project page SHALL NOT render the meta row

#### Scenario: Meta row shows plan, due, and up to four ordered tags
- **WHEN** a project has plan set, due set, and 4 or fewer tags
- **THEN** the project page SHALL render the meta row
- **AND** the meta row SHALL render chips for the present plan and due values
- **AND** the meta row SHALL render each tag chip in the persisted tag order
- **AND** the tag chips SHALL render on a line below the plan/due chips

#### Scenario: Meta row summarizes hidden tags beyond the first four
- **WHEN** a project has more than 4 tags
- **THEN** the project page SHALL render only the first 4 tag chips in persisted tag order
- **AND** the project page SHALL render one trailing `+N` summary chip for the remaining hidden tags
- **AND** the visible tag chips and `+N` summary chip SHALL render on a line below the plan/due chips

#### Scenario: Meta row does not display the project area
- **WHEN** a project belongs to an area
- **AND** the project page renders the meta row
- **THEN** the meta row SHALL NOT render the project area as a chip or field

### Requirement: Metadata chips provide one-click clear/remove controls
The meta row chips SHALL provide inline close ("x") controls for:
- the plan chip
- the due chip
- each visible tag chip

Close semantics:
- closing the plan chip clears plan (sets plan state to None)
- closing the due chip clears due (sets `due_at=null`)
- closing a visible tag chip removes that single tag from the project

When a `+N` summary chip is present, it MUST NOT expose an inline close control. Activating the summary chip SHALL open the Project tags management view directly.

#### Scenario: Clicking plan chip close clears plan
- **WHEN** the plan chip is visible
- **AND** the user clicks the plan chip close control
- **THEN** the project plan SHALL be cleared and persisted

#### Scenario: Clicking due chip close clears due
- **WHEN** the due chip is visible
- **AND** the user clicks the due chip close control
- **THEN** the project due date SHALL be cleared and persisted

#### Scenario: Clicking a visible tag chip close removes that tag
- **WHEN** a visible tag chip is rendered in the meta row
- **AND** the user clicks that tag chip close control
- **THEN** the project tags SHALL be persisted with that tag removed

#### Scenario: Clicking the summary chip opens tag management
- **WHEN** a `+N` summary chip is rendered in the meta row
- **AND** the user activates the summary chip
- **THEN** the Project page SHALL open the existing Project tags management view directly
