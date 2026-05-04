# Research: Lucide Icon Mapping for Bottom Bar

- **Query**: Find best Lucide icon names for 8 bottom bar actions in a task management app
- **Scope**: External (Lucide icon library) + Internal (existing icon definitions)
- **Date**: 2026-05-05

## Findings

### Recommended Icon Mapping

| Bottom Bar Key | Action | Current SVG Pattern | Lucide Icon Name | Import Name | Rationale |
|---|---|---|---|---|---|
| `task` | Add new task | Circle with plus (circle cx=12 cy=12 r=8, plus cross inside) | `CirclePlus` | `CirclePlus` | Exact visual match. Circle r=10 with plus inside. The current custom SVG is already identical to this Lucide icon. |
| `project` | Add new project | Folder with plus | `FolderPlus` | `FolderPlus` | Exact semantic match. Folder outline with a plus sign inside. Matches the current custom SVG pattern precisely. |
| `section` | Add new section | Three horizontal lines with plus | `ListPlus` | `ListPlus` | Best semantic fit. Three horizontal lines (list items) with a plus appended. Matches the current custom SVG (lines + plus). Note: Lucide's `Section` icon is a section sign (paragraph mark) -- NOT suitable for this use case. |
| `schedule` | Calendar / date picker | Calendar (rect + header lines) | `Calendar` | `Calendar` | Standard calendar icon. Rect with rounded corners, two pegs on top, horizontal divider. Matches the current custom SVG. Alternative: `CalendarDays` (same shape but with dots on the calendar body, more visually detailed). |
| `move` | Move task to another project/area | Bidirectional horizontal arrows | `ArrowRightLeft` | `ArrowRightLeft` | Two horizontal arrows pointing in opposite directions. Visually identical to the current custom SVG. Alternative: `MoveHorizontal` (same concept but arrows are on the same line rather than offset). `ArrowRightLeft` is the more standard choice in productivity apps. |
| `search` | Search | Magnifying glass (circle + handle) | `Search` | `Search` | Standard search icon. Circle r=8 at (11,11) with diagonal handle. Matches the current custom SVG. |
| `delete` | Delete task | Trash can with vertical lines | `Trash2` | `Trash2` | Trash can with lid + two vertical lines inside (representing contents). This matches the current custom SVG which has 3 vertical lines inside the can. Note: Lucide's `Trash` (no "2") has the same can shape but NO interior lines -- less recognizable. `Trash2` is the convention in task apps. |
| `more` | More options | Three horizontal dots (filled circles) | `Ellipsis` | `Ellipsis` | Three horizontal filled circles. Visually identical to the current custom SVG (three r=1.6 circles). Note: `MoreHorizontal` is an alias that re-exports `Ellipsis`. Either name works for the import. |

### Lucide `Section` Icon -- NOT Recommended

The Lucide icon named `Section` renders a section/paragraph sign (an "S"-like curved shape), which is a typographic symbol. This does NOT convey "add a section" in a task management context. Use `ListPlus` instead.

### Calendar vs CalendarDays

- `Calendar`: Clean calendar outline with header and divider line. Simpler, matches the current custom SVG.
- `CalendarDays`: Same shape but with 6 small dots on the calendar body (representing dates). More visually detailed and common in task/scheduling apps.

### ArrowRightLeft vs MoveHorizontal

- `ArrowRightLeft`: Two arrows on separate horizontal lines, pointing in opposite directions. The current custom SVG uses this exact pattern (offset arrows).
- `MoveHorizontal`: A single line with arrowheads on both ends (bidirectional arrow on one line). Simpler but less conventional for "move" actions.

### lucide-react Package Info

| Property | Value |
|---|---|
| npm package name | `lucide-react` |
| Current version | `1.14.0` |
| License | ISC |
| Peer dependencies | `react` |
| Full bundle size (unpacked) | ~30 MB (includes all 1800+ icons) |
| Full bundle size (CJS, minified) | ~614 KB |
| Full bundle gzipped | ~154 KB |
| `sideEffects` | `false` |
| ESM support | Yes (`dist/esm/lucide-react.mjs`) |
| CJS support | Yes (`dist/cjs/lucide-react.js`) |

