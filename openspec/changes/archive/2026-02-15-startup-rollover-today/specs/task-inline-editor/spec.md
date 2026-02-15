## ADDED Requirements

### Requirement: Inline editor Schedule Today uses the current local today date
When the user uses the inline editor schedule picker and selects `Today`, the system SHALL set the task's `scheduled_at` to the current local date at the time of the click.

The system MUST NOT compute the `today` date once at component mount and reuse it across a local date rollover.

#### Scenario: Today action after midnight schedules to the new day
- **WHEN** the app has been open across a local midnight boundary
- **AND** the user opens the inline editor schedule picker
- **AND** the user selects `Today`
- **THEN** the task is persisted with `scheduled_at=<current local date>`
