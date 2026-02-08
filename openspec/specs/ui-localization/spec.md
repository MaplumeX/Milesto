# ui-localization Specification

## Purpose
TBD - created by archiving change i18n-support. Update Purpose after archive.
## Requirements
### Requirement: Core UI strings are localized via translation keys
The system SHALL render user-facing strings in the React UI using translation keys backed by locale-specific message catalogs.

At minimum, the following UI areas MUST be localized for `en` and `zh-CN`:

- App navigation labels (Inbox/Today/Upcoming/Anytime/Someday/Logbook/Settings)
- Settings page headings and actions
- Search page heading and input placeholder

#### Scenario: Navigation labels reflect the active locale
- **WHEN** the effective locale is `zh-CN`
- **THEN** the navigation labels are displayed in Chinese

### Requirement: Missing translations fall back to English
If a translation key is missing for the active locale, the system MUST fall back to the English (`en`) value for that key.

#### Scenario: Key missing in zh-CN uses en fallback
- **WHEN** the effective locale is `zh-CN` and a translation key is missing in `zh-CN`
- **THEN** the UI displays the `en` translation for that key

### Requirement: Main-process import/export dialogs are localized
The system SHALL localize the Electron Main native file dialogs used for data export and import.

This MUST include:

- Export save dialog title
- Import open dialog title
- File type filter label for JSON

#### Scenario: Export dialog title is localized
- **WHEN** the effective locale is `zh-CN` and the user triggers data export
- **THEN** the save dialog title is displayed in Chinese

#### Scenario: Import dialog filter label is localized
- **WHEN** the effective locale is `zh-CN` and the user triggers data import
- **THEN** the file type filter label for JSON is displayed in Chinese

### Requirement: Self-test mode is stable under i18n
In self-test mode, the system SHALL use a deterministic locale to avoid flakiness in tests that locate elements by visible text.

#### Scenario: Self-test runs in English
- **WHEN** the app is launched in self-test mode
- **THEN** the effective locale is forced to `en` regardless of persisted preference

