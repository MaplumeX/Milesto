## ADDED Requirements

### Requirement: Expanded inline editor renders a metadata info band below notes
When the inline editor is expanded, the system MUST render a metadata info band below the notes area and above checklist or action areas.

The info band MUST:
- display existing schedule, due, and tag metadata as chips
- preserve the visual order `Schedule -> Due -> Tags`
- omit chips whose source value is absent

The expanded reading order MUST be `Title -> Notes -> Metadata info band -> Checklist content -> Action area`.

#### Scenario: Expanded editor shows metadata below notes
- **WHEN** a task is opened in the inline editor and has visible metadata
- **THEN** the editor renders the metadata info band below the notes area
- **AND** the notes area is rendered above the info band

#### Scenario: Missing metadata does not render empty chips
- **WHEN** a task is opened in the inline editor and one or more metadata values are absent
- **THEN** the editor omits the corresponding chips from the info band

### Requirement: Metadata info band chips are the primary metadata editing entry
The metadata info band chips MUST be interactive and MUST act as the primary entry points for editing schedule, due date, and tags in the expanded inline editor.

Activating a chip MUST open the corresponding picker or panel.

#### Scenario: Clicking the schedule chip opens the schedule picker
- **WHEN** the expanded inline editor shows a schedule chip
- **AND** the user activates that chip
- **THEN** the system opens the existing schedule picker

#### Scenario: Clicking the due chip opens the due picker
- **WHEN** the expanded inline editor shows a due chip
- **AND** the user activates that chip
- **THEN** the system opens the existing due picker

#### Scenario: Clicking the tags chip opens the tags picker
- **WHEN** the expanded inline editor shows a tags chip or tag preview group
- **AND** the user activates that chip or preview group
- **THEN** the system opens the existing tags picker

### Requirement: Expanded action area avoids duplicate metadata controls
The expanded inline editor action area MUST NOT render duplicate `Schedule`, `Due`, or `Tags` action buttons when the metadata info band is present.

The action area MAY still render non-duplicate actions such as checklist creation or project-related actions.

#### Scenario: Footer action area omits duplicate metadata buttons
- **WHEN** a task is opened in the expanded inline editor
- **THEN** the footer action area does not render separate `Schedule`, `Due`, or `Tags` buttons

#### Scenario: Checklist entry remains available when checklist is empty
- **WHEN** a task is opened in the expanded inline editor
- **AND** the checklist is empty
- **THEN** the action area still renders the `Checklist` entry action

## MODIFIED Requirements

### Requirement: Notes are borderless and visually part of the title block
The expanded notes input MUST remain borderless and visually aligned with the title block.

The notes input MUST provide a default multi-line editing area instead of collapsing to a near single-line height.

#### Scenario: Notes keep a visible multi-line editing area by default
- **WHEN** a task is opened in the inline editor
- **THEN** the notes area is visibly taller than a single-line field before the user types

## REMOVED Requirements

### Requirement: Action bar shows Schedule/Tags/Due and conditional Checklist add
**Reason**: Metadata editing moves to the title-adjacent info band, so the footer action area no longer needs duplicate `Schedule` / `Due` / `Tags` entry points.
**Migration**: Use the metadata info band chips as the primary schedule/due/tags entry points, and keep only checklist or other non-duplicate actions in the footer action area.

### Requirement: Footer summary chips show existing Schedule/Due/Tags and support clear
**Reason**: Metadata summary is promoted into a dedicated info band below the title so expanded rows follow the hierarchy `Title -> Information -> Content -> Actions`.
**Migration**: Render schedule/due/tags in the metadata info band below the title, and use the corresponding picker flows to edit or clear those values.
