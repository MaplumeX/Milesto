## 1. DB Schema & Migration

- [x] 1.1 Add DB migration (user_version v4) to create `project_tags` and `area_tags` tables with `position` and foreign keys in `electron/workers/db/db-bootstrap.ts`
- [x] 1.2 Add ordering constraints and indexes for join tables (e.g. `UNIQUE (entity_id, position)` and `INDEX (entity_id, position)`) in `electron/workers/db/db-bootstrap.ts`
- [x] 1.3 Update `db.resetAllData` to delete from `project_tags` and `area_tags` before deleting `projects/areas/tags` in `electron/workers/db/actions/db-actions.ts`

## 2. Shared Schemas & Window API Types

- [x] 2.1 Add `ProjectDetailSchema` (`{ project, tags }`) in `shared/schemas/project-detail.ts` and export it from `shared/schemas/index.ts`
- [x] 2.2 Add `AreaDetailSchema` (`{ area, tags }`) in `shared/schemas/area-detail.ts` and export it from `shared/schemas/index.ts`
- [x] 2.3 Add Zod input schemas for `project.setTags` and `area.setTags` (ordered unique `tag_ids`) under `shared/schemas/` and export them
- [x] 2.4 Update `shared/window-api.ts` to add `project.getDetail`, `project.setTags`, `area.getDetail`, `area.setTags` with correct Result types
- [x] 2.5 Update `tests/renderer/window-api-mock.ts` to include mocks for the new methods

## 3. DB Worker: Project/Area Tag Actions

- [x] 3.1 Implement `project.getDetail` action in `electron/workers/db/actions/project-actions.ts` (project row + ordered tags)
- [x] 3.2 Implement `project.setTags` action in `electron/workers/db/actions/project-actions.ts` (transactional replace; validate unique ordered list)
- [x] 3.3 Implement `area.getDetail` action in `electron/workers/db/actions/area-actions.ts` (area row + ordered tags)
- [x] 3.4 Implement `area.setTags` action in `electron/workers/db/actions/area-actions.ts` (transactional replace; validate unique ordered list)
- [x] 3.5 Ensure `getDetail` filters out soft-deleted tags (`tags.deleted_at IS NULL`) and preserves order via `position`

## 4. IPC Wiring (Main/Preload)

- [x] 4.1 Register IPC handlers for `db:project.getDetail` and `db:project.setTags` in `electron/main.ts` using `handleDb` with Zod input/output validation
- [x] 4.2 Register IPC handlers for `db:area.getDetail` and `db:area.setTags` in `electron/main.ts` using `handleDb` with Zod input/output validation
- [x] 4.3 Expose `window.api.project.getDetail/setTags` and `window.api.area.getDetail/setTags` in `electron/preload.ts`

## 5. Data Transfer v3 (Export/Import)

- [x] 5.1 Update `shared/schemas/data-transfer.ts` to support import of v2 and v3 and to export v3 (add `project_tags` and `area_tags` with `position`)
- [x] 5.2 Update `electron/workers/db/actions/data-transfer-actions.ts` export to include ordered `project_tags`/`area_tags` and to exclude relations to deleted entities/tags
- [x] 5.3 Update `electron/workers/db/actions/data-transfer-actions.ts` importOverwrite to write join tables (v3) and treat missing relations (v2) as empty
- [x] 5.4 Add/adjust DB tests to cover v2 compatibility and v3 export/import behavior (including transactional rollback) in `tests/db/`

## 6. Verification

- [x] 6.1 Run TypeScript typecheck (`npx tsc -p tsconfig.json`) and fix any errors introduced by the change
- [x] 6.2 Run build (`npm run build`) to ensure IPC wiring and bundling succeed
