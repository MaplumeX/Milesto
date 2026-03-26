## Why

The Project page metadata row currently renders plan, due, and every tag with the same chip treatment. As projects accumulate tags, the row becomes visually noisy and the high-value scheduling signals are harder to scan.

We want to keep the existing chip-based interaction model, but make the metadata row calmer and more legible by prioritizing plan/due, limiting visible tags, and giving overflow tags a direct path into tag management.

## What Changes

- Refine the Project metadata row presentation while keeping the existing chip layout instead of replacing it with a card or field grid.
- Preserve the metadata row scope as plan, due, and tags only; the project area is not shown in the row.
- Treat plan and due as primary metadata chips and tags as quieter secondary chips.
- Show at most 4 tag chips in the metadata row; collapse any remaining tags into a `+N` overflow chip.
- Make the `+N` overflow chip open the existing Project tags management view directly.

## Capabilities

### New Capabilities

<!-- None. This change refines an existing UI surface and interaction model. -->

### Modified Capabilities

- `project-metadata-actions`: refine the metadata row chip hierarchy, limit visible tags to 4 with overflow summarization, and make the overflow summary a direct entrypoint into tag management.

## Impact

- Renderer UI: `src/pages/ProjectPage.tsx` for metadata row rendering and overflow-chip interaction.
- Styling: `src/index.css` for quieter chip hierarchy and overflow summary styling.
- i18n/aria: `shared/i18n/messages.ts` for any summary-chip label or accessibility text needed by the new `+N` behavior.
- No backend, IPC, or schema changes are expected.
