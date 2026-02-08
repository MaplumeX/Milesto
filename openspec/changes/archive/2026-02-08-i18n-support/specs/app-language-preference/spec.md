## ADDED Requirements

### Requirement: Effective locale is resolved deterministically
The system SHALL determine an effective locale for the application from the following sources, in priority order:

1. A persisted user preference (if present and valid)
2. The system locale (normalized)
3. A built-in fallback locale (`en`)

The effective locale MUST always be one of the supported locales: `en`, `zh-CN`.

#### Scenario: Persisted locale is applied on startup
- **WHEN** the app starts and the persisted locale is `zh-CN`
- **THEN** the effective locale is `zh-CN`

#### Scenario: Unsupported persisted locale falls back safely
- **WHEN** the app starts and the persisted locale is not in the supported locale list
- **THEN** the system uses a normalized system locale if supported, otherwise `en`

### Requirement: User can change language from Settings
The system SHALL provide a language selector in the Settings page that displays the current effective locale and allows selecting any supported locale.

Selecting a locale MUST update the effective locale without requiring an app restart.

#### Scenario: User switches from English to Chinese
- **WHEN** the user selects `zh-CN` in Settings
- **THEN** the UI updates to render localized strings in `zh-CN`

### Requirement: Locale preference is persisted across restarts
The system SHALL persist the selected locale so the same locale is used after restarting the application.

The persisted locale MUST be stored using a validated, allowlisted value.

#### Scenario: Language choice survives restart
- **WHEN** the user selects `zh-CN` and restarts the app
- **THEN** the effective locale is `zh-CN` on the next launch
