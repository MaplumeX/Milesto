# cancelled-status Specification

## Purpose
Defines `cancelled` as a terminal status for tasks and projects, and aligns closed-history surfaces with the shared closed-state semantics.

## Requirements
### Requirement: Tasks and projects support `cancelled` as a terminal status
The system SHALL support `cancelled` as a distinct terminal status for both Tasks and Projects.

For both entity types:

- `open` remains the only active status.
- `done` and `cancelled` are both terminal statuses.
- entering `cancelled` SHALL set `completed_at` to the timestamp of the transition.
- restoring a `cancelled` entity to `open` SHALL clear `completed_at`.
- the system MUST NOT directly convert `done -> cancelled` or `cancelled -> done`; users MUST restore the entity to `open` first.

#### Scenario: Open task becomes cancelled
- **WHEN** a task with `status = open` is cancelled
- **THEN** the task status becomes `cancelled`
- **AND THEN** the task `completed_at` is set

#### Scenario: Open project becomes cancelled
- **WHEN** a project with `status = open` is cancelled
- **THEN** the project status becomes `cancelled`
- **AND THEN** the project `completed_at` is set

#### Scenario: Restoring a cancelled entity clears terminal timestamp
- **WHEN** a task or project with `status = cancelled` is restored
- **THEN** the entity status becomes `open`
- **AND THEN** the entity `completed_at` becomes null

### Requirement: Existing closed-history surfaces include both `done` and `cancelled`
The system SHALL continue to use the existing closed-history surfaces for terminal entries.

In this change:

- the Project page `Completed` collapse SHALL include tasks with `status = done` and `status = cancelled`
- the Logbook SHALL include tasks and projects with `status = done` and `status = cancelled`
- the system SHALL NOT introduce a separate `Cancelled` page, section, or month grouping

#### Scenario: Project page closed section mixes done and cancelled tasks
- **WHEN** a project has one task with `status = done` and one task with `status = cancelled`
- **AND WHEN** the user expands the Project page `Completed` section
- **THEN** both tasks are shown in that section

#### Scenario: Logbook groups done and cancelled entries together
- **WHEN** the user views `/logbook`
- **AND WHEN** there are terminal entries with statuses `done` and `cancelled`
- **THEN** both kinds of entries appear in the same month-grouped Logbook list

### Requirement: Cancelled entries are visually distinct from done entries
When rendering terminal entities in status-aware surfaces, the system SHALL distinguish `cancelled` from `done` with shared visual semantics.

In this change:

- `done` SHALL continue to use a checkmark-based status affordance
- `cancelled` SHALL use an `x`-based status affordance
- cancelled task titles SHALL render with a line-through decoration
- cancelled project titles SHALL render with a line-through decoration

#### Scenario: Cancelled task row uses x affordance and line-through title
- **WHEN** a task with `status = cancelled` is rendered in a closed-task surface
- **THEN** its leading status control shows an `x`
- **AND THEN** its title is rendered with a line-through decoration

#### Scenario: Cancelled project row uses x affordance and line-through title
- **WHEN** a project with `status = cancelled` is rendered in a closed-project surface
- **THEN** its leading status affordance shows an `x`
- **AND THEN** its title is rendered with a line-through decoration
