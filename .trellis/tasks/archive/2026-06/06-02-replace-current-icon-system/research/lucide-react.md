# Research: Lucide React Icon Library for Migration

- **Query**: Lucide React icon library details for migration from custom inline SVG icons
- **Scope**: Mixed (internal codebase analysis + external package investigation)
- **Date**: 2026-06-02

## Findings

### Package Information

| Field | Value |
|---|---|
| Package name | `lucide-react` (the only valid package; `@lucide/react` returns 404 on npm) |
| Current version | 1.17.0 |
| License | ISC |
| Homepage | https://lucide.dev |
| Total icons | 3,924 |
| Peer dependencies | `react: ^16.5.1 \|\| ^17.0.0 \|\| ^18.0.0 \|\| ^19.0.0` |
| Runtime dependencies | None (zero deps) |
| Unpacked size | ~30 MB (full package; tree-shaking critical) |
| ESM entry | `dist/esm/lucide-react.mjs` |
| CJS entry | `dist/cjs/lucide-react.js` |

### Tree-Shaking Support

- Each icon is a **separate ESM file** under `dist/esm/icons/<name>.mjs` (~450-650 bytes per icon file).
- Individual named exports: `import { Inbox } from 'lucide-react'` -- bundlers (Vite/rollup) resolve these to the individual icon module files, so only imported icons are included in the bundle.
- The main entry `lucide-react.mjs` re-exports all icons, but tree-shaking works when importing specific named exports.
- Core runtime per icon: `createLucideIcon.mjs` (960 B) + `Icon.mjs` (1,778 B) + `defaultAttributes.mjs` (493 B) + `context.mjs` + shared utils ~ ~4 KB shared baseline.
- **Do NOT** use `import * as icons from 'lucide-react'` as that defeats tree-shaking.

### API Pattern

#### Import and Usage

```tsx
// Named import (tree-shakeable)
import { Inbox, Clock, Trash2 } from 'lucide-react'

// Usage as component
<Inbox />
<Inbox size={20} />
<Inbox size="1em" />
<Clock color="red" strokeWidth={1.8} className="my-icon" />
```

#### Component Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `size` | `number \| string` | `24` | Width and height of the SVG |
| `color` | `string` | `"currentColor"` | Stroke color |
| `strokeWidth` | `number` | `2` | Stroke width |
| `absoluteStrokeWidth` | `boolean` | `false` | If true, strokeWidth scales proportionally with size |
| `className` | `string` | `""` | CSS class (merged with `lucide` + `lucide-<name>` base classes) |

#### Context Provider (LucideProvider)

```tsx
import { LucideProvider } from 'lucide-react'

<LucideProvider size="1em" strokeWidth={1.8} color="currentColor">
  <App />
</LucideProvider>
```

All icons within the provider inherit these defaults, overridable per-icon.

### Default SVG Attributes (from `defaultAttributes.mjs`)

```js
{
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
}
```

Key points:
- **Default strokeWidth = 2**, strokeLinecap = "round", strokeLinejoin = "round" -- matches current codebase convention.
- **Default size = 24x24** (pixel number, not "1em").
- The `Icon` component auto-adds `aria-hidden="true"` when no accessibility props are present on the icon.
- The component auto-merges CSS classes: `lucide`, `lucide-<kebab-name>`, plus any user `className`.

### Sizing: "1em" Support

Current codebase uses `width="1em" height="1em"` on all icons. Lucide accepts `size="1em"` to achieve the same:

```tsx
// Current custom approach
<svg viewBox="0 0 24 24" width="1em" height="1em" ...>

// Lucide equivalent
<Inbox size="1em" />
```

When `size="1em"` is passed, both `width` and `height` are set to `"1em"`. This works correctly.

Alternative: Use `LucideProvider` to set `size="1em"` globally for the app.

---

### Icon-by-Icon Mapping: Custom SVG vs Lucide

#### Sidebar Nav Icons (`src/app/sidebar-nav-icons.tsx`)

