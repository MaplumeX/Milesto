# single-user-s3-sync Specification

## Purpose
TBD - created by archiving change single-user-s3-sync. Update Purpose after archive.
## Requirements
### Requirement: User can configure an optional S3-compatible sync repository
The system MUST allow a user to configure one optional single-user sync repository using:

- `endpoint`
- `region`
- `bucket`
- `prefix`
- `forcePathStyle`
- `accessKeyId`
- `secretAccessKey`

The system MUST validate the repository configuration before enabling synchronization.

Non-sensitive repository configuration MUST be persisted locally.

Sensitive credentials MUST be stored in secure local storage.

When the user opens the Settings dialog's `Sync` tab to review or edit the current sync credentials, the system MAY expose the stored raw credentials to the renderer for that explicit editing workflow.

The periodic sync status surface MUST NOT include raw credentials.

The system MUST expose this configuration workflow in the Settings dialog's `Sync` tab.

#### Scenario: Successful repository setup
- **WHEN** the user enters valid repository configuration and valid credentials in the Settings dialog's `Sync` tab
- **AND** the user runs connection validation
- **THEN** the system MUST confirm that the repository is reachable
- **AND** the system MUST persist the non-sensitive configuration locally
- **AND** the system MUST store the credentials in secure local storage
- **AND** the system MUST allow the user to enable synchronization for the current device

#### Scenario: Validation failure blocks enablement
- **WHEN** the user provides an invalid endpoint, bucket, prefix, or credential set in the Settings dialog's `Sync` tab
- **AND** the user runs connection validation
- **THEN** the system MUST NOT enable synchronization
- **AND** the system MUST return a structured error using `code` and `message`

#### Scenario: Secure storage unavailable blocks persistent sync setup
- **WHEN** the current device cannot provide secure local credential storage
- **AND** the user attempts to enable synchronization from the Settings dialog's `Sync` tab
- **THEN** the system MUST refuse to enable persistent synchronization
- **AND** the system MUST return a structured error using `code` and `message`

### Requirement: Content data synchronizes across the user's devices with seconds-level eventual consistency
When synchronization is enabled on multiple devices that point to the same repository, the system MUST synchronize the following content data across those devices:

- tasks
- projects
- project sections
- areas
- tags
- checklist items
- tag relationships
- task list ordering
- sidebar area/project ordering and project area membership

The system MUST propagate local content changes by writing append-only sync batches to the repository.

The system MUST pull remote batches on a repeating schedule while the app is open and MUST trigger an immediate catch-up sync when the app regains focus.

#### Scenario: Task edit propagates to another device
- **WHEN** synchronization is enabled on Device A and Device B for the same repository
- **AND** the user edits a task title on Device A
- **AND** Device A successfully uploads the resulting sync batch
- **AND** Device B performs a subsequent pull cycle
- **THEN** Device B MUST converge to the edited task title

#### Scenario: Focus regain triggers catch-up
- **WHEN** synchronization is enabled on a device
- **AND** the app has been in the background long enough to miss remote changes
- **WHEN** the app regains focus
- **THEN** the system MUST immediately start a catch-up synchronization cycle

### Requirement: Remote sync batches apply transactionally and idempotently
The system MUST apply each remote sync batch as a single transaction.

If any operation in a remote batch fails validation or database application, the system MUST roll back the entire batch and MUST NOT leave partial content changes applied.

The system MUST track remote progress per source device and MUST NOT apply the same remote batch more than once.

#### Scenario: Invalid remote batch rolls back entirely
- **WHEN** a pulled remote batch contains one or more invalid operations
- **THEN** the system MUST reject the batch
- **AND** the system MUST roll back all changes from that batch
- **AND** the system MUST keep the remote cursor before the rejected batch

#### Scenario: Duplicate remote batch is ignored
- **WHEN** the system pulls a remote batch that has already been successfully applied
- **THEN** the system MUST NOT re-apply its content changes
- **AND** the system MUST keep the local content state unchanged

### Requirement: Sync conflict resolution follows deterministic rules
The system MUST resolve synchronization conflicts deterministically using these rules:

- ordinary content fields MUST use field-level last-writer-wins
- delete and restore semantics MUST use tombstones as part of conflict comparison
- tag relationships MUST be treated as first-class sync objects
- task list ordering and sidebar ordering MUST use whole-list last-writer-wins

When two devices update different fields of the same entity, the system MUST preserve both winning field values after convergence.

When two devices update the same field or the same list scope concurrently, every device MUST converge to the same winning value or order.

#### Scenario: Different fields merge without losing either change
- **WHEN** Device A changes a task title
- **AND** Device B changes the same task's notes before either device has pulled the other's batch
- **AND** both devices later complete synchronization
- **THEN** every device MUST converge to the newer winning title for the title field
- **AND** every device MUST converge to the newer winning notes for the notes field

#### Scenario: Newer delete wins over older edit
- **WHEN** Device A edits a task
- **AND** Device B deletes the same task with a newer tombstone
- **AND** both devices later complete synchronization
- **THEN** every device MUST converge to the deleted task state

#### Scenario: Concurrent list reorders converge to one final order
- **WHEN** Device A reorders a supported task list
- **AND** Device B concurrently reorders the same list scope differently
- **AND** both reorder batches are later observed by every device
- **THEN** every device MUST converge to one deterministic final order for that list scope
- **AND** the winning order MUST be selected using the sync system's whole-list conflict rule

### Requirement: Device-local preferences and secrets remain local
The system MUST NOT synchronize the following device-local settings through content sync:

- theme preference
- locale preference
- sidebar collapsed state
- local sync credentials

The system MUST NOT include sync credentials, remote cursors, or local outbox state in user content export/import files.

#### Scenario: Theme stays device-local
- **WHEN** synchronization is enabled on Device A and Device B
- **AND** the user changes the theme preference on Device A
- **THEN** Device B MUST keep its own existing theme preference unchanged

#### Scenario: Content export excludes sync secrets and cursors
- **WHEN** the user exports content data on a device with synchronization enabled
- **THEN** the exported data MUST NOT include sync credentials
- **AND** the exported data MUST NOT include per-device remote cursors
- **AND** the exported data MUST NOT include local outbox batches

### Requirement: Settings surfaces sync status and operator controls
The system MUST provide a `Sync` tab inside the Settings dialog that exposes:

- whether sync is enabled
- the current device name
- current sync state
- last successful sync time
- the most recent sync error using `code` and `message`
- a manual `Sync now` action
- controls to update configuration or disable synchronization

The `Sync` tab MUST present sync status above the repository configuration form and action controls.

#### Scenario: Successful sync updates status
- **WHEN** a synchronization cycle completes successfully
- **THEN** the Settings dialog's `Sync` tab MUST show that sync is not currently running
- **AND** the Settings dialog's `Sync` tab MUST show the updated last successful sync time

#### Scenario: Failed sync shows actionable status
- **WHEN** a synchronization cycle fails
- **THEN** the Settings dialog's `Sync` tab MUST show that sync is in an error state
- **AND** the Settings dialog's `Sync` tab MUST show the most recent error using `code` and `message`
- **AND** the user MUST still be able to trigger `Sync now`
