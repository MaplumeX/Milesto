## Context

The Project page already renders a metadata row directly below the title and above notes. The current implementation in `src/pages/ProjectPage.tsx` uses a single chip treatment for:

- project plan (`scheduled_at` / `is_someday`)
- project due date (`due_at`)
- every selected tag returned by `project.getDetail`

Current behavior and constraints:

- Tag order is already meaningful and stable because `project.getDetail` returns ordered tags, as required by `project-area-tags`.
- The metadata row currently renders one chip per tag, with an inline remove button on each visible tag.
- Project tag management already exists inside `ProjectMenu` as a `tags` subview.
- The user wants to preserve the chip-based model rather than replace it with a structured card or field grid.
- The user explicitly chose:
  - no area shown in the metadata row
  - a calmer “A1” visual direction
  - at most 4 visible tags
  - a `+N` overflow summary that opens tag management directly

This is a small renderer-only change, but it spans interaction state, rendering rules, CSS hierarchy, and localized accessible labeling. A design document helps keep the implementation narrow and reuse existing tag-management behavior instead of creating a parallel UI.

## Goals / Non-Goals

**Goals:**

- Keep the metadata row as chips rather than redesigning it into a new surface.
- Increase scanability by treating plan and due as primary metadata, and tags as quieter secondary metadata.
- Preserve ordered tags while limiting the visible tags in the row to 4.
- Add a `+N` summary chip when more than 4 tags exist.
- Make the `+N` summary chip open the existing Project tags management view directly.
- Keep the metadata row limited to plan, due, and tags; do not add area.

**Non-Goals:**

- No backend, schema, IPC, or database changes.
- No change to how plan, due, or tags are persisted.
- No change to tag ordering semantics.
- No new modal, drawer, or standalone tags-management component.
- No redesign of the surrounding Project page layout order (header, meta row, notes, tasks).

## Decisions

### Decision 1: Keep the metadata row as a two-line stack with explicit primary vs secondary chip variants

The metadata row will remain below the title, but its internal layout will be split into stacked lines when tags are present:

- plan and due chips use a “primary metadata” treatment
- plan and due share the first line
- visible tag chips use a quieter “secondary metadata” treatment on a dedicated second line
- the row continues to render only when at least one of plan, due, or tags exists
- the row will not render area, even if `area_id` is set

If a project has only tags and no plan/due, only the tags line is rendered. The distinction should be handled with dedicated CSS classes, not ad hoc inline style overrides.

This keeps the existing mental model intact while making the tag cluster visually subordinate instead of mixing it into the same scan line as scheduling signals.

Alternatives considered:

- **Structured metadata card**: clearer as a data panel, but heavier than the user wants and inconsistent with the existing Project page tone.
- **Divider-based editorial summary row**: visually elegant, but farther from the current interaction model and not the chosen direction.

### Decision 2: Derive a stable metadata-row view model from ordered tags

The metadata row will derive three tag-related values from the ordered `tags` array:

- `visibleTags = tags.slice(0, 4)`
- `overflowCount = max(tags.length - 4, 0)`
- `hasOverflow = overflowCount > 0`

Rendering rules:

- visible tags keep their persisted order
- only the first 4 tags are rendered as removable chips
- when overflow exists, render one trailing `+N` summary chip after the visible tags

This preserves order semantics and avoids introducing hidden reordering or special cases. The summary chip is count-only; it does not attempt to preview hidden tag titles.

Alternatives considered:

- **Show all tags and rely on wrapping**: simplest, but this is the exact noise problem we are trying to reduce.
- **Show only the first 2 tags**: calmer, but the user explicitly chose 4.
- **Tooltip preview of hidden tags**: more complexity without being requested.

### Decision 3: Reuse the existing ProjectMenu tags subview as the `+N` destination

The `+N` chip will not create a new tags-management surface. Instead, clicking it will open the existing `ProjectMenu` directly in the `tags` subview.

To support this cleanly, `ProjectPage` should own a generalized menu state rather than only a boolean `isMenuOpen`. That state should capture:

- whether the menu is open
- which element it is anchored to
- which initial subview to show (`root` or `tags`)

Expected trigger behavior:

- clicking `...` opens the menu at the button anchor in the `root` view
- clicking `+N` opens the same menu logic anchored to the summary chip in the `tags` view
- closing restores focus to whichever trigger opened it

This preserves a single interaction system and avoids maintaining two separate tag-management entrypoints.

Alternatives considered:

- **Always anchor the tags popover to the `...` button**: smaller implementation, but spatially disconnected from the `+N` trigger.
- **Open a separate tags popover from the metadata row**: duplicates logic and increases maintenance cost.

### Decision 4: Visible tag chips keep direct remove, overflow uses management

We will preserve inline remove controls for the visible tag chips. Hidden tags are managed through the `+N` entrypoint.

Semantics:

- plan chip close clears plan
- due chip close clears due
- visible tag chip close removes that tag
- `+N` has no inline remove affordance; it opens the tags-management subview

This is slightly asymmetric, but it preserves today’s fast path for frequently used tags while keeping overflow behavior simple.

Alternatives considered:

- **Remove inline close from all tags and force management view for every edit**: more consistent, but slower and not requested.
- **Allow `+N` to remove all hidden tags**: dangerous and semantically unclear.

### Decision 5: Add explicit i18n/a11y text for the summary chip

The visible label of the summary chip remains compact (`+N`), but the accessible name should describe the action, for example “Manage 3 more tags”.

This requires a localized message key for the summary action label. The visible text can remain constructed from the count, but screen readers should not only hear “plus three”.

Alternatives considered:

- **Rely on raw `+N` as the accessible label**: too ambiguous.
- **Render hidden tag titles inside the label**: verbose and unnecessary for this surface.

## Risks / Trade-offs

- **[Anchor state becomes more complex]** → Replace the boolean menu-open state with a small structured state object so both `...` and `+N` can reuse the same popover cleanly.
- **[Mixed tag interaction model may feel uneven]** → Keep the rule simple and visible: first 4 tags are directly removable, overflow goes through `+N`.
- **[Long tag labels can still make the row tall]** → Accept wrapping as the current layout behavior; this change optimizes count noise, not chip truncation.
- **[Spec drift between visual intent and implementation]** → Capture only the testable behavior in spec deltas and keep styling details in CSS/design, not in normative text.

## Migration Plan

1. Update the `project-metadata-actions` delta spec to define tag overflow and the `+N` direct-entry behavior.
2. Refactor `ProjectPage` menu state so the same `ProjectMenu` can open from either the overflow button or the summary chip with an initial subview.
3. Update `ProjectMetaRow` rendering to split visible tags vs overflow summary while preserving ordered tags.
4. Add metadata chip variant styles and summary-chip styling in `src/index.css`.
5. Add any needed i18n/aria labels for the summary chip action.
6. Verify manual behavior on the Project page and run build/typecheck validation.

Rollback is a straightforward revert because no persisted data contract changes.

## Open Questions

- None for this change. The visible tag count, field scope, and overflow interaction were all explicitly chosen during exploration.
