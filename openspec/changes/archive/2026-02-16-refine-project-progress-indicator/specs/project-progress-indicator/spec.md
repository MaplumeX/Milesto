## MODIFIED Requirements

### Requirement: Project progress control maps progress and completion state consistently
The UI SHALL render a reusable project progress control that represents both:

- Derived task progress (`done_count / total_count`)
- Project completion state (`project.status`)

The control SHALL use a pie fill that starts at 12 o'clock and fills clockwise.

The control SHALL render the pie fill inset from its outer border, leaving a ring-shaped gap between the border and the fill.

- The gap ring SHALL display the underlying surface background (i.e., be visually empty).
- The gap ring in header size SHALL be larger than the gap ring in list size.

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

#### Scenario: Done project renders as checkmark state with hidden border and preserved gap
- **WHEN** a project has `status = done`
- **THEN** the progress control renders in the done style
- **AND THEN** the control displays a checkmark
- **AND THEN** the control's outer border is visually hidden (transparent)
- **AND THEN** the gap ring between border and fill remains visible as background

### Requirement: Clicking the progress control completes or reopens the project
The progress control SHALL be an interactive control on these surfaces:

- Area page projects list
- Logbook completed projects list
- Project page header

If the project status is `open`, activating the control SHALL require confirmation before completing the project.

If the project status is `done`, activating the control SHALL reopen the project without confirmation.

In the Sidebar open projects list, the system SHALL render a display-only progress indicator.

- The Sidebar indicator MUST NOT complete or reopen the project.

Project completion behavior is defined by `project-bulk-complete` (project becomes done and all tasks become done atomically).

#### Scenario: Open project completion requires confirmation
- **WHEN** a project has `status = open`
- **AND WHEN** the user activates the progress control on an interactive surface
- **THEN** the UI asks for confirmation before completing the project
- **AND THEN** if the user cancels, the project remains unchanged

#### Scenario: Completing a project with zero tasks is allowed
- **WHEN** a project has `status = open`
- **AND WHEN** the project has `total_count = 0`
- **AND WHEN** the user activates the progress control on an interactive surface
- **THEN** the UI asks for confirmation
- **AND THEN** if the user confirms, the project becomes `done`

#### Scenario: Done project reopens immediately
- **WHEN** a project has `status = done`
- **AND WHEN** the user activates the progress control on an interactive surface
- **THEN** the project status becomes `open`
- **AND THEN** tasks in the project remain unchanged

#### Scenario: Sidebar indicator does not complete or reopen
- **WHEN** a project row is rendered in the Sidebar open projects list
- **AND WHEN** the user clicks the progress indicator area
- **THEN** the system does not complete or reopen the project

### Requirement: Project progress control is available across project list surfaces
The system SHALL render a project progress affordance next to the project title in each of these surfaces:

- Sidebar open projects list
- Area page projects list
- Logbook completed projects list
- Project page header

Surface-specific structure:

- On the Area page, Logbook page, and Project page header, the progress affordance SHALL be the interactive progress control.
  - The control SHALL be a separate focusable element.
  - The control SHALL NOT be nested inside the project title navigation link.
- On the Sidebar open projects list, the progress affordance SHALL be a display-only indicator.
  - The indicator SHALL be visually grouped with the project row.
  - The indicator MAY be nested inside the project title navigation link.
  - The indicator SHALL NOT introduce an additional focus stop.

#### Scenario: Interactive surfaces use a sibling focusable control
- **WHEN** the project title is rendered as a navigation link on the Area page or Logbook page
- **THEN** the interactive progress control is rendered as a sibling element (not nested within the link)

#### Scenario: Project header renders the interactive control next to the title
- **WHEN** a project page header is rendered
- **THEN** the interactive progress control is rendered next to the project title

#### Scenario: Sidebar renders a display-only indicator without extra focus stop
- **WHEN** the Sidebar renders a project row
- **THEN** the progress indicator is rendered to the left of the project title
- **AND THEN** the indicator is not a separately-focusable control
