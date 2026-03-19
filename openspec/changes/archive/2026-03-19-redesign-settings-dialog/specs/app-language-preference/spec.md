## MODIFIED Requirements

### Requirement: User can change language from Settings
The system SHALL provide a language selector in the Settings dialog's `General` tab that displays the current effective locale and allows selecting any supported locale.

Selecting a locale MUST update the effective locale without requiring an app restart.

#### Scenario: User switches from English to Chinese
- **WHEN** the user selects `zh-CN` in the Settings dialog's `General` tab
- **THEN** the UI updates to render localized strings in `zh-CN`
