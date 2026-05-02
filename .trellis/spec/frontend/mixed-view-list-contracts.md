# Mixed View List Contracts

This spec documents the cross-layer contract for list views that render tasks and projects in one ordered list.

## Scenario: Mixed Tasks + Projects in Planning Views

### 1. Scope / Trigger

- Trigger: a feature changes shared schemas, renderer API signatures, DB schema, sync payloads, and list UI behavior.
- Applies to: Today, Anytime, Someday, and Upcoming planning views.
- Does not apply to: Inbox, Project page section lists, Logbook, Trash, or project-internal task ordering.

### 2. Signatures

- Shared schema: `ViewListItem = ViewListTaskItem | ViewListProjectItem`, discriminated by `kind`.
- Renderer API:
  - `window.api.view.listToday(date): Promise<Result<ViewListItem[]>>`
  - `window.api.view.listAnytime(): Promise<Result<ViewListItem[]>>`
  - `window.api.view.listSomeday(): Promise<Result<ViewListItem[]>>`
  - `window.api.view.listUpcoming(fromDate): Promise<Result<ViewListItem[]>>`
  - `window.api.view.reorderBatch(listId, orderedItems): Promise<Result<{ reordered: boolean }>>`
- Reorder payload item: `{ kind: 'task' | 'project', id: string }`.
- DB table: `view_positions(list_id, entity_type, entity_id, rank, updated_at)`.
- Export schema: data export v4 includes `view_positions`.
- Sync entity type: `view_position`.

### 3. Contracts

- `kind: 'task'` entries extend the existing task-list item contract and preserve task behavior.
- `kind: 'project'` entries include project title/status/planning fields, tag metadata, and `done_count` / `total_count` for the project progress ring.
- Today/Anytime/Someday ordering uses `view_positions.rank`; task rows may fall back to existing `list_positions.rank` when no view rank exists.
- Upcoming orders by `scheduled_at` first and then by the same stable rank/creation fallback; cross-date drag persistence is not part of this contract.
- Tag filtering treats task and project entries the same: an entry matches when any selected tag is present in `tag_ids`.
- Matching projects do not suppress matching child tasks; both appear as independent rows.
- Project row click only focuses/selects the row; double-click or Enter navigates to `/projects/:projectId`.
- The project progress ring is the only inline completion control.

### 4. Validation & Error Matrix

| Boundary | Invalid condition | Expected behavior |
|---|---|---|
| `view.listToday` | `date` is not a local date string | Return `VALIDATION_FAILED` |
| `view.listUpcoming` | `from_date` is not a local date string | Return `VALIDATION_FAILED` |
| `view.reorderBatch` | `ordered_items[].kind` is not `task` or `project` | Return `VALIDATION_FAILED` |
| `view.reorderBatch` | `list_id` is empty | Return `VALIDATION_FAILED` |
| DB read | row shape violates `ViewListItemSchema` | Fail fast during parse |
| Data import | v2/v3 export has no `view_positions` | Import with an empty view-position set |

### 5. Good/Base/Bad Cases

- Good: a Today project and one of its Today tasks both render in the same virtualized list as separate rows.
- Good: dragging a project between two tasks in Today persists `{ kind: 'project', id }` in `view_positions`.
- Base: a task with only legacy `list_positions` rank appears in the expected order until the mixed view order is explicitly saved.
- Base: an unranked project appears after ranked entries using `created_at`, `kind`, and `id` as stable tie-breakers.
- Bad: encoding projects as fake `TaskListItem` rows or guessing entity type from nullable fields.
- Bad: writing mixed project ordering into `list_positions`, which is task-only and has a `tasks(id)` foreign key.

### 6. Tests Required

- DB tests:
  - list Today/Anytime/Someday/Upcoming with both tasks and projects.
  - persist mixed reorder order for task and project entries.
  - preserve legacy task `list_positions` fallback.
  - reject invalid view-list payloads with `VALIDATION_FAILED`.
