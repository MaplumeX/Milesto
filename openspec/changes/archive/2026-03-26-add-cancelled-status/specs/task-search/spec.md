## MODIFIED Requirements

### Requirement: Task search supports include_logbook filtering
The `task.search` action SHALL support an `include_logbook` flag.

- When `include_logbook=false` (default), results MUST exclude tasks with `status='done'` and `status='cancelled'`.
- When `include_logbook=true`, the search MUST consider tasks with `status='open'`, `status='done'`, and `status='cancelled'`.

#### Scenario: Excluding logbook returns only open tasks
- **WHEN** `include_logbook=false`
- **THEN** all returned results have `status='open'`

#### Scenario: Including logbook can return cancelled tasks
- **WHEN** `include_logbook=true`
- **THEN** tasks with `status='cancelled'` are eligible to be returned when they match the query
