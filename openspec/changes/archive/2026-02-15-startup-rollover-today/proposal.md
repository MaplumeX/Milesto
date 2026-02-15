## Why

Milesto currently treats the Today view as a strict derived filter: it shows only open tasks where `scheduled_at = <local today>`.
This creates two user-facing problems:

- If a task was scheduled for a previous day and left incomplete, it falls out of Today and is also excluded from Upcoming (`scheduled_at > today`) and Anytime (`scheduled_at IS NULL`), effectively disappearing from the user's primary planning views.
- Several renderer surfaces memoize the local `today` string at component mount, so keeping the app open across midnight can cause "set to Today" actions to write yesterday's date.

This change makes "Today" usable as a daily carry-over list by automatically rolling past scheduled open tasks forward to today at app startup, and ensures UI actions always compute the correct local today.

## What Changes

- At app startup, automatically roll over all open tasks with `scheduled_at < today` to `scheduled_at = today`.
- Persist rollover idempotence for the current day (optional optimization) to avoid repeated work on every startup.
- In the renderer, replace mount-time memoized `today` values with a realtime local-today source that updates at local midnight.
- Ensure "Today" actions (schedule buttons) compute `today` at the moment of the click, not at component mount.

## Capabilities

### New Capabilities
- `task-scheduled-rollover`: Startup rollover semantics for past scheduled open tasks.

### Modified Capabilities
- `content-bottom-bar-actions`: Schedule popover's `Today` action must use the current local date and remain correct across midnight.
- `search-panel`: Task hinting and navigation decisions that depend on "today" must use the current local date (not a stale mount-time value).
- `task-inline-editor`: Inline editor schedule `Today` action must use the current local date and remain correct across midnight.

## Impact

- Electron main startup flow (`electron/main.ts`) will trigger a DB worker action before creating the renderer window.
- DB worker will gain a new action to update tasks in a transaction and update `updated_at`.
- Shared schemas may gain a small input schema for the rollover action and (optionally) an app_settings key.
- Renderer surfaces that currently memoize `today` at mount will switch to a realtime local-today source.
- No new third-party dependencies are expected.
