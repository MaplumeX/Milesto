## Context

- The renderer uses a single global stylesheet: `src/index.css`.
- There is already a small set of global CSS variables (`--bg`, `--panel`, `--text`, `--muted`, `--border`, `--shadow`, `--focus`), but `:root { color-scheme: light; }` is currently hard-coded and many selectors still use hard-coded `rgba(...)` values derived from the light palette.
- The project has an established Settings persistence pattern via DB worker `app_settings` (used for locale preference and sidebar collapsed state).
- Electron security boundaries apply: renderer calls `window.api.*` only; request/response IPC only (`ipcMain.handle` / `invoke`).

## Goals / Non-Goals

**Goals:**
- Provide a user-selectable theme preference: `system`, `light`, or `dark`.
- Persist the preference across restarts using the existing settings storage.
- Apply the preference deterministically on startup, minimizing first-paint theme flash.
- Implement `system` mode that follows OS changes automatically.
- Keep renderer theming primarily CSS-driven via `prefers-color-scheme` and CSS variables (no heavy runtime theming).

**Non-Goals:**
- Full migration to shadcn/ui + Tailwind theme tokens.
- Adding high-contrast or per-platform theme variants beyond the three modes.
- Reworking the entire visual design; the change should be incremental and preserve the existing look in light mode.

## Decisions

1) Drive theme selection via Electron `nativeTheme.themeSource`
- Decision: Set `nativeTheme.themeSource` to `system | light | dark` based on the persisted preference.
- Rationale: This automatically drives the renderer's `@media (prefers-color-scheme: dark)` behavior and avoids inventing a parallel theme toggle mechanism.
- Alternative: Toggle an HTML attribute (e.g. `data-theme`) from the renderer and rely on localStorage. Rejected due to extra complexity, potential boundary leakage, and higher risk of startup flash.

2) Renderer theming uses CSS variables + `prefers-color-scheme`
- Decision: Keep a stable semantic token set in `:root` and override in `@media (prefers-color-scheme: dark)`.
- Rationale: Minimizes JS, works with Chromium's built-in color-scheme propagation, and keeps the UI responsive to system changes when `themeSource=system`.

3) Persist theme preference in `app_settings` with a dedicated key
- Decision: Store `ThemePreference` as a validated allowlisted string, e.g. key `theme.preference`.
- Rationale: Matches existing `settings.getLocale` / `settings.setLocale` pattern; simple and resilient.

4) Avoid push-based IPC for system theme updates
- Decision: No `nativeTheme.updated` -> renderer push notifications are required for correctness.
- Rationale: When `themeSource=system`, Chromium updates `prefers-color-scheme` automatically, so CSS updates are sufficient. Keep IPC request/response only.
- Note: If the renderer wants to show "effective theme" text, it can derive it via `matchMedia('(prefers-color-scheme: dark)')`.

5) Minimize startup flash via early theme resolution and window background
- Decision: Resolve persisted preference in `app.whenReady()` before calling `createWindow()`, then set both `nativeTheme.themeSource` and `BrowserWindow({ backgroundColor })`.
- Rationale: The OS/Electron default window background can flash white before CSS loads, especially on dark systems.

6) Self-test determinism
- Decision: In self-test mode, force a deterministic theme (recommend `light`) regardless of system preference.
- Rationale: Prevent UI assertions from varying by developer machine settings.

## Risks / Trade-offs

- [Risk] Many hardcoded light-only color values exist (rgba whites, text-derived washes, scrims, multi-layer shadows, body gradient, noise overlay).
  -> Mitigation: Introduce a small set of derived tokens (wash/glass/scrim/shadow) and migrate the highest-impact selectors first; keep light mode identical.

- [Risk] Dark mode may require special handling for the noise overlay (`mix-blend-mode: multiply`) and the warm radial background gradient.
  -> Mitigation: Provide explicit dark overrides for those selectors and validate visually.

- [Risk] Windows has separate "app" and "system UI" theme settings; effective behavior may not match user expectations.
  -> Mitigation: Treat `system` mode as "follow app theme" (Electron default). Document this in Settings microcopy if needed.

- [Trade-off] Using `nativeTheme.themeSource` couples theme behavior to Electron/Chromium.
  -> Benefit: It also keeps renderer logic minimal and uses native platform behavior.
