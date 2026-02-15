## ADDED Requirements

### Requirement: Startup rolls past scheduled open tasks forward to today
On app startup, the system SHALL roll over tasks into Today by updating the persisted schedule date.

Rollover eligibility:

- task `status` MUST be `open`
- task `deleted_at` MUST be null
- task `scheduled_at` MUST be non-null
- task `scheduled_at` MUST be strictly earlier than the current local `today` date

For each eligible task, the system SHALL:

- set `scheduled_at` to the current local `today` date
- update `updated_at` to the current ISO datetime

The system MUST NOT modify:

- tasks where `scheduled_at` is null
- tasks where `scheduled_at = today`
- tasks where `scheduled_at > today`
- tasks where `status = done`
- deleted tasks (`deleted_at` non-null)

#### Scenario: Past scheduled open tasks appear in Today after startup
- **WHEN** a task exists with `status=open` and `scheduled_at=2026-02-14`
- **AND** the app starts on local date `2026-02-15`
- **THEN** the task is persisted with `scheduled_at=2026-02-15`
- **AND** the task is returned by the Today list query for `2026-02-15`

### Requirement: Startup rollover is safe to run multiple times per day
The rollover process SHALL be idempotent for the current day.

#### Scenario: Repeated startup does not change already-rolled tasks
- **WHEN** the app starts on local date `2026-02-15` and rolls a task forward to `scheduled_at=2026-02-15`
- **AND** the app starts again later on the same local date `2026-02-15`
- **THEN** the task remains persisted with `scheduled_at=2026-02-15`
