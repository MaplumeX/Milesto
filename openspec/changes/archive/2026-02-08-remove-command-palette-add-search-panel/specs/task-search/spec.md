## ADDED Requirements

### Requirement: Task search matches title and notes using prefix semantics
The system SHALL provide task search over Task `title` and `notes`.

The query MUST be interpreted as plain text terms, and MUST provide prefix/partial matching for each whitespace-separated term.

#### Scenario: Prefix query matches a longer token
- **WHEN** a user searches for `mil`
- **THEN** tasks with a token that starts with `mil` in `title` or `notes` are returned

### Requirement: Task search MUST NOT expose FTS query syntax to the user
The task search implementation MUST treat user input as literal text and MUST NOT interpret boolean operators, column filters, or other FTS query syntax provided by the user.

#### Scenario: Operator-looking input is treated as text
- **WHEN** a user searches for `title:foo OR bar`
- **THEN** the search executes successfully
- **AND** the system MUST NOT treat `title:` or `OR` as query operators

### Requirement: Task search supports include_logbook filtering
The `task.search` action SHALL support an `include_logbook` flag.

- When `include_logbook=false` (default), results MUST exclude tasks with `status='done'`.
- When `include_logbook=true`, the search MUST consider tasks with both `status='open'` and `status='done'`.

#### Scenario: Excluding logbook returns only open tasks
- **WHEN** `include_logbook=false`
- **THEN** all returned results have `status='open'`

#### Scenario: Including logbook can return done tasks
- **WHEN** `include_logbook=true`
- **THEN** tasks with `status='done'` are eligible to be returned when they match the query

### Requirement: Task search returns bounded results with a snippet
Task search SHALL return at most 200 results ordered by relevance (best first).

Each result SHALL include a `snippet` field suitable for UI display (string or null).

#### Scenario: Results are limited
- **WHEN** a user searches for a term that matches many tasks
- **THEN** the system returns no more than 200 results

#### Scenario: Results include a snippet when available
- **WHEN** a task is returned from search
- **THEN** the result includes a `snippet` value (string or null)

### Requirement: Task search must be resilient to arbitrary input
For any valid `task.search` payload, the system MUST NOT fail with a malformed query error.

If the input cannot be converted into searchable terms, the system SHALL return `ok: true` with an empty result list.

#### Scenario: Non-searchable input returns empty results
- **WHEN** a user searches for `---`
- **THEN** the search returns `ok: true`
- **AND** the result list is empty
