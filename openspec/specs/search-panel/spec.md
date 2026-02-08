# search-panel Specification

## Purpose
TBD - created by archiving change remove-command-palette-add-search-panel. Update Purpose after archive.
## Requirements
### Requirement: User can open the SearchPanel from the bottom bar
When the user triggers search from the content bottom bar, the system SHALL display a centered modal search panel (with a scrim) and focus the search input.

#### Scenario: Opening the SearchPanel focuses the input
- **WHEN** no task editor is currently open
- **AND** the user clicks the `Search` button in the content bottom bar
- **THEN** a centered search panel becomes visible
- **AND** the search input receives focus

### Requirement: SearchPanel can be dismissed without side effects
The SearchPanel MUST be dismissible via `Escape` and by clicking the scrim/outside area.

On dismissal, the SearchPanel MUST clear its transient UI state (query, results, highlight) and MUST NOT create or mutate tasks.

#### Scenario: Escape closes the SearchPanel
- **WHEN** the SearchPanel is open
- **AND** the user presses `Escape`
- **THEN** the SearchPanel closes
- **AND** the query input is cleared

#### Scenario: Clicking the scrim closes the SearchPanel
- **WHEN** the SearchPanel is open
- **AND** the user clicks outside the panel content (on the scrim)
- **THEN** the SearchPanel closes
- **AND** the query input is cleared

### Requirement: SearchPanel performs task search as the user types
While the SearchPanel is open, changes to the query input SHALL trigger a debounced task search.

The SearchPanel SHALL call `window.api.task.search(query, { includeLogbook: false })`.

#### Scenario: Typing triggers a debounced search
- **WHEN** the SearchPanel is open
- **AND** the user types a non-empty query
- **THEN** the system performs a debounced search against tasks
- **AND** the SearchPanel displays the returned task results

### Requirement: SearchPanel supports keyboard navigation and selection
The SearchPanel SHALL allow users to move a highlighted selection through results using `ArrowUp` and `ArrowDown`.

Pressing `Enter` SHALL select the highlighted result, navigate to the task's owning view, select the task, and close the SearchPanel.

#### Scenario: Arrow keys move the highlight
- **WHEN** the SearchPanel is open
- **AND** search results are visible
- **AND** the user presses `ArrowDown`
- **THEN** the highlighted result moves down by 1 (clamped within the result list)

#### Scenario: Enter selects a result and closes the SearchPanel
- **WHEN** the SearchPanel is open
- **AND** a search result is highlighted
- **AND** the user presses `Enter`
- **THEN** the app navigates to the task's owning view (e.g. Inbox/Today/Upcoming/Project)
- **AND** the selected task becomes the active selection
- **AND** the SearchPanel closes

### Requirement: SearchPanel is search-only (no command list, no quick-create)
The SearchPanel MUST NOT present view navigation commands, and MUST NOT create tasks from the query.

#### Scenario: Enter with no highlighted task does not create a new task
- **WHEN** the SearchPanel is open
- **AND** the current query yields zero results
- **AND** the user presses `Enter`
- **THEN** the system MUST NOT create a new task

