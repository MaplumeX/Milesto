## 1. SearchPanel UI (Centered Scrim Modal)

- [x] 1.1 Add `SearchPanel` overlay component (centered scrim modal) that reuses existing `.palette-overlay` / `.palette` styles
- [x] 1.2 Implement SearchPanel open/close state, autofocus on open, and dismissal via `Escape` and scrim click (outside click)
- [x] 1.3 Implement debounced search calling `window.api.task.search(query, { includeLogbook: false })` and render results list
- [x] 1.4 Implement keyboard navigation (ArrowUp/ArrowDown highlight, Enter selects) and on selection: navigate to owning view + select task + close panel
- [x] 1.5 Ensure SearchPanel is search-only: no command list and Enter MUST NOT create tasks when results are empty

## 2. Wire Bottom Bar Search To SearchPanel

- [x] 2.1 Replace `milesto:ui.openCommandPalette` usage with a new `milesto:ui.openSearchPanel` event
- [x] 2.2 Update `src/app/ContentBottomBarActions.tsx` Search button to dispatch `milesto:ui.openSearchPanel` (and close any active popover first)
- [x] 2.3 Mount `SearchPanel` in `src/app/AppShell.tsx` so it is always available (via portal to `document.body`)

## 3. Remove CommandPalette + Shortcut + Settings Copy

- [x] 3.1 Remove `src/app/CommandPalette.tsx` and its `<CommandPalette />` mount; ensure no remaining imports/references
- [x] 3.2 Remove `Cmd/Ctrl+K` shortcut behavior (no global keydown listener for opening any panel)
- [x] 3.3 Remove/update Settings UI that advertises command palette shortcut, and remove obsolete i18n keys/messages (`settings.commandPaletteShortcut`, `commandPalette.*`)

## 4. Task Search Prefix/Partial Matching (FTS5)

- [x] 4.1 Update DB Worker `task.search` to convert user query into a safe FTS5 prefix query (token -> `"token"*`, escape quotes, join by space)
- [x] 4.2 Ensure non-searchable input returns `ok: true` with an empty list (no `SEARCH_FAILED` for malformed MATCH)
- [x] 4.3 Verify SearchPage (`/search`) still works and now benefits from prefix/partial matching; confirm `include_logbook` behavior is unchanged

## 5. Verification

- [x] 5.1 Update `src/app/selfTest.ts` assertions for: clicking bottom bar Search opens SearchPanel and focuses input; `Escape` and scrim click close it; Enter navigates and closes
- [x] 5.2 Run `npx tsc -p tsconfig.json` and `npm run build`; fix any new TypeScript/build errors
- [x] 5.3 Manual smoke: open SearchPanel, type prefix, arrow/enter select, verify no task is created from query, and verify no `Cmd/Ctrl+K` behavior remains

## 6. Docs / Spec Alignment

- [x] 6.1 Update `docs/prd/01-v0.1-mvp.md` and `docs/tech-framework.md` (or add an ADR) to reflect removal of Command Palette and `Cmd/Ctrl+K`, to prevent spec/implementation drift