- Data transfer tests:
  - export v4 includes `view_positions`.
  - importing v2/v3 leaves `view_positions` empty.
  - importing v4 restores mixed order.
- Sync tests:
  - push/fetch `view_position` payloads.
  - apply remote `view_position` rows with LWW semantics.
- Renderer tests:
  - project click selects without navigation.
  - project double-click and Enter navigate to the project route.
  - project progress ring runs the project completion confirmation flow.
  - tag filtering keeps both matching tasks and matching projects.
  - keyboard or drag reorder sends `ViewReorderItem[]`, not bare task ids.

### 7. Wrong vs Correct

#### Wrong

```ts
type MixedRow = TaskListItem & {
  projectStatus?: string
}

await window.api.task.reorderBatch(TASK_LIST_ID_TODAY, mixedRows.map((row) => row.id))
```

This loses the entity type, overloads the task contract, and cannot persist project rows safely.

#### Correct

```ts
type MixedRow = ViewListItem

await window.api.view.reorderBatch(
  TASK_LIST_ID_TODAY,
  mixedRows.map((row) => ({ kind: row.kind, id: row.id }))
)
```

The entity type is explicit at every renderer, IPC, DB, export, and sync boundary.

## Scenario: Area Page Projects View

### 1. Scope / Trigger

- Trigger: AreaPage renders a project list above its area-scoped task list.
- Applies to: the projects sub-list on `/areas/:areaId`.
- Does not apply to: AreaPage tasks (still served by `task.listArea`).

### 2. Signatures

- Renderer API: `window.api.view.listByArea(areaId): Promise<Result<ViewListItem[]>>`.
- IPC: `db:view.listByArea` with payload `{ area_id }`.
- DB action: `view.listByArea`. Returns only `kind: 'project'` rows (no tasks).

### 3. Contracts

- Returns open projects (`status = 'open'`, `deleted_at IS NULL`) where `area_id` matches the input.
- Each row is a full `ViewListProjectItem`, including `tag_preview`, `tag_count`, `tag_ids`, `total_count`, `done_count`, `due_at`, `scheduled_at`, `is_someday`.
- The renderer must filter the result to `kind === 'project'` before assigning to project state, even though the DB action only emits projects today — preserves the discriminated-union contract end-to-end.
- Project rendering must reuse `ProjectViewRow` (the same row used by mixed views) so metadata, progress ring, and context-menu behavior stay consistent across pages.

### 4. Validation & Error Matrix

| Boundary | Invalid condition | Expected behavior |
|---|---|---|
| `view.listByArea` | `area_id` missing or not an `IdSchema` | Return `VALIDATION_FAILED` |
| DB read | row violates `ViewListProjectItemSchema` | Fail fast during parse |

### 5. Good/Base/Bad Cases

- Good: an area with two open projects renders two `ProjectViewRow` rows with progress ring counts and tag chips.
- Base: an area with no projects renders only the task list; the `projectsTopContent` collapses to `null`.
- Bad: refetching projects via `project.listOpenByArea()` and a separate `task.countProjectsProgress()` call — this loses tag metadata and re-introduces the old multi-call dependency.

### 6. Tests Required

- DB tests:
  - `view.listByArea` returns only projects whose `area_id` matches and excludes other areas.
  - Returned rows include `tag_ids`, `tag_preview`, `total_count`, `done_count` derived from project tasks.
  - Empty payload (missing `area_id`) is rejected with `VALIDATION_FAILED`.

### 7. Wrong vs Correct

#### Wrong

```ts
const [projectsRes, progressRes] = await Promise.all([
  window.api.project.listOpenByArea(areaId),
  window.api.task.countProjectsProgress(projectIds),
])
// then merge progress into bare Project records and strip metadata.
```

#### Correct

```ts
const res = await window.api.view.listByArea(areaId)
if (!res.ok) return
setProjects(res.data.filter((item): item is ViewListProjectItem => item.kind === 'project'))
```

The view-based call returns one fully enriched payload and stays consistent with Today / Anytime / Someday / Upcoming.
