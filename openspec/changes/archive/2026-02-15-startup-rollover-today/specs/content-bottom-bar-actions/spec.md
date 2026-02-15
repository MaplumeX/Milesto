## ADDED Requirements

### Requirement: Schedule Today uses the current local today date
When the user uses the content bottom bar `Schedule` action and selects `Today`, the system SHALL set the selected task's schedule date to the current local date at the time of the action.

The system MUST NOT compute the `today` date once at application or component mount and reuse it across a local date rollover.

#### Scenario: Today action after midnight schedules to the new day
- **WHEN** the app has been open across a local midnight boundary
- **AND** the user opens the content bottom bar schedule popover
- **AND** the user selects `Today`
- **THEN** the selected task is persisted with `scheduled_at=<current local date>`
