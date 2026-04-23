import type Database from 'better-sqlite3'

import { nowIso } from './utils'

type LocalRecorder = {
  recordEntity: (_entityType: string, _entity: unknown, _changedFields: readonly string[]) => void
  recordRelation: (_relationType: string, _relation: unknown) => void
  recordList: (_listScope: string, _orderedIds: readonly string[], _updatedAt: string) => void
  finalize: () => void
}

function createNoopRecorder(): LocalRecorder {
  return {
    recordEntity: () => {},
    recordRelation: () => {},
    recordList: () => {},
    finalize: () => {},
  }
}

function normalizeIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)))
}

function upsertTaskTagRow(db: Database.Database, taskId: string, tagId: string, timestamp: string, deletedAt: string | null) {
  db.prepare(
    `INSERT INTO task_tags (task_id, tag_id, created_at, updated_at, deleted_at)
     VALUES (@task_id, @tag_id, @created_at, @updated_at, @deleted_at)
     ON CONFLICT(task_id, tag_id) DO UPDATE SET
       updated_at = excluded.updated_at,
       deleted_at = excluded.deleted_at`
  ).run({
    task_id: taskId,
    tag_id: tagId,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: deletedAt,
  })
}

function upsertProjectTagRow(
  db: Database.Database,
  projectId: string,
  tagId: string,
  position: number | null,
  timestamp: string,
  deletedAt: string | null
) {
  db.prepare(
    `INSERT INTO project_tags (project_id, tag_id, position, created_at, updated_at, deleted_at)
     VALUES (@project_id, @tag_id, @position, @created_at, @updated_at, @deleted_at)
     ON CONFLICT(project_id, tag_id) DO UPDATE SET
       position = excluded.position,
       updated_at = excluded.updated_at,
       deleted_at = excluded.deleted_at`
  ).run({
    project_id: projectId,
    tag_id: tagId,
    position,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: deletedAt,
  })
}

function upsertAreaTagRow(
  db: Database.Database,
  areaId: string,
  tagId: string,
  position: number | null,
  timestamp: string,
  deletedAt: string | null
) {
  db.prepare(
    `INSERT INTO area_tags (area_id, tag_id, position, created_at, updated_at, deleted_at)
     VALUES (@area_id, @tag_id, @position, @created_at, @updated_at, @deleted_at)
     ON CONFLICT(area_id, tag_id) DO UPDATE SET
       position = excluded.position,
       updated_at = excluded.updated_at,
       deleted_at = excluded.deleted_at`
  ).run({
    area_id: areaId,
    tag_id: tagId,
    position,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: deletedAt,
  })
}

export function createLocalSyncRecorder(_db: Database.Database, timestamp = nowIso()) {
  void timestamp
  return createNoopRecorder()
}

export function replaceTaskTags(
  db: Database.Database,
  _sync: ReturnType<typeof createLocalSyncRecorder>,
  taskId: string,
  tagIds: readonly string[],
  timestamp: string
) {
  const desired = normalizeIds(tagIds)
  const existingRows = db
    .prepare(
      `SELECT task_id, tag_id, created_at, updated_at, deleted_at
       FROM task_tags
       WHERE task_id = ?`
    )
    .all(taskId) as Array<{
      task_id: string
      tag_id: string
      created_at: string
      updated_at: string
      deleted_at: string | null
    }>

  const existingByTagId = new Map(existingRows.map((row) => [row.tag_id, row]))

  for (const tagId of desired) {
    const row = existingByTagId.get(tagId)
    upsertTaskTagRow(db, taskId, tagId, row?.created_at ?? timestamp, null)
    db.prepare(
      `UPDATE task_tags
       SET updated_at = @updated_at,
           deleted_at = NULL
       WHERE task_id = @task_id AND tag_id = @tag_id`
    ).run({
      task_id: taskId,
      tag_id: tagId,
      updated_at: timestamp,
    })
  }

  for (const row of existingRows) {
    if (desired.includes(row.tag_id) || row.deleted_at !== null) continue
    db.prepare(
      `UPDATE task_tags
       SET updated_at = @updated_at,
           deleted_at = @deleted_at
       WHERE task_id = @task_id AND tag_id = @tag_id`
    ).run({
      task_id: row.task_id,
      tag_id: row.tag_id,
      updated_at: timestamp,
      deleted_at: timestamp,
    })
  }
}

