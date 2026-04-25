# Project Section Conversion Contract

This spec documents the cross-layer contract for converting a project section into a standalone project.

## Scenario: Convert Section To Project

### 1. Scope / Trigger

- Trigger: a feature changes shared schemas, renderer API signatures, preload wiring, DB worker actions, project-section ordering, task list ordering, and context-menu UI.
- Applies to: Project page section headers in active scope.
- Does not apply to: Area/sidebar groups, bulk conversion, trash-scope conversion, or nested projects.

### 2. Signatures

- Shared input schema: `ProjectSectionConvertToProjectInputSchema = { id: IdSchema }`.
- Shared result schema: `ProjectSectionConvertToProjectResultSchema = { project: ProjectSchema, tasks_moved: nonnegative integer }`.
- Renderer API: `window.api.project.convertSectionToProject(id): Promise<Result<ProjectSectionConvertToProjectResult>>`.
- Preload action: `db:project.section.convertToProject` with payload `{ id }`.
- Main IPC registration: `handleDb('db:project.section.convertToProject', 'project.section.convertToProject', ...)`.
- DB source table: `project_sections`.
- DB target tables: `projects`, `tasks`, `list_positions`.

### 3. Contracts

- The source section MUST be active: `deleted_at IS NULL` and `purged_at IS NULL`.
- The parent project MUST be active: `deleted_at IS NULL` and `purged_at IS NULL`.
- The new project MUST be open and use:
  - `title` from the source section title;
  - empty `notes`;
  - `area_id`, `scheduled_at`, `is_someday`, and `due_at` inherited from the parent project.
- All non-purged tasks with `section_id=<sourceSectionId>` MUST move to the new project with `section_id=null`, `area_id=null`, and `is_inbox=false`.
- Task display order MUST move from `taskListIdProject(sourceProjectId, sourceSectionId)` to `taskListIdProject(newProjectId, null)`.
- The source section MUST be permanently removed for app UX by setting both `deleted_at` and `purged_at`.
- Remaining active source-project sections MUST keep compact `position` values.
- Renderer UI MUST expose the action from the section context menu in active scope and navigate to `/projects/:newProjectId` after success.

### 4. Validation & Error Matrix

| Boundary | Invalid condition | Expected behavior |
|---|---|---|
| `project.section.convertToProject` | payload is not `{ id: string }` | Return `VALIDATION_FAILED` |
| DB action | source section missing, deleted, or purged | Return `NOT_FOUND` |
| DB action | parent project missing, deleted, or purged | Return `NOT_FOUND` |
| DB transaction | any mid-conversion write fails | Roll back all writes; dispatcher returns `DB_UNHANDLED` |
| Renderer | current section menu scope is `trash` | Do not render the conversion action |

### 5. Good/Base/Bad Cases

- Good: converting a populated section creates one project, moves all section tasks into the new default list, preserves task ordering, purges the source section, and navigates to the new project.
- Base: converting an empty untitled section creates an empty untitled project and purges the source section.
- Base: converting a section from a someday parent project inherits `is_someday=true` and keeps `scheduled_at=null`.
- Bad: leaving the source section only soft-deleted; it can resurface through trash-scope section queries later.
- Bad: preserving the source section as the only section inside the new project for MVP; this duplicates the title and does not match the selected flattening behavior.
- Bad: writing moved task order to the old section list or to a section list under the new project.

### 6. Tests Required

- DB tests:
  - conversion creates the expected project and moves tasks into `taskListIdProject(newProjectId, null)`;
  - source section is deleted and purged;
  - source section ordering is compacted;
  - empty/untitled sections are supported;
  - deleted sections return `NOT_FOUND` and create no project;
  - forced write failure rolls back project creation, task movement, section removal, and list-position changes.
- Renderer tests:
  - active section context menu shows `section.convertToProject`;
  - clicking the action calls `window.api.project.convertSectionToProject(sectionId)`;
  - success navigates to `/projects/:newProjectId`;
  - trash scope hides the conversion action.
- Type checks:
  - `WindowApi`, preload, shared Zod schema, and window-api test mocks stay in sync.
- IPC registration tests:
  - every `db:*` channel used by preload is registered by `handleDb` in `electron/main.ts`.

### 7. Wrong vs Correct

#### Wrong

```ts
await window.api.project.moveSection(section.id, newProjectId)
```

This preserves the source section inside the new project and leaves a redundant "project with one same-named section" shape.

#### Correct

```ts
const res = await window.api.project.convertSectionToProject(section.id)
if (res.ok) navigate(`/projects/${res.data.project.id}`)
```

The DB action owns the full conversion transaction: create project, flatten tasks, rewrite list order, purge source section, and compact source section order.
