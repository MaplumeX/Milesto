## MODIFIED Requirements

### Requirement: Soft-deleted projects are not visible in project surfaces
The system SHALL hide soft-deleted projects from active project surfaces while keeping them recoverable through Trash until they are permanently removed.

After a project is soft-deleted:

- it MUST NOT appear in active project list surfaces
- fetching `project.get` and `project.getDetail` in `active` scope MUST fail with a not-found result

Until the project is permanently removed:

- fetching project detail in `trash` scope MUST succeed
- the project SHALL remain recoverable through Trash semantics

#### Scenario: Deleted project no longer appears in active project lists
- **WHEN** a project is soft-deleted
- **THEN** active project list surfaces MUST NOT include that project

#### Scenario: Deleted project cannot be fetched by active detail
- **WHEN** a project is soft-deleted
- **THEN** fetching project detail for that project in `active` scope fails with a not-found result

#### Scenario: Deleted project can be fetched by trash detail
- **WHEN** a project is soft-deleted
- **WHEN** the client fetches project detail for that project in `trash` scope
- **THEN** the request succeeds

#### Scenario: Deleted project remains recoverable until permanently removed
- **WHEN** a project is soft-deleted
- **THEN** that project remains recoverable through Trash until it is permanently removed

## ADDED Requirements

### Requirement: Deleted project trees accept new deleted descendants while remaining deleted
While a project remains recoverably deleted, the system SHALL allow new sections and tasks to be created inside that deleted project tree through `trash` scope.

New descendants created in this state:

- MUST start with non-null `deleted_at`
- MUST remain part of the deleted project tree
- MUST NOT appear as active descendants

#### Scenario: New task in deleted project starts as a deleted descendant
- **WHEN** project `P1` is soft-deleted and recoverable
- **WHEN** the user creates task `T2` inside `P1` in `trash` scope
- **THEN** `T2` is persisted as a deleted descendant of `P1`
- **AND THEN** `T2` does not appear in active task surfaces

#### Scenario: New section in deleted project starts as a deleted descendant
- **WHEN** project `P1` is soft-deleted and recoverable
- **WHEN** the user creates section `S2` inside `P1` in `trash` scope
- **THEN** `S2` is persisted as a deleted descendant of `P1`

### Requirement: Project-tree restore and purge include descendants created after deletion
When a recoverably deleted project is restored or permanently removed, the operation SHALL apply to all current recoverable deleted descendants in that project tree, including descendants created while the project remained deleted.

#### Scenario: Restoring a project restores a section created after deletion
- **WHEN** project `P1` is soft-deleted
- **AND** section `S2` is created under `P1` afterward in `trash` scope
- **WHEN** the user restores `P1`
- **THEN** `S2` is restored with `P1`

#### Scenario: Empty Trash purges a task created after project deletion
- **WHEN** project `P1` is soft-deleted
- **AND** task `T2` is created under `P1` afterward in `trash` scope
- **WHEN** the user empties Trash
- **THEN** `T2` is permanently removed with `P1`'s deleted tree