export function replaceProjectTags(
  db: Database.Database,
  _sync: ReturnType<typeof createLocalSyncRecorder>,
  projectId: string,
  tagIds: readonly string[],
  timestamp: string
) {
  const desired = normalizeIds(tagIds)
  const existingRows = db
    .prepare(
      `SELECT project_id, tag_id, position, created_at, updated_at, deleted_at
       FROM project_tags
       WHERE project_id = ?`
    )
    .all(projectId) as Array<{
      project_id: string
      tag_id: string
      position: number | null
      created_at: string
      updated_at: string
      deleted_at: string | null
    }>

  const existingByTagId = new Map(existingRows.map((row) => [row.tag_id, row]))

  for (let index = 0; index < desired.length; index++) {
    const tagId = desired[index]!
    const position = (index + 1) * 1000
    const row = existingByTagId.get(tagId)
    upsertProjectTagRow(db, projectId, tagId, position, row?.created_at ?? timestamp, null)
    db.prepare(
      `UPDATE project_tags
       SET position = @position,
           updated_at = @updated_at,
           deleted_at = NULL
       WHERE project_id = @project_id AND tag_id = @tag_id`
    ).run({
      project_id: projectId,
      tag_id: tagId,
      position,
      updated_at: timestamp,
    })
  }

  for (const row of existingRows) {
    if (desired.includes(row.tag_id) || row.deleted_at !== null) continue
    db.prepare(
      `UPDATE project_tags
       SET position = NULL,
           updated_at = @updated_at,
           deleted_at = @deleted_at
       WHERE project_id = @project_id AND tag_id = @tag_id`
    ).run({
      project_id: row.project_id,
      tag_id: row.tag_id,
      updated_at: timestamp,
      deleted_at: timestamp,
    })
  }
}

export function replaceAreaTags(
  db: Database.Database,
  _sync: ReturnType<typeof createLocalSyncRecorder>,
  areaId: string,
  tagIds: readonly string[],
  timestamp: string
) {
  const desired = normalizeIds(tagIds)
  const existingRows = db
    .prepare(
      `SELECT area_id, tag_id, position, created_at, updated_at, deleted_at
       FROM area_tags
       WHERE area_id = ?`
    )
    .all(areaId) as Array<{
      area_id: string
      tag_id: string
      position: number | null
      created_at: string
      updated_at: string
      deleted_at: string | null
    }>

  const existingByTagId = new Map(existingRows.map((row) => [row.tag_id, row]))

  for (let index = 0; index < desired.length; index++) {
    const tagId = desired[index]!
    const position = (index + 1) * 1000
    const row = existingByTagId.get(tagId)
    upsertAreaTagRow(db, areaId, tagId, position, row?.created_at ?? timestamp, null)
    db.prepare(
      `UPDATE area_tags
       SET position = @position,
           updated_at = @updated_at,
           deleted_at = NULL
       WHERE area_id = @area_id AND tag_id = @tag_id`
    ).run({
      area_id: areaId,
      tag_id: tagId,
      position,
      updated_at: timestamp,
    })
  }

  for (const row of existingRows) {
    if (desired.includes(row.tag_id) || row.deleted_at !== null) continue
    db.prepare(
      `UPDATE area_tags
       SET position = NULL,
           updated_at = @updated_at,
           deleted_at = @deleted_at
       WHERE area_id = @area_id AND tag_id = @tag_id`
    ).run({
      area_id: row.area_id,
      tag_id: row.tag_id,
      updated_at: timestamp,
      deleted_at: timestamp,
    })
  }
}
