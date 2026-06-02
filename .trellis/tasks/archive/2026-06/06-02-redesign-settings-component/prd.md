# Redesign Settings Component

## Goal

Redesign the settings dialog from a flat tab-based modal to a sidebar-navigated, polished panel that extends Milesto's refined Things 3-inspired aesthetic — calm, intentional, detail-oriented.

## Requirements

- **Sidebar + content layout**: Replace flat tabs with left sidebar (icon + label nav items) and right content panel
- **Sidebar nav items**: General (Settings icon) + Sync (Cloud icon) using lucide-react
- **Segmented control** for theme selection (Light / Dark / Auto) instead of dropdown
- **Grouped card sections** with subtle inner borders, replacing flat row dividers
- **Smooth panel crossfade** when switching between sidebar sections (framer-motion)
- **Staggered entrance animation** on dialog open (framer-motion)
- **Refined micro-details**: polished hover/active states, refined input styling
- **All existing functionality preserved**: language, theme, font size, export/import, reset, sync — identical IPC calls and data flow
- **Sidebar structure extensible by design** (easy to add future sections), but no placeholder items

## Acceptance Criteria

- [ ] Settings dialog opens with sidebar (General + Sync) and content panel
- [ ] Clicking sidebar items switches content panel with smooth transition
- [ ] Theme selector is a segmented control (Light / Dark / Auto)
- [ ] Setting sections use grouped card styling
- [ ] Dialog has entrance animation on open
- [ ] All current settings work identically (language, theme, font size, data, sync)
- [ ] Visual consistency with the rest of Milesto's design (uses existing CSS variables)
- [ ] Dark mode fully supported

## Definition of Done

- Lint / typecheck green
- Visual consistency with existing app aesthetic
- All existing settings functional
- Dark mode correct

## Out of Scope

- New settings options or features
- Backend / IPC changes
- Other components or dialogs
- Narrow-window responsive collapse (sidebar icon-only mode)
- Keyboard shortcut / notification placeholder items

## Technical Approach

- **framer-motion** for AnimatePresence panel transitions + staggered entrance
- **lucide-react** for sidebar nav icons (Settings, Cloud)
- CSS variables from `:root` (both light + dark) reused for all theming
- Dialog width expands to ~780px to accommodate sidebar + content
- New segmented control built inline (small component, not worth a separate file)

## Technical Notes

- `framer-motion` ^12.34.3 and `lucide-react` ^1.17.0 are existing dependencies
- Existing CSS variables: `--paper`, `--glass`, `--border`, `--text`, `--muted`, `--wash`, `--shadow-sheet`, etc.
- `overlay-paper-in` keyframe animation already defined for modal entrance
- Current dialog: 680px wide, new: ~780px to fit sidebar
- Sidebar nav items map directly to current `activeTab` state ('general' | 'sync')
