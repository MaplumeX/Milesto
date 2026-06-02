# Replace Current Icon System

## Goal

Replace the current hand-authored inline SVG icon system with Lucide React, improving maintainability, consistency, and design quality across the app.

## Requirements

* Install `lucide-react` and replace all inline SVG icons in icon definition modules with Lucide components
* Use `LucideProvider` at app root to set `size="1em"` globally
* Preserve dictionary-based pattern (sidebar-nav-icons, bottom-bar-icons) — only swap inner SVG elements with Lucide components
* Preserve `PopoverMenuIcon` wrapper pattern — re-export Lucide icons with consistent strokeWidth
* Preserve `className` prop pattern in task-metadata-icons
* Handle icons without direct Lucide match: keep custom SVG for "convert", use `Globe` for "anytime", use `Notebook` for "logbook"
* Non-24x24 viewBox icons (Checkbox, Select, TagPicker, ProjectProgressControl) remain custom — out of scope for this task
* Replace AppShell.tsx and AreaPage.tsx inline Folder/Chevron icons with Lucide equivalents

## Acceptance Criteria

* [ ] All 4 icon definition modules use Lucide icons instead of inline SVGs
* [ ] AppShell.tsx and AreaPage.tsx inline SVGs replaced with Lucide
* [ ] `LucideProvider` wraps the app with `size="1em"` default
* [ ] All existing icon references continue to work without consumer-side changes
* [ ] "convert" icon remains custom (no Lucide match exists)
* [ ] Non-24x24 icons (Checkbox, Select, TagPicker, ProjectProgressControl) untouched
* [ ] Lint and typecheck pass
* [ ] No visual regressions (visual parity or improvement)

## Definition of Done

* Lint / typecheck / CI green
* No bundle size regression (tree-shaking verified)

## Out of Scope

* OS-level app icon (assets/icon.svg + scripts/generate-icon.mjs)
* Electron main process icons (none exist)
* Non-24x24 viewBox icons: Checkbox, Select, TagPicker, ProjectProgressControl
* Changing icon naming conventions or API patterns at consumer level

## Decision (ADR-lite)

**Context**: Current codebase uses ~40 hand-drawn inline SVG icons scattered across multiple files. Adding new icons requires hand-authoring SVG paths, which is error-prone and inconsistent.
**Decision**: Adopt `lucide-react` as the icon library. Keep dictionary-based and wrapper patterns, only swap inner implementations.
**Consequences**: Near-zero consumer-side changes. 3 icons need special handling (convert=custom, anytime=Globe, logbook=Notebook). Non-24x24 icons remain custom. Auto-added `lucide` CSS classes may need verification.

## Research References

* [research/lucide-react.md](research/lucide-react.md) — Full icon-by-icon mapping, API details, caveats

## Technical Notes

### Icon Mapping Summary

**Direct Lucide replacements (35 icons):**
- sidebar: Inbox, Clock, Calendar, Globe, ArrowUpFromLine, Trash2
- bottom bar: CirclePlus, FolderPlus, ListPlus, Calendar, ArrowRightLeft, Search, Trash2, Ellipsis
- popover menu: ChevronLeft, CircleX, Trash2, CircleCheck, Clock, ArrowRightLeft, ExternalLink, Pencil, RotateCcw, Calendar, Tag
- task metadata: Calendar, Clock, Tag, ChevronDown, Sun, CalendarCheck, FileText, CircleX
- inline: Folder, ChevronDown

**Custom retention (1 icon):**
- ConvertMenuIcon — no Lucide equivalent (two overlapping rectangles + arrow)

**Closest substitutes (2 icons):**
- anytime → Lucide `Globe` (meridian rendering differs slightly)
- logbook → Lucide `Notebook` (different visual but conceptually similar)

**Explicitly out of scope (keep custom):**
- Checkbox check/X marks (12x10 viewBox)
- Select chevrons (10x10 viewBox)
- TagPicker search/plus (16x16, 12x12 viewBox)
- ProjectProgressControl arc (strokeWidth=2.4)
- SidebarChevronIcon (20x20 viewBox)

### strokeWidth Strategy
- Use `LucideProvider` with default `strokeWidth={2}` (Lucide default)
- Popover menu icons use `strokeWidth={1.9}` — set per-icon
- Sidebar/bottom bar icons use `strokeWidth={1.8}` — set per-icon
- Task metadata icons use `strokeWidth={2}` — matches Lucide default

### Files Modified
- `src/app/sidebar-nav-icons.tsx` — replace 7 inline SVGs with Lucide components
- `src/app/bottom-bar-icons.tsx` — replace 8 inline SVGs with Lucide components
- `src/components/popover-menu-icons.tsx` — replace 11/12 icons, keep ConvertMenuIcon custom
- `src/features/tasks/task-metadata-icons.tsx` — replace all 8 icons with re-exports from Lucide
- `src/app/AppShell.tsx` — replace Folder and SidebarFolderIcon with Lucide Folder
- `src/pages/AreaPage.tsx` — replace AreaTitleIcon with Lucide Folder
- `src/app/App.tsx` or equivalent root — add `LucideProvider` wrapper
- `package.json` — add `lucide-react` dependency
