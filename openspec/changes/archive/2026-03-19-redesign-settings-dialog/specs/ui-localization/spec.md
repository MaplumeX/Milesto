## MODIFIED Requirements

### Requirement: Core UI strings are localized via translation keys
The system SHALL render user-facing strings in the React UI using translation keys backed by locale-specific message catalogs.

At minimum, the following UI areas MUST be localized for `en` and `zh-CN`:

- App navigation labels (Inbox/Today/Upcoming/Anytime/Someday/Logbook/Settings)
- Settings dialog title, tab labels, headings, and actions
- Search page heading and input placeholder

#### Scenario: Navigation labels reflect the active locale
- **WHEN** the effective locale is `zh-CN`
- **THEN** the navigation labels are displayed in Chinese
