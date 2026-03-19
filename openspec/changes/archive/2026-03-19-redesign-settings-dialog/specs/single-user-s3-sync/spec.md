## MODIFIED Requirements

### Requirement: User can configure an optional S3-compatible sync repository
The system MUST allow a user to configure one optional single-user sync repository using:

- `endpoint`
- `region`
- `bucket`
- `prefix`
- `forcePathStyle`
- `accessKeyId`
- `secretAccessKey`
- optional `sessionToken`

The system MUST validate the repository configuration before enabling synchronization.

Non-sensitive repository configuration MUST be persisted locally.

Sensitive credentials MUST be stored in secure local storage and MUST NOT be exposed to the renderer as raw secrets.

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