| Custom Icon | Custom strokeWidth | Lucide Match | Lucide Name | Path Comparison |
|---|---|---|---|---|
| inbox | 1.8 | YES | `Inbox` | Different path shape. Custom is a rounded rect + inner line; Lucide uses polyline + path for trapezoid inbox shape. Visually similar but not identical. |
| today (clock) | 1.8 | YES | `Clock` | Similar structure (circle + clock hands). Custom: r=8, hands at 8.5/3.5/2.75. Lucide: r=10, hands at 6/6/4. Proportional but slightly different proportions. |
| upcoming (calendar) | 1.8 | YES | `Calendar` | Very close match. Custom: rect(4,5,16,15,rx=2). Lucide: rect(3,4,18,18,rx=2). Minor coordinate shift; both have header lines and separation line. |
| anytime (globe) | 1.8 | CLOSE | `Globe` | Custom has meridian ellipse pattern ("M12 4c2.7 2.4 4.2 5.1 4.2 8S14.7 17.6 12 20c-2.7-2.4-4.2-5.1-4.2-8S9.3 6.4 12 4z"). Lucide Globe: circle r=10 + equator line + single vertical meridian ellipse. Different visual -- custom has a more detailed globe with visible longitude lines. See "No Direct Match" section. |
| someday (arrow-up + underline) | 1.8 | YES | `ArrowUpFromLine` | Nearly exact match. Custom: "M12 6.5v10.5" + "M8.5 10 12 6.5 15.5 10" + "M7.5 17h9". Lucide: "m18 9-6-6-6 6" + "M12 3v14" + "M5 21h14". Same conceptual shape (up arrow + baseline) with minor coordinate differences. |
| logbook (book with lines) | 1.8 | PARTIAL | `BookOpen` or `Notebook` | Custom: book spine (rect) + 3 horizontal lines. Lucide `BookOpen`: open book shape (different). Lucide `Notebook`: notebook with spiral binding (different). Neither is a close visual match. |
| trash | 1.8 | YES | `Trash2` | Very close match. Both have lid, bin body, and vertical lines inside. Minor coordinate differences due to Lucide using r=10 circle convention vs custom r=8. |

#### Bottom Bar Icons (`src/app/bottom-bar-icons.tsx`)

| Custom Icon | Custom strokeWidth | Lucide Match | Lucide Name | Notes |
|---|---|---|---|---|
| task (circle + plus) | 1.8 | YES | `CirclePlus` | Same structure: circle + horizontal + vertical lines. Custom r=8, Lucide r=10. |
| project (folder + plus) | 1.8 | YES | `FolderPlus` | Same concept. Custom has tab on folder. Lucide has similar folder shape. Visually close. |
| section (list lines + plus) | 1.8 | YES | `ListPlus` | Same concept: horizontal list lines + a plus sign. Slightly different layout. |
| schedule (calendar) | 1.8 | YES | `Calendar` | Same as upcoming icon. |
| move (bidirectional arrows) | 1.8 | YES | `ArrowRightLeft` | Same concept. Custom: horizontal arrows pointing right (top) and left (bottom). Lucide ArrowRightLeft: identical concept, nearly identical path structure ("m16 3 4 4-4 4" + "M20 7H4" + "m8 21-4-4 4-4" + "M4 17h16"). |
| search | 1.8 | YES | `Search` | Very close. Custom: circle cx=11 cy=11 r=6.5 + "m16 16 4 4". Lucide: circle cx=11 cy=11 r=8 + "m21 21-4.34-4.34". Same visual. |
| delete (trash) | 1.8 | YES | `Trash2` | Same as sidebar trash. |
| more (three dots) | 1.8 (fill) | YES | `Ellipsis` | Custom uses filled circles (r=1.6 at cx=6.5,12,17.5). Lucide uses filled circles (r=1 at cx=5,12,19). Custom uses `fill="currentColor"` (no stroke), Lucide Ellipsis uses `fill="currentColor"` for the circles. Visually very similar. |

#### Popover Menu Icons (`src/components/popover-menu-icons.tsx`)

