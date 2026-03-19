## ADDED Requirements

### Requirement: Trash page uses an open-first work-list presentation
The Trash page SHALL present its mixed task/project root list as a normal work list rather than a row-action management table.

The page header SHALL show:

- the `Trash` title
- a single `Empty Trash` action

The Trash list MUST NOT render per-row restore or permanent-delete buttons in this change.

The Trash page MUST NOT expose a primary create affordance from the page chrome.

#### Scenario: Trash header only shows title and Empty Trash
- **WHEN** the user views `/trash`
- **THEN** the page header shows the `Trash` title
- **AND** the page header shows an `Empty Trash` action
- **AND** the page header does not show row-level restore or purge controls

#### Scenario: Trash rows do not show inline restore or purge buttons
- **WHEN** the user views Trash rows
- **THEN** task rows do not render inline `Restore` buttons
- **AND** task rows do not render inline permanent-delete buttons
- **AND** project rows do not render inline `Restore` buttons
- **AND** project rows do not render inline permanent-delete buttons

### Requirement: Trash rows open deleted entities in their native work surfaces
Trash rows SHALL support open-first interaction.

For task roots:

- single click SHALL only select the row
- `Enter` or double-click SHALL open the task's inline editor in place

For project roots:

- single click SHALL only select the row
- `Enter` or double-click SHALL navigate to the project page in `trash` scope

#### Scenario: Clicking a Trash task row only selects it
- **WHEN** the user single-clicks a Trash task row
- **THEN** that row becomes selected
- **AND** the task editor remains closed

#### Scenario: Enter opens a Trash task inline editor
- **WHEN** a Trash task row is selected
- **WHEN** the user presses `Enter`
- **THEN** the task opens in the inline editor within `/trash`

#### Scenario: Double-click opens a Trash project in trash scope
- **WHEN** the user double-clicks a Trash project row
- **THEN** the app navigates to `/projects/:projectId?scope=trash`

