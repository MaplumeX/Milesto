## MODIFIED Requirements

### Requirement: User can change theme from Settings
The system SHALL provide a theme selector in the Settings dialog's `General` tab that displays the current theme preference and allows selecting any supported preference (`system`, `light`, `dark`).

Selecting a preference MUST update the effective theme without requiring an app restart.

#### Scenario: User switches from system to dark
- **WHEN** the user selects `dark` in the Settings dialog's `General` tab
- **THEN** the UI updates to render using the dark theme

#### Scenario: User switches from dark to light
- **WHEN** the user selects `light` in the Settings dialog's `General` tab
- **THEN** the UI updates to render using the light theme