| Custom Icon | Custom strokeWidth | Lucide Match | Lucide Name | Notes |
|---|---|---|---|---|
| BackMenuIcon (chevron-left) | 1.9 | YES | `ChevronLeft` | Exact match. "m15 18-6-6 6-6" same in both. |
| CancelMenuIcon (circle-x) | 1.9 | YES | `CircleX` | Same structure: circle + two diagonal lines. Custom r=8, Lucide r=10. |
| ConvertMenuIcon (two overlapping rects + arrow) | 1.9 | NO DIRECT | None | Two overlapping rectangles with a diagonal arrow. No Lucide icon matches this pattern. See "No Direct Match" section. |
| DeleteMenuIcon (trash) | 1.9 | YES | `Trash2` | Same as other trash icons. |
| DoneMenuIcon (circle-check) | 1.9 | YES | `CircleCheck` | Same structure. Custom: "m8.5 12.5 2.3 2.3 4.7-5.3". Lucide: "m9 12 2 2 4-4". Proportional differences (r=8 vs r=10). |
| DueMenuIcon (clock) | 1.9 | YES | `Clock` | Same as today icon. Custom: "M12 7.5V12l3 2". Lucide: "M12 6v6l4 2". |
| MoveMenuIcon | 1.9 | YES | `ArrowRightLeft` | Same as bottom bar move. |
| OpenMenuIcon (file with arrow) | 1.9 | YES | `ExternalLink` | Same concept. Lucide ExternalLink: "M15 3h6v6" + "M10 14 21 3" + rect with arrow. Custom: "M5 19h14V9h-5V5H5z" + "M14 5h5v5" + "m13 11 6-6". |
| RenameMenuIcon (pencil) | 1.9 | YES | `Pencil` | Same concept. Lucide Pencil: pencil with line. Custom: "M4 20h4.5L18.5 10a2.8 2.8 0 0 0-4-4L4.5 16H4z" + "m13.5 7.5 3 3". Visually similar. |
| RestoreMenuIcon (undo arrow) | 1.9 | YES | `RotateCcw` | Same concept. Custom: arc + arrow. Lucide: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" + "M3 3v5h5". |
| ScheduleMenuIcon (calendar) | 1.9 | YES | `Calendar` | Same as other calendar icons. |
| TagMenuIcon | 1.9 | YES | `Tag` | Same concept. Different path precision (Lucide uses curve-based path, custom uses simplified lines). |

#### Task Metadata Icons (`src/features/tasks/task-metadata-icons.tsx`)

| Custom Icon | Custom strokeWidth | Lucide Match | Lucide Name | Notes |
|---|---|---|---|---|
| CalendarIcon | 2 | YES | `Calendar` | Same as other calendar icons. |
| ClockIcon | 2 | YES | `Clock` | Custom: r=9 + "M12 7v5l3 3". Lucide: r=10 + "M12 6v6l4 2". Same pattern. |
| TagIcon | 2 | YES | `Tag` | Same as popover TagMenuIcon. |
| ChevronDownIcon | 2.2 | YES | `ChevronDown` | Exact match. "M6 9l6 6 6-6" same in both. |
| SunIcon | 2 | YES | `Sun` | Same concept: circle + 8 radiating lines. Visually identical. |
| TodayIcon (calendar + check) | 2 | YES | `CalendarCheck` | Lucide CalendarCheck: calendar + check mark ("m9 16 2 2 4-4"). Custom: calendar + "M9 15l2 2 4-4". Nearly identical. |
| NoteIcon (document with lines) | 2 | YES | `FileText` | Same concept. Custom: path + polyline + lines. Lucide: curved path + lines. Visually similar. |
| CircleXIcon | 2 | YES | `CircleX` | Same as CancelMenuIcon. |

#### Other In-File Icons

