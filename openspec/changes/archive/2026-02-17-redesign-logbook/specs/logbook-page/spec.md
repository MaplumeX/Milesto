## ADDED Requirements

### Requirement: Logbook renders a mixed completed entries list grouped by completion month
The Logbook page SHALL render completed tasks and completed projects in a single list.

The list SHALL be grouped by completion month (local time).

- Group order SHALL be descending by month (most recent month first).
- Entries within a month group SHALL be ordered by completion timestamp descending.

The completion timestamp SHALL use `completed_at` when present.

- If `completed_at` is null, the system SHALL fall back to `updated_at` for ordering and grouping.

#### Scenario: Logbook shows month groups in descending order
- **WHEN** the user views `/logbook`
- **AND WHEN** there are completed entries spanning multiple months
- **THEN** the Logbook renders a group header for each completion month
- **AND THEN** the group headers are ordered by month descending

#### Scenario: Entries are ordered by completion time within a month
- **WHEN** the Logbook renders entries for a given month group
- **THEN** the entries are ordered by completion timestamp descending

### Requirement: Logbook month header label omits the current year
The Logbook month header label SHALL omit the year for months in the current local year.

For months outside the current local year, the label SHALL include the year.

#### Scenario: Current-year month header omits year
- **WHEN** the user views `/logbook`
- **AND WHEN** the Logbook renders a month group in the current year
- **THEN** the month header label omits the year

#### Scenario: Non-current-year month header includes year
- **WHEN** the user views `/logbook`
- **AND WHEN** the Logbook renders a month group not in the current year
- **THEN** the month header label includes the year

### Requirement: Logbook displays completion date between status control and title
Each Logbook entry row SHALL render the completion date between the left status control and the entry title.

The completion date SHALL be derived from the entry completion timestamp in local time.

The completion date display SHALL use numeric month/day format.

#### Scenario: Task row renders completion date prefix
- **WHEN** the Logbook renders a completed task entry
- **THEN** the task row shows the completion date between the checkbox and the task title

#### Scenario: Project row renders completion date prefix
- **WHEN** the Logbook renders a completed project entry
- **THEN** the project row shows the completion date between the progress control and the project title

### Requirement: Logbook does not add explicit task/project kind labels
The Logbook page SHALL NOT render any explicit entry kind labels (for example "Task" or "Project") for Logbook entries.

The entry kind SHALL be distinguishable solely via the left status control:

- Tasks use a checkbox.
- Projects use the project progress control.

#### Scenario: Mixed Logbook entries have no explicit kind labels
- **WHEN** the Logbook renders a completed task entry
- **AND WHEN** the Logbook renders a completed project entry
- **THEN** neither entry row includes an explicit task/project kind label

### Requirement: Logbook restores and reopens entries via the left status control
The Logbook page SHALL NOT render a Restore button control for completed tasks.

The Logbook page SHALL keep the recycle capability by making the left status control interactive:

- For tasks, toggling the checkbox from checked to unchecked SHALL restore the task.
  - The task status SHALL become `open`.
  - The task `completed_at` SHALL become null.
- For projects, activating the project progress control for a done project SHALL reopen the project.
  - The project status SHALL become `open`.
  - The project `completed_at` SHALL become null.

#### Scenario: Toggling a done task checkbox restores the task
- **WHEN** the Logbook renders a completed task entry
- **AND WHEN** the user toggles the checkbox to unchecked
- **THEN** the task status becomes `open`
- **AND THEN** the task `completed_at` becomes null

#### Scenario: Activating a done project progress control reopens the project
- **WHEN** the Logbook renders a completed project entry
- **AND WHEN** the user activates the project progress control
- **THEN** the project status becomes `open`
- **AND THEN** the project `completed_at` becomes null

### Requirement: Logbook does not use strikethrough styling for entry titles
The Logbook page SHALL NOT render entry titles with a line-through decoration.

#### Scenario: Logbook entry title is not rendered with line-through
- **WHEN** the user views `/logbook`
- **THEN** completed entry titles are rendered without a line-through decoration

## MODIFIED Requirements

### Requirement: Logbook completed projects list shows project progress control
When rendering completed project entries on the Logbook page, the UI SHALL render the project progress control next to each project title.

The progress control SHALL be interactive and SHALL follow the complete/reopen behaviors defined by `project-progress-indicator`.

The progress control SHALL NOT be nested inside the project title navigation link.

#### Scenario: Completed projects list renders progress control for each project
- **WHEN** the user views `/logbook`
- **AND WHEN** the Logbook renders a completed project entry
- **THEN** the project row includes the project progress control next to its title
- **AND THEN** the progress control is not nested inside the project title navigation link
