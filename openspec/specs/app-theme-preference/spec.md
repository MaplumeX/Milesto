# app-theme-preference Specification

## Purpose
TBD - created by archiving change theme-system. Update Purpose after archive.
## Requirements
### Requirement: Effective theme is resolved deterministically
The system SHALL determine a `ThemePreference` from the following sources, in priority order:

1. A deterministic override in self-test mode
2. A persisted user preference (if present and valid)
3. A default preference of `system`

The system SHALL derive an `EffectiveTheme` (`light` or `dark`) from the `ThemePreference` and the OS theme state.

#### Scenario: Persisted light preference is applied on startup
- **WHEN** the app starts and the persisted theme preference is `light`
- **THEN** the effective theme is `light`

#### Scenario: Persisted dark preference is applied on startup
- **WHEN** the app starts and the persisted theme preference is `dark`
- **THEN** the effective theme is `dark`

#### Scenario: Missing theme preference defaults to system
- **WHEN** the app starts and there is no persisted theme preference
- **THEN** the theme preference is `system`

#### Scenario: Invalid persisted theme preference falls back safely
- **WHEN** the app starts and the persisted theme preference is not `system`, `light`, or `dark`
- **THEN** the theme preference is treated as `system`

#### Scenario: Self-test mode forces a deterministic theme
- **WHEN** the app starts in self-test mode
- **THEN** the effective theme is `light`

### Requirement: User can change theme from Settings
The system SHALL provide a theme selector in the Settings page that displays the current theme preference and allows selecting any supported preference (`system`, `light`, `dark`).

Selecting a preference MUST update the effective theme without requiring an app restart.

#### Scenario: User switches from system to dark
- **WHEN** the user selects `dark` in Settings
- **THEN** the UI updates to render using the dark theme

#### Scenario: User switches from dark to light
- **WHEN** the user selects `light` in Settings
- **THEN** the UI updates to render using the light theme

### Requirement: Theme preference is persisted across restarts
The system SHALL persist the selected theme preference so the same preference is used after restarting the application.

The persisted preference MUST be stored using a validated, allowlisted value.

#### Scenario: Theme choice survives restart
- **WHEN** the user selects `dark` and restarts the app
- **THEN** the theme preference is `dark` on the next launch

### Requirement: System mode follows OS theme changes automatically
When the theme preference is `system`, the UI SHALL follow OS theme changes without requiring a restart.

#### Scenario: OS theme changes while preference is system
- **WHEN** the theme preference is `system`
- **AND WHEN** the OS theme changes from light to dark
- **THEN** the UI updates to render using the dark theme

### Requirement: Native UI elements are compatible with the effective theme
The renderer SHALL declare support for both light and dark color schemes so that native UI elements (e.g., scrollbars and form controls) match the effective theme.

#### Scenario: Effective theme influences native UI rendering
- **WHEN** the effective theme is dark
- **THEN** native UI elements render using a dark color scheme

