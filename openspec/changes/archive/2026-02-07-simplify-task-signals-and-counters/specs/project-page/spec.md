## MODIFIED Requirements

### Requirement: Completed tasks are collapsible and collapsed by default
The Project page SHALL provide a single control to show/hide completed tasks.

- Completed tasks SHALL be collapsed by default when entering the Project page.
- The collapse state SHALL NOT be persisted (it resets on navigation / reload).
- The control label SHALL use a stable text label (e.g. `Completed`) and SHALL NOT include numeric totals.

#### Scenario: Completed tasks toggle expands and collapses
- **WHEN** the user toggles the Completed control from collapsed to expanded
- **THEN** completed tasks in the project SHALL become visible within their section groups
- **WHEN** the user toggles the Completed control from expanded to collapsed
- **THEN** completed tasks in the project SHALL become hidden

#### Scenario: Collapse state is not persisted
- **WHEN** the user expands completed tasks
- **AND** the user navigates away and returns to the Project page
- **THEN** completed tasks SHALL be collapsed again by default

#### Scenario: Completed label does not expose numeric count
- **WHEN** the user views the Project page
- **THEN** the Completed control label SHALL NOT include a numeric count

## ADDED Requirements

### Requirement: Project task surfaces do not display numeric counters
On the Project page, task-related UI surfaces SHALL NOT display numeric counters for `open`, `done`, or `total` values.

This rule applies to:
- project header meta summary
- section header meta summary
- section drag overlay meta summary
- project action labels (including completion action labels)

#### Scenario: Header and section surfaces are counter-free
- **WHEN** the user is on `/projects/:projectId`
- **THEN** the project header SHALL NOT show `open/done/total` numeric summaries
- **THEN** section headers and section drag overlays SHALL NOT show `open/done` numeric summaries

#### Scenario: Project completion action label is counter-free
- **WHEN** the user opens the Project actions menu
- **THEN** the completion action label SHALL NOT include a numeric count suffix (e.g. `(N)`)
