## MODIFIED Requirements

### Requirement: Default ordering remains alphabetical until manual ordering is used
The system SHALL preserve the existing alphabetical ordering behavior for users who have not used manual ordering.

Alphabetical ordering MUST be based on the user-visible display label. If a Project or Area title is empty (or whitespace-only), the display label SHALL be `common.untitled` and ordering SHALL use that label.

#### Scenario: Fresh data shows alphabetical order
- **WHEN** the user has never manually reordered Areas or Projects in the Sidebar
- **THEN** Areas SHALL be ordered by display title (case-insensitive)
- **AND THEN** Projects within each group (unassigned or an Area) SHALL be ordered by display title (case-insensitive)

#### Scenario: Empty titles have stable ordering using display label
- **WHEN** one or more Projects or Areas have an empty (or whitespace-only) persisted title
- **THEN** Sidebar ordering rules SHALL treat their display title as `common.untitled` for ordering purposes
