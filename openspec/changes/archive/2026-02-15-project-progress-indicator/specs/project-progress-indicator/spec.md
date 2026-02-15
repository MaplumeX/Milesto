## ADDED Requirements

### Requirement: System provides per-project task progress counts for list rendering
The system SHALL provide an API that returns per-project task completion counts for a set of Projects so that list views can render progress without N IPC calls.

Returned counts SHALL be derived from Tasks where:

- `deleted_at IS NULL`
- `project_id` matches one of the requested project ids

For each requested project id, the API SHALL return:

- `done_count`: number of matching tasks with `status = done`
- `total_count`: number of matching tasks with `status IN (open, done)`

If a requested project has zero matching tasks, the API SHALL still return an entry for that project with `done_count = 0` and `total_count = 0`.

#### Scenario: Batch counts include a project with no tasks
- **WHEN** the UI requests progress counts for project ids `[P1, P2]`
- **AND WHEN** P1 has no non-deleted tasks
- **THEN** the API returns an entry for P1 with `done_count = 0` and `total_count = 0`

#### Scenario: Batch counts exclude deleted tasks
- **WHEN** the UI requests progress counts for project id `P1`
- **AND WHEN** P1 has tasks where `deleted_at IS NOT NULL`
- **THEN** those deleted tasks are not included in `done_count` or `total_count`

#### Scenario: Batch counts reflect open and done tasks
- **WHEN** the UI requests progress counts for project id `P1`
- **AND WHEN** P1 has 3 non-deleted open tasks and 2 non-deleted done tasks
- **THEN** the API returns `done_count = 2` and `total_count = 5` for P1

### Requirement: Project progress control maps progress and completion state consistently
The UI SHALL render a reusable project progress control that represents both:

- Derived task progress (`done_count / total_count`)
- Project completion state (`project.status`)

The control SHALL use a pie fill that starts at 12 o'clock and fills clockwise.

The control MUST NOT render any checkmark or ghost-check hint unless the project status is `done`.

#### Scenario: Open project with zero tasks renders as empty
- **WHEN** a project has `status = open`
- **AND WHEN** `total_count = 0`
- **THEN** the progress control renders as an outlined circle with an empty interior

#### Scenario: Open project renders pie fill for partial progress
- **WHEN** a project has `status = open`
- **AND WHEN** `total_count > 0`
- **THEN** the progress control renders a pie fill whose angle equals `done_count / total_count`
- **AND THEN** the fill starts at 12 o'clock and increases clockwise

#### Scenario: Open project at 100% progress is distinguishable from done
- **WHEN** a project has `status = open`
- **AND WHEN** `total_count > 0`
- **AND WHEN** `done_count = total_count`
- **THEN** the progress control renders as 100% progress
- **AND THEN** the control is visually distinguishable from `status = done`
- **AND THEN** the control does not display a checkmark

#### Scenario: Done project renders as checkmark state
- **WHEN** a project has `status = done`
- **THEN** the progress control renders in the done style
- **AND THEN** the control displays a checkmark

### Requirement: Clicking the progress control completes or reopens the project
The progress control SHALL be an interactive control.

- If the project status is `open`, activating the control SHALL require confirmation before completing the project.
- If the project status is `done`, activating the control SHALL reopen the project without confirmation.

Project completion behavior is defined by `project-bulk-complete` (project becomes done and all tasks become done atomically).

#### Scenario: Open project completion requires confirmation
- **WHEN** a project has `status = open`
- **AND WHEN** the user activates the progress control
- **THEN** the UI asks for confirmation before completing the project
- **AND THEN** if the user cancels, the project remains unchanged

#### Scenario: Completing a project with zero tasks is allowed
- **WHEN** a project has `status = open`
- **AND WHEN** the project has `total_count = 0`
- **AND WHEN** the user activates the progress control
- **THEN** the UI asks for confirmation
- **AND THEN** if the user confirms, the project becomes `done`

#### Scenario: Done project reopens immediately
- **WHEN** a project has `status = done`
- **AND WHEN** the user activates the progress control
- **THEN** the project status becomes `open`
- **AND THEN** tasks in the project remain unchanged

### Requirement: Project progress control is available across project list surfaces
The system SHALL render the project progress control next to the project title in each of these surfaces:

- Sidebar open projects list
- Area page projects list
- Logbook completed projects list
- Project page header

The control SHALL be a separate focusable element and SHALL NOT be nested inside the project title link.

#### Scenario: Control is a sibling of the project title link
- **WHEN** the project title is rendered as a navigation link
- **THEN** the progress control is rendered as a sibling element (not nested within the link)
