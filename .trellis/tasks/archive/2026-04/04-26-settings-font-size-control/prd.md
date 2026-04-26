# Settings Font Size Control

## Goal

Add an app setting that lets users adjust Milesto's font size from Settings so text can be made easier to read without changing the operating system display scale.

## What I Already Know

* The user wants a font size adjustment feature in Settings.
* The app is an Electron/Vite React application with settings UI under `src/features/settings/`.
* General settings currently include language, theme, data actions, and about information.
* Persistent app preferences are stored through `app_settings` via `electron/workers/db/actions/settings-actions.ts`.
* Renderer settings calls flow through `shared/window-api.ts`, `electron/preload.ts`, and IPC handlers in `electron/main.ts`.
* The global baseline font size is currently set in `src/index.css` on `:root` as `font-size: 12px`.
* Theme preference already uses a schema, IPC validation, DB persistence, immediate application, and renderer tests; font size should follow that pattern.

## Assumptions (Temporary)

* Font size should be app-wide, not limited to the task list or editor.
* The default should preserve today's 12px baseline so existing users see no change unless they opt in.
* The setting should apply immediately and persist across restarts.
* The MVP should avoid a wide arbitrary range until the UI has been checked for layout resilience.

## Decisions

* Font size control uses a slider with discrete steps, not a dropdown/select.
* The slider should expose more granularity than the initial four-option preset design.
* The UI should not show raw scale coefficients such as `90%` or `110%`.
* The row label should not show the current size/step beneath "Font size".
* Slider endpoint labels should avoid "more/even/more than" wording; use plain size words such as Small / Large.
* The default step must be visibly marked on or near the slider.
* The default step preserves the current visual scale.

## Requirements (Evolving)

* Add a font size preference to General Settings.
* Present the preference as a discrete slider with multiple steps.
* Do not present raw numeric coefficients in the visible UI.
* Do not show a live current-size description under the setting label.
* Mark the default position so users can return to the baseline size.
* The slider must support normal drag interaction and apply changes while the control value changes.
* Persist the preference in `app_settings`.
* Validate the preference through shared schema types.
* Apply the selected font size immediately in the current renderer session.
* Restore and apply the persisted font size on app startup.
* Include English and Simplified Chinese labels.
* Preserve the current default visual scale.
* Supported MVP steps should include the current default plus multiple smaller/larger steps; target about seven steps unless implementation constraints suggest otherwise.
* Add or update tests covering settings rendering, API mocks/contracts, and persistence/validation where appropriate.

## Acceptance Criteria (Evolving)

* [ ] Settings > General includes a font size control.
* [ ] The font size row has no current-size description below the label.
* [ ] Slider labels avoid "more/even/more than" wording and mark the default size.
* [ ] Dragging/changing the slider updates the app font size.
* [ ] Changing the control updates `document.documentElement` font sizing without restarting.
* [ ] The selected value persists and is loaded the next time the app starts.
* [ ] Invalid persisted values fall back to the default.
* [ ] Existing language/theme settings continue to work.
* [ ] Lint, type-check, and relevant tests pass.

## Definition of Done

* Tests added/updated for the changed behavior.
* Lint / typecheck / CI-relevant checks pass.
* Docs/spec judgment completed before wrap-up.
* Rollout/rollback risk considered; default behavior remains unchanged.

## Out of Scope

* Per-page or per-component font size controls.
* OS-level zoom/display scaling integration.
* User-defined custom CSS.
* Redesigning the Settings dialog layout beyond what this control needs.

## Technical Notes

* Likely files:
  * `src/features/settings/GeneralSettingsPanel.tsx`
  * `src/index.css`
  * `shared/schemas/theme.ts` or a new shared preference schema
  * `shared/schemas/index.ts`
  * `shared/window-api.ts`
  * `electron/preload.ts`
  * `electron/main.ts`
  * `electron/workers/db/actions/settings-actions.ts`
  * `shared/i18n/messages.ts`
  * `tests/renderer/settings-dialog.test.tsx`
  * `tests/renderer/window-api-mock.ts`
  * DB/unit tests if an existing settings action test pattern exists or can be added cheaply
* Existing theme preference is the closest implementation pattern.
* Existing CSS uses many rem/inherited font sizes but also some fixed px font sizes; an app-wide root size still improves most text if implemented with a root variable, but implementation should check obvious px-only hotspots.
