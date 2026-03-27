# task-row-metadata-display Specification

## Purpose
TBD - created by archiving change optimize-task-metadata-display. Update Purpose after archive.

## Requirements
### Requirement: Collapsed task rows show a right-aligned metadata preview cluster
When a task row is rendered in collapsed form, the system MUST render a right-aligned metadata preview cluster when the task has any visible metadata.

The cluster MUST:
- remain on a single line
- render previews in the order `Schedule -> Due -> Tags`
- omit any preview whose source value is absent

For schedule previews:
- when `is_someday=true`, the preview MUST show `Someday`
- otherwise, when `scheduled_at` is non-null, the preview MUST show the scheduled date value

When a task has no schedule, due date, or tags, the system MUST NOT render an empty metadata cluster.

#### Scenario: Collapsed row renders schedule, due, and tags in a stable order
- **WHEN** a collapsed task row has a scheduled value, a due date, and one or more tags
- **THEN** the row renders a right-aligned metadata cluster
- **AND** the rendered order is schedule preview, due preview, then tag preview

#### Scenario: Someday uses the Someday preview label
- **WHEN** a collapsed task row has `is_someday=true`
- **THEN** the schedule preview shows `Someday`
- **AND** the row does not render a concrete scheduled date alongside it

#### Scenario: Rows without visible metadata do not render an empty cluster
- **WHEN** a collapsed task row has no scheduled value, no due date, and no tags
- **THEN** the row does not render a metadata preview cluster

### Requirement: Collapsed rows preserve metadata visibility under constrained width
Collapsed task rows MUST prioritize metadata visibility over title width.

When horizontal space is constrained:
- the task title MUST truncate before the metadata cluster is removed
- the metadata cluster MUST remain single-line
- the metadata cluster MUST NOT wrap below the title

#### Scenario: Narrow rows truncate the title first
- **WHEN** a collapsed task row contains a long title and visible metadata previews
- **AND** the available row width becomes constrained
- **THEN** the task title is truncated
- **AND** the metadata cluster remains visible on the same line

### Requirement: Tag previews show up to two names plus an overflow count
When a collapsed task row has tags, the metadata cluster MUST render no more than two tag names directly.

If the task has more than two tags, the cluster MUST append a `+N` summary indicator for the remaining tag count.

#### Scenario: Up to two tags render directly
- **WHEN** a collapsed task row has one or two tags
- **THEN** the metadata cluster renders those tag names directly
- **AND** it does not render a `+N` overflow indicator

#### Scenario: More than two tags collapse into names plus count
- **WHEN** a collapsed task row has more than two tags
- **THEN** the metadata cluster renders exactly two tag names
- **AND** it renders a `+N` indicator for the remaining tags
