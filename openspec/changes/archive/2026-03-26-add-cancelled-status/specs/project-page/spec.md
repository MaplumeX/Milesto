## MODIFIED Requirements

### Requirement: Project header shows completion control and overflow menu
The Project header SHALL include:

- A completion control whose visual state reflects the project completion status.
- A visible project title.
- An overflow menu button for project-level actions.

If the persisted Project title is an empty string (or whitespace-only), the displayed title label SHALL render a localized placeholder using `common.untitled`.

If the project status is `cancelled`, the displayed project title SHALL render with a line-through decoration.

The completion control in the Project header SHALL be the project progress control defined by `project-progress-indicator`.

#### Scenario: Header reflects open vs done vs cancelled
- **WHEN** the project status is `open`
- **THEN** the header completion control SHALL render in the open style
- **WHEN** the project status is `done`
- **THEN** the header completion control SHALL render in the done style
- **WHEN** the project status is `cancelled`
- **THEN** the header completion control SHALL render in the cancelled style
- **AND THEN** the project title is rendered with a line-through decoration

#### Scenario: Closed project can be reopened from the header control
- **WHEN** the project status is `done` or `cancelled`
- **AND WHEN** the user activates the header completion control
- **THEN** the project status SHALL become `open`
- **AND THEN** the system SHALL remain on `/projects/:projectId`

#### Scenario: Empty persisted title is displayed as a placeholder
- **WHEN** the Project title is an empty string (or whitespace-only)
- **THEN** the Project page title label SHALL display `common.untitled`

### Requirement: Completed tasks are collapsible and collapsed by default
The Project page SHALL provide a single control to show/hide closed tasks.

- Closed tasks SHALL include tasks with `status = done` and `status = cancelled`.
- Closed tasks SHALL be collapsed by default when entering the Project page.
- The collapse state SHALL NOT be persisted (it resets on navigation / reload).
- The control label SHALL use a stable text label (e.g. `Completed`) and SHALL NOT include numeric totals.

#### Scenario: Completed tasks toggle expands and collapses closed tasks
- **WHEN** the user toggles the Completed control from collapsed to expanded
- **THEN** tasks with statuses `done` and `cancelled` in the project SHALL become visible within their section groups
- **WHEN** the user toggles the Completed control from expanded to collapsed
- **THEN** those closed tasks in the project SHALL become hidden

#### Scenario: Collapse state is not persisted
- **WHEN** the user expands completed tasks
- **AND** the user navigates away and returns to the Project page
- **THEN** completed tasks SHALL be collapsed again by default

#### Scenario: Completed label does not expose numeric count
- **WHEN** the user views the Project page
- **THEN** the Completed control label SHALL NOT include a numeric count

### Requirement: Project actions are available via an overflow menu
Project-level actions SHALL remain available from the Project page via an overflow menu.

The overflow menu action set for this change SHALL include:
- for open projects:
  - complete project
  - cancel project
- for closed projects:
  - reopen project
- edit plan (schedule)
- edit due
- move project to an area (including clearing the area)
- edit project tags
- delete project

The overflow menu root view MUST NOT display the current plan/due/tags values.

Section creation SHALL be available from the Project page without leaving the page, but SHALL NOT be available from the Project overflow menu.

#### Scenario: Open project menu exposes cancel project
- **WHEN** the user opens the overflow menu for a project with `status = open`
- **THEN** the menu includes `Complete project`
- **AND THEN** the menu includes `Cancel project`

#### Scenario: Closed project menu exposes reopen instead of cancel
- **WHEN** the user opens the overflow menu for a project with `status = done` or `status = cancelled`
- **THEN** the menu includes `Reopen project`
- **AND THEN** the menu does not include `Cancel project`

#### Scenario: Create section is not in the overflow menu
- **WHEN** the user opens the overflow menu on the Project page
- **THEN** the menu SHALL NOT include an action to create a section