| Location | Icon | Lucide Match | Notes |
|---|---|---|---|
| `AppShell.tsx:1780` | Folder icon (project sidebar) | `Folder` | strokeWidth=1.7. Path: "M3 7.5c0-1.1.9-2 2-2h5l2 2h7...". Lucide Folder: similar shape. |
| `AppShell.tsx:1797` | Sidebar chevron (20x20 viewBox) | `ChevronDown` (in 20x20) | strokeWidth=2, viewBox="0 0 20 20". Cannot directly use Lucide here since it's a different viewBox. |
| `Checkbox.tsx` | Check/X marks | NO | Custom 12x10 viewBox, strokeWidth=1.7. Checkbox marks are too small/specific for Lucide. |
| `Select.tsx` | Chevron (10x10 viewBox) | NO | Custom 10x6 viewBox. Too small for Lucide. |
| `TagPicker.tsx` | Search (16x16) + Plus | NO | Custom 16x16 and 12x12 viewBoxes with strokeWidth=1.5. |
| `AreaPage.tsx:625` | Folder icon | `Folder` | Same as AppShell folder. strokeWidth=1.7. |

---

### Icons Without Direct Lucide Match

#### 1. "anytime" (Globe with meridian lines)

Custom paths:
```
circle cx=12 cy=12 r=8 (approx, from "M12 4c4.4 0 8 3.6 8 8s-3.6 8-8 8-8-3.6-8-8 3.6-8 8-8z")
"M4 12h16"
"M12 4c2.7 2.4 4.2 5.1 4.2 8S14.7 17.6 12 20c-2.7-2.4-4.2-5.1-4.2-8S9.3 6.4 12 4z"
```
This is a globe with equator line + an elliptical meridian showing both hemispheres.

Lucide `Globe`: circle r=10 + equator line + single vertical ellipse. The meridian rendering differs -- Lucide shows a full ellipse, custom shows a more complex point-based curve. Visually similar from a distance but not identical. **Acceptable substitute** for most use cases.

Also consider: Lucide `Earth` (more detailed with continent outlines -- probably too complex for a nav icon).

#### 2. "convert" (Two overlapping rectangles with diagonal arrow)

Custom paths:
```
"M5 7h6v6H5z" (top-left rect)
"M13 11h6v6h-6z" (bottom-right rect)
"m11 10 2 2" (connecting line)
"m13 9v3h-3" (arrow pointing into bottom-right rect)
```

No Lucide icon has this exact pattern. Closest candidates:
- `SquareStack`: three overlapping squares, no arrow.
- `SquaresIntersect`: overlapping rounded squares, no arrow.
- `Copy`: two overlapping documents, no arrow.
- `ArrowRightLeft`: bidirectional arrows, no squares.

**No direct match. Would need a custom icon or combine Lucide primitives.**

#### 3. "logbook" (Book with horizontal lines)

Custom paths:
```
"M7 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" (book cover)
"M9 8h6M9 12h6M9 16h4" (3 text lines)
```

Lucide close matches:
- `BookOpen`: open book with visible pages, no text lines. Different visual.
- `Notebook`: notebook with spiral binding on the left. Different visual.
- `BookText` or `Book`: single book, no text lines.
- `FileText`: document with lines, but not a book shape.

**Closest Lucide substitute: `Notebook` (different but conceptually similar) or `BookOpen`. Neither is a pixel-perfect match.**

#### 4. "section" (List + plus)

Custom paths:
```
"M5 7h9M5 12h7M5 17h9" (3 list lines, varying lengths)
"M17 10v6M14 13h6" (plus sign)
```

Lucide `ListPlus`:
```
"M16 5H3" + "M11 12H3" + "M16 19H3" (3 list lines, left-aligned)
"M18 9v6" + "M21 12h-6" (plus sign)
```

**Conceptually identical.** The list lines in Lucide are left-aligned with content on the right; custom lines are left-aligned with varying right extent. The plus position differs slightly. Visually very close.

### strokeWidth Differences Summary

Current codebase uses multiple strokeWidth values:
- **1.5**: TagPicker search (16x16 viewBox), Select chevron (10x10)
- **1.7**: Checkbox marks (12x10), Folder icons in AppShell/AreaPage
- **1.8**: All sidebar nav icons, all bottom bar icons
- **1.9**: All popover menu icons
- **2.0**: Task metadata icons (Calendar, Clock, Tag, Sun, Note, CircleX)
- **2.2**: ChevronDown in task metadata
- **2.4**: ProjectProgressControl

