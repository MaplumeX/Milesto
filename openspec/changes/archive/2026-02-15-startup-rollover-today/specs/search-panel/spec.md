## ADDED Requirements

### Requirement: SearchPanel uses realtime local today for hinting and navigation
While the SearchPanel is open, any hinting and navigation logic that depends on whether a task is scheduled for "today" SHALL use the current local date at the time the decision is made.

The system MUST NOT rely on a `today` value captured at component mount across a local date rollover.

#### Scenario: Search selection after midnight navigates correctly
- **WHEN** the app has been open across a local midnight boundary
- **AND** the user opens the SearchPanel and selects a task whose `scheduled_at` equals the current local date
- **THEN** the app navigates to `/today`