### Tree-Shaking Support

**Yes, individual icons can be tree-shaken.** The package has `"sideEffects": false` and supports two import patterns:

1. **Named imports from main package (recommended for tree-shaking):**
   ```tsx
   import { CirclePlus, FolderPlus, ListPlus } from 'lucide-react'
   ```
   With a bundler like Vite/Rollup, unused icons are eliminated because each icon is a separate ESM re-export from its own file (`./icons/circle-plus.mjs`, etc.).

2. **Deep imports from individual icon files:**
   ```tsx
   import CirclePlus from 'lucide-react/dist/esm/icons/circle-plus'
   ```
   This works but is not the recommended pattern (more brittle to internal package restructuring).

When tree-shaking is active (Vite default), importing 8 icons should result in approximately:
- ~8 icon components (each ~300-500 bytes)
- + shared `createLucideIcon` runtime (~1-2 KB)
- Total: ~5-6 KB gzipped for the 8 icons, NOT the full 154 KB bundle

### Files Found (Internal)

| File Path | Description |
|---|---|
| `src/app/bottom-bar-icons.tsx` | Current bottom bar icon definitions (8 custom inline SVGs) |
| `src/app/BottomBarActionButton.tsx` | Component that renders bottom bar icons via `getBottomBarIconDefinition()` |
| `src/app/ContentBottomBarActions.tsx` | Container component for bottom bar action buttons |
| `src/app/AppShell.tsx` | Main shell that uses `BottomBarActionButton` with `iconKey` props |
| `src/app/sidebar-nav-icons.tsx` | Sidebar icon definitions (similar pattern, also custom inline SVGs) |

### Code Patterns

The current icon system uses:
- A `Record<string, IconDefinition>` pattern (`BOTTOM_BAR_ICON_DEFINITIONS`)
- Each definition contains an `icon: ReactNode` field with an inline `<svg>` element
- Icons are accessed via `getBottomBarIconDefinition(iconKey)` with type-safe keys (`BottomBarIconKey`)
- All SVGs use `viewBox="0 0 24 24"`, `width="1em"`, `height="1em"`, `stroke="currentColor"`, `strokeWidth={1.8}`
- Lucide icons use the same 24x24 viewBox convention, `stroke="currentColor"`, and `strokeWidth=2` by default (slightly thicker than the current 1.8)

### External References

- [Lucide Icons Official Site](https://lucide.dev/icons) -- Browse all available icons
- [lucide-react on npm](https://www.npmjs.com/package/lucide-react) -- Package registry
- [Lucide GitHub](https://github.com/lucide-icons/lucide) -- Source code and documentation
- [Lucide React Docs](https://lucide.dev/guide/install/react) -- React-specific usage guide

### Import Example (for 8 bottom bar icons)

```tsx
import {
  CirclePlus,
  FolderPlus,
  ListPlus,
  Calendar,
  ArrowRightLeft,
  Search,
  Trash2,
  Ellipsis,
} from 'lucide-react'
```

All icons accept standard SVG props including `size`, `color`, `strokeWidth`, and `className`.

## Caveats / Not Found

- Lucide default `strokeWidth` is 2, while the current custom SVGs use 1.8. This will produce slightly bolder strokes. Can be overridden via `strokeWidth={1.8}` prop if pixel-perfect matching is desired.
- The current `more` icon uses `fill="currentColor"` (solid dots) while Lucide's `Ellipsis` also uses filled circles, so they match.
- The project does not currently use any icon library (all icons are custom inline SVGs). Adding `lucide-react` would be a new dependency.
- The sidebar icons (`sidebar-nav-icons.tsx`) also use custom inline SVGs with the same pattern, so a future migration could consolidate those too.