Lucide default: **strokeWidth=2** with `absoluteStrokeWidth` option to keep stroke proportional at smaller sizes.

To migrate, either:
1. Pass `strokeWidth={1.8}` per icon (or use `LucideProvider`), or
2. Accept Lucide's default of 2 (visually very close to 1.8 at 1em size).

### Export Aliases

Lucide provides three naming conventions per icon (since v1.17.0):
- Default name: `Inbox`, `Clock`, `Trash2`
- Alias with `Icon` suffix: `InboxIcon`, `ClockIcon`, `Trash2Icon`
- Alias with `Lucide` prefix: `LucideInbox`, `LucideClock`, `LucideTrash2`

This means the current codebase's `ClockIcon` name can be satisfied by `ClockIcon` from Lucide.

---

### Current Custom Icon Files (Internal)

| File Path | Description |
|---|---|
| `src/app/sidebar-nav-icons.tsx` | 7 sidebar nav icons (inbox, today, upcoming, anytime, someday, logbook, trash) |
| `src/app/bottom-bar-icons.tsx` | 8 bottom bar icons (task, project, section, schedule, move, search, delete, more) |
| `src/components/popover-menu-icons.tsx` | 11 popover menu icons (back, cancel, convert, delete, done, due, move, open, rename, restore, schedule, tag) |
| `src/features/tasks/task-metadata-icons.tsx` | 8 task metadata icons (calendar, clock, tag, chevron-down, sun, today, note, circle-x) |
| `src/app/AppShell.tsx` (lines ~1780, 1797) | 2 inline icons (folder, sidebar chevron) |
| `src/pages/AreaPage.tsx` (line ~625) | 1 inline folder icon |
| `src/components/Checkbox.tsx` | 2 inline checkbox mark SVGs (check + x marks in 12x10 viewBox) |
| `src/components/Select.tsx` | 2 inline chevron SVGs (10x10 viewBox) |
| `src/features/tags/TagPicker.tsx` | 2 inline SVGs (search 16x16, plus 12x12) |
| `src/features/projects/ProjectProgressControl.tsx` | 1 inline progress arc (strokeWidth=2.4) |

Total custom SVG icons across the codebase: approximately **40+ SVG instances**, but many are duplicates of the same icon shape (e.g., trash, calendar, clock appear in multiple files).

## Caveats / Not Found

1. **"convert" icon has no Lucide equivalent.** The two-overlapping-rectangles-with-arrow pattern is unique to this codebase. Will need to remain custom or be redesigned.

2. **"anytime" globe icon** has a close Lucide substitute (`Globe`) but the meridian rendering differs. Acceptable for most use cases but not pixel-identical.

3. **"logbook" icon** has no precise Lucide equivalent. `Notebook` or `BookOpen` are the closest alternatives but differ visually.

4. **Non-24x24 viewboxes** (Checkbox 12x10, Select 10x10, TagPicker 16x16 and 12x12) cannot directly use Lucide icons since Lucide only produces 24x24 viewBox SVGs. These would need to remain custom or be wrapped differently.

5. **The SidebarChevronIcon** in AppShell uses `viewBox="0 0 20 20"` which is a different coordinate system than Lucide's 24x24. Would need testing if `size="1em"` on a Lucide `ChevronDown` produces visually equivalent results.

6. **Lucide auto-adds class names** (`lucide`, `lucide-inbox`, etc.) to every SVG element. If the current CSS targets SVGs by tag name only, these extra classes won't cause issues, but it's worth verifying.

7. **`@lucide/react` does NOT exist** on npm (404). The correct package is `lucide-react`.

8. **Lucide's `Tag` icon** uses a curved path and `fill="currentColor"` on the inner dot, while the custom icon uses explicit small circle + straight-edged path. Visual difference is minor.

9. **Current codebase has no existing `lucide-react` dependency** -- would be a fresh install.

### Related Specs

- `.trellis/spec/` -- no existing icon-related spec found
