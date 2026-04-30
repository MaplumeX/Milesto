# Custom Confirmation Dialog

## Goal

Replace all native `window.confirm()` calls with a custom-styled confirmation dialog component that matches the app's visual design. This improves UX consistency and enables richer content (e.g., explaining consequences of destructive actions).

## What I already know

* **18** production locations use `window.confirm()` / `confirm()`:
  * `src/app/AppShell.tsx` — delete task
  * `src/app/use-sidebar-entity-context-menu.tsx` — delete area, delete project
  * `src/features/projects/use-project-context-menu.tsx` — delete project
  * `src/features/view-list/use-view-project-completion.ts` — complete project
  * `src/pages/AreaPage.tsx` — complete project, delete area
  * `src/pages/ProjectPage.tsx` — complete project, cancel project, delete project
  * `src/features/tasks/use-project-section-context-menu.tsx` — delete section, archive section
  * `src/features/settings/GeneralSettingsPanel.tsx` — reset settings
  * `src/pages/TrashPage.tsx` — empty trash
  * `src/features/tasks/use-task-context-menu.tsx` — delete task
* `src/app/selfTest.ts` mocks `window.confirm` in multiple places — updated to `__milestoAutoConfirm`
* Existing `SettingsDialog.tsx` provides a working portal/focus-trap/animation pattern:
  * `createPortal` to `document.body`
  * `role="dialog"`, `aria-modal="true"`
  * Focus trap + Escape to close
  * CSS: `--scrim` backdrop, `--paper` background, `--shadow-sheet` elevation
  * `overlay-paper-in` animation
* CSS uses custom properties, not Tailwind. No dedicated UI dialog component exists yet.
* State management uses React Context (`AppEventsContext`, `TaskSelectionContext`, etc.)

## Design Decisions

* **API Style**: Global Context + imperative `await confirm({ ... })` hook
* **UI Style**: Compact centered card (no title bar), message centered, two buttons at bottom (cancel left, confirm right). Danger variant uses red button.
* **Queue support**: Dialog supports multiple queued confirmations (rare but safe)
* **Self-test integration**: `__milestoAutoConfirm` flag auto-accepts in self-test mode

## Requirements

* Replace all 18 `window.confirm()` calls with the new custom dialog
* Dialog must be accessible (focus trap, Escape, Enter to confirm, aria attributes)
* Match app visual style (CSS variables, border-radius, shadows, backdrop)
* Support async/await or Promise-based API for easy migration from synchronous `confirm()`
* Update self-test mocks to work with the new dialog
* i18n: button texts use existing translation keys (`shell.cancel`, `common.delete`, `common.confirm`)

## Acceptance Criteria

* [x] All 18 `window.confirm()` calls replaced with custom dialog
* [x] Dialog renders via Portal, with scrim backdrop and animation
* [x] Focus trap works (Tab cycles within dialog, Escape closes)
* [x] Self-tests pass after migration
* [x] Lint / typecheck pass
* [x] All tests pass (renderer + DB)

## Definition of Done

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Self-tests pass

## Out of Scope (explicit)

* Alert/prompt replacements (only confirm for now)
* Complex multi-step dialogs or forms inside dialogs

## Technical Notes

* Reference: `src/features/settings/SettingsDialog.tsx` — portal, focus trap, CSS patterns
* CSS variables: `--scrim`, `--paper`, `--shadow-sheet`, `--danger-text`, `--danger-border`, `--danger-bg`
* Self-test file: `src/app/selfTest.ts` — search for `window.confirm` mocks
* New file: `src/contexts/ConfirmDialogContext.tsx` — Provider, `useConfirm()` hook, `ConfirmDialog` component
* Test mock: `tests/setup/fast.ts` — mocks `useConfirm` to auto-resolve `true`
