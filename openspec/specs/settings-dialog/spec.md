# settings-dialog Specification

## Purpose
TBD - created by archiving change redesign-settings-dialog. Update Purpose after archive.
## Requirements
### Requirement: Settings entry opens a centered modal dialog without changing the current route
The system MUST expose Settings as a global UI entry that opens a centered modal dialog over the current app surface.

Opening Settings MUST NOT navigate away from the current route or replace the current page content underneath the dialog.

#### Scenario: Clicking the sidebar settings entry opens the dialog in place
- **WHEN** the user is viewing any existing route
- **AND** the user activates the Settings entry from the sidebar
- **THEN** the system opens a centered modal Settings dialog
- **AND** the current underlying route remains unchanged

### Requirement: Settings dialog organizes content as a single general settings surface
The Settings dialog MUST render a fixed top area containing a title and a close control.

The dialog body MUST present the general settings content directly, without a separate Sync tab or sync-specific controls.

The general settings content MUST include language, theme, data transfer actions, and about information.

#### Scenario: Dialog shows general settings directly
- **WHEN** the user opens the Settings dialog
- **THEN** the dialog shows language, theme, data transfer, and about sections directly
- **AND** the dialog does not render a `Sync` tab or any sync configuration content

### Requirement: Settings dialog behaves as a standard modal surface
When the Settings dialog is open, the system MUST lock background interaction and keep keyboard focus within the dialog.

The dialog MUST support closing via:

- the top-right close control
- clicking the scrim outside the dialog surface
- pressing `Escape`

When the dialog closes, the system MUST restore focus to the control that opened it.

#### Scenario: Escape closes the dialog and restores focus
- **WHEN** the Settings dialog is open
- **AND** keyboard focus is inside the dialog
- **AND** the user presses `Escape`
- **THEN** the dialog closes
- **AND** focus returns to the Settings trigger control

#### Scenario: Background content is locked while the dialog is open
- **WHEN** the Settings dialog is open
- **THEN** the user cannot interact with the underlying sidebar or page content
- **AND** keyboard tab order remains trapped inside the dialog
