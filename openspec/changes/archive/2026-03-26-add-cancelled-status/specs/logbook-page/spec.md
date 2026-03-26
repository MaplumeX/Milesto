## MODIFIED Requirements

### Requirement: Logbook completed projects list shows project progress control
When rendering closed project entries on the Logbook page, the UI SHALL render the project progress control next to each project title.

The progress control SHALL be interactive and SHALL follow the complete/reopen behaviors defined by `project-progress-indicator`.

The progress control SHALL NOT be nested inside the project title navigation link.

If the rendered project status is `cancelled`, the project title SHALL render with a line-through decoration.

#### Scenario: Closed projects list renders progress control for each project
- **WHEN** the user views `/logbook`
- **AND WHEN** the Logbook renders a project entry with `status = done` or `status = cancelled`
- **THEN** the project row includes the project progress control next to its title
- **AND THEN** the progress control is not nested inside the project title navigation link

### Requirement: Logbook renders a mixed completed entries list grouped by completion month
The Logbook page SHALL render closed tasks and closed projects in a single list.

Closed entries SHALL include items with `status = done` and `status = cancelled`.

The list SHALL be grouped by completion month (local time).

- Group order SHALL be descending by month (most recent month first).
- Entries within a month group SHALL be ordered by completion timestamp descending.

The completion timestamp SHALL use `completed_at` when present.

- If `completed_at` is null, the system SHALL fall back to `updated_at` for ordering and grouping.

#### Scenario: Logbook shows month groups in descending order
- **WHEN** the user views `/logbook`
- **AND WHEN** there are closed entries spanning multiple months
- **THEN** the Logbook renders a group header for each completion month
- **AND THEN** the group headers are ordered by month descending

#### Scenario: Entries are ordered by completion time within a month
- **WHEN** the Logbook renders entries for a given month group
- **THEN** the entries are ordered by completion timestamp descending

#### Scenario: Done and cancelled entries share the same grouped list
- **WHEN** the user views `/logbook`
- **AND WHEN** there is a done task and a cancelled project in the same month
- **THEN** both entries appear in the same month group

### Requirement: Logbook restores and reopens entries via the left status control
The Logbook page SHALL NOT render a Restore button control for closed tasks.

The Logbook page SHALL keep the recycle capability by making the left status control interactive:

- For tasks, toggling the checkbox from checked to unchecked SHALL restore the task.
  - The task status SHALL become `open`.
  - The task `completed_at` SHALL become null.
- For projects, activating the project progress control for a done or cancelled project SHALL reopen the project.
  - The project status SHALL become `open`.
  - The project `completed_at` SHALL become null.

#### Scenario: Toggling a closed task checkbox restores the task
- **WHEN** the Logbook renders a task entry with `status = done` or `status = cancelled`
- **AND WHEN** the user toggles the checkbox to unchecked
- **THEN** the task status becomes `open`
- **AND THEN** the task `completed_at` becomes null

#### Scenario: Activating a closed project progress control reopens the project
- **WHEN** the Logbook renders a project entry with `status = done` or `status = cancelled`
- **AND WHEN** the user activates the project progress control
- **THEN** the project status becomes `open`
- **AND THEN** the project `completed_at` becomes null

### Requirement: Logbook does not use strikethrough styling for entry titles
The Logbook page SHALL differentiate done and cancelled entries in title styling.

- Entries with `status = done` SHALL NOT render their titles with a line-through decoration.
- Entries with `status = cancelled` SHALL render their titles with a line-through decoration.

#### Scenario: Done Logbook entry title is not rendered with line-through
- **WHEN** the user views `/logbook`
- **AND WHEN** a rendered task or project entry has `status = done`
- **THEN** the entry title is rendered without a line-through decoration

#### Scenario: Cancelled Logbook entry title is rendered with line-through
- **WHEN** the user views `/logbook`
- **AND WHEN** a rendered task or project entry has `status = cancelled`
- **THEN** the entry title is rendered with a line-through decoration
