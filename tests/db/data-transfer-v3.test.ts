import { afterEach, describe, expect, it } from 'vitest'

import { buildDbHandlers } from '../../electron/workers/db/db-handlers'
import { dispatchDbRequest } from '../../electron/workers/db/db-dispatch'
import { createTestDb } from './db-test-helper'

import type { DbWorkerRequest } from '../../shared/db-worker-protocol'
import type { DataExportV2, DataExportV3 } from '../../shared/schemas/data-transfer'

type Ok<T> = { ok: true; data: T }
type Err = { ok: false; error: { code: string; message: string; details?: unknown } }
type Res<T> = Ok<T> | Err

describe('Data transfer v3 (project/area tags)', () => {
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    if (cleanup) await cleanup()
    cleanup = null
  })

  it('exports schema_version 3 with project_tags/area_tags and filters deleted tags', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const tag1 = dispatchDbRequest(handlers, {
      id: '1',
      type: 'db',
      action: 'tag.create',
      payload: { title: 'Tag 1', color: null },
    }) as Res<{ id: string }>
    expect(tag1.ok).toBe(true)
    if (!tag1.ok) return

    const tag2 = dispatchDbRequest(handlers, {
      id: '2',
      type: 'db',
      action: 'tag.create',
      payload: { title: 'Tag 2', color: null },
    }) as Res<{ id: string }>
    expect(tag2.ok).toBe(true)
    if (!tag2.ok) return

    const area = dispatchDbRequest(handlers, {
      id: '3',
      type: 'db',
      action: 'area.create',
      payload: { title: 'Area A' },
    }) as Res<{ id: string }>
    expect(area.ok).toBe(true)
    if (!area.ok) return

    const project = dispatchDbRequest(handlers, {
      id: '4',
      type: 'db',
      action: 'project.create',
      payload: { title: 'Project A', area_id: area.data.id },
    }) as Res<{ id: string }>
    expect(project.ok).toBe(true)
    if (!project.ok) return

    // Establish relations with distinct positions.
    const setProjectTags = dispatchDbRequest(handlers, {
      id: '5',
      type: 'db',
      action: 'project.setTags',
      payload: { project_id: project.data.id, tag_ids: [tag1.data.id, tag2.data.id] },
    }) as Res<{ updated: boolean }>
    expect(setProjectTags.ok).toBe(true)

    const setAreaTags = dispatchDbRequest(handlers, {
      id: '6',
      type: 'db',
      action: 'area.setTags',
      payload: { area_id: area.data.id, tag_ids: [tag2.data.id, tag1.data.id] },
    }) as Res<{ updated: boolean }>
    expect(setAreaTags.ok).toBe(true)

    // Soft-delete tag2; export should filter it and its relations.
    const deleteTag2 = dispatchDbRequest(handlers, {
      id: '7',
      type: 'db',
      action: 'tag.delete',
      payload: { id: tag2.data.id },
    }) as Res<{ deleted: boolean }>
    expect(deleteTag2.ok).toBe(true)

    const exported = dispatchDbRequest(handlers, {
      id: '8',
      type: 'db',
      action: 'data.export',
      payload: { app_version: 'test' },
    }) as Res<{
      schema_version: number
      tags: Array<{ id: string }>
      project_tags: Array<{ project_id: string; tag_id: string; position: number }>
      area_tags: Array<{ area_id: string; tag_id: string; position: number }>
    }>

    if (!exported.ok) {
      throw new Error(
        `data.export failed: ${exported.error.code}: ${exported.error.message} details=${JSON.stringify(exported.error.details)}`
      )
    }

    expect(exported.data.schema_version).toBe(3)
    expect(Array.isArray(exported.data.project_tags)).toBe(true)
    expect(Array.isArray(exported.data.area_tags)).toBe(true)

    // Deleted tag should not be exported.
    expect(exported.data.tags.some((t) => t.id === tag2.data.id)).toBe(false)

    // Relations to deleted tag should be excluded; remaining relation keeps its original position.
    expect(exported.data.project_tags).toEqual([{ project_id: project.data.id, tag_id: tag1.data.id, position: 1000 }])
    expect(exported.data.area_tags).toEqual([{ area_id: area.data.id, tag_id: tag1.data.id, position: 2000 }])
  })

  it('imports v2 with empty project/area tag relations', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const v2: DataExportV2 = {
      schema_version: 2,
      app_version: 'test',
      exported_at: '2026-01-01T00:00:00.000Z',
      tasks: [],
      projects: [
        {
          id: 'p1',
          title: 'P1',
          notes: '',
          area_id: null,
          status: 'open',
          scheduled_at: null,
          is_someday: false,
          due_at: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          completed_at: null,
          deleted_at: null,
        },
      ],
      project_sections: [],
      areas: [],
      tags: [],
      task_tags: [],
      checklist_items: [],
      list_positions: [],
    }

    const imported = dispatchDbRequest(handlers, {
      id: '1',
      type: 'db',
      action: 'data.importOverwrite',
      payload: { mode: 'overwrite', data: v2 },
    }) as Res<{ imported: boolean }>
    expect(imported.ok).toBe(true)

    const detail = dispatchDbRequest(handlers, {
      id: '2',
      type: 'db',
      action: 'project.getDetail',
      payload: { id: 'p1' },
    }) as Res<{ tags: unknown[] }>
    expect(detail.ok).toBe(true)
    if (!detail.ok) return

    expect(detail.data.tags).toEqual([])

    const relCount = db.prepare('SELECT COUNT(1) AS c FROM project_tags').get() as { c: number }
    expect(relCount.c).toBe(0)
  })

  it('imports v3 relations and preserves order via position', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const v3: DataExportV3 = {
      schema_version: 3,
      app_version: 'test',
      exported_at: '2026-01-01T00:00:00.000Z',
      tasks: [],
      projects: [
        {
          id: 'p1',
          title: 'P1',
          notes: '',
          area_id: null,
          status: 'open',
          scheduled_at: null,
          is_someday: false,
          due_at: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          completed_at: null,
          deleted_at: null,
        },
      ],
      project_sections: [],
      areas: [
        {
          id: 'a1',
          title: 'A1',
          notes: '',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          deleted_at: null,
        },
      ],
      tags: [
        {
          id: 't1',
          title: 'T1',
          color: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          deleted_at: null,
        },
        {
          id: 't2',
          title: 'T2',
          color: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          deleted_at: null,
        },
      ],
      task_tags: [],
      project_tags: [
        // Intentionally reversed by position.
        { project_id: 'p1', tag_id: 't1', position: 2000 },
        { project_id: 'p1', tag_id: 't2', position: 1000 },
      ],
      area_tags: [{ area_id: 'a1', tag_id: 't2', position: 1000 }],
      checklist_items: [],
      list_positions: [],
    }

    const imported = dispatchDbRequest(handlers, {
      id: '1',
      type: 'db',
      action: 'data.importOverwrite',
      payload: { mode: 'overwrite', data: v3 },
    }) as Res<{ imported: boolean }>
    expect(imported.ok).toBe(true)

    const detail = dispatchDbRequest(handlers, {
      id: '2',
      type: 'db',
      action: 'project.getDetail',
      payload: { id: 'p1' },
    }) as Res<{ tags: Array<{ id: string }> }>
    expect(detail.ok).toBe(true)
    if (!detail.ok) return

    // Ordered by join-table position ASC => t2 then t1.
    expect(detail.data.tags.map((t: { id: string }) => t.id)).toEqual(['t2', 't1'])

    const areaDetail = dispatchDbRequest(handlers, {
      id: '3',
      type: 'db',
      action: 'area.getDetail',
      payload: { id: 'a1' },
    }) as Res<{ tags: Array<{ id: string }> }>
    expect(areaDetail.ok).toBe(true)
    if (!areaDetail.ok) return
    expect(areaDetail.data.tags.map((t: { id: string }) => t.id)).toEqual(['t2'])

    const relCount = db.prepare('SELECT COUNT(1) AS c FROM project_tags').get() as { c: number }
    expect(relCount.c).toBe(2)
  })

  it('import overwrite rolls back on v3 relation foreign key failure', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    // Seed some existing data to ensure rollback preserves it.
    const created = dispatchDbRequest(handlers, {
      id: 'seed',
      type: 'db',
      action: 'task.create',
      payload: { title: 'Existing task' },
    })
    expect(created.ok).toBe(true)

    const before = db.prepare('SELECT COUNT(1) AS c FROM tasks WHERE deleted_at IS NULL').get() as { c: number }
    expect(before.c).toBe(1)

    const badV3: DataExportV3 = {
      schema_version: 3,
      app_version: 'test',
      exported_at: '2026-01-01T00:00:00.000Z',
      tasks: [],
      projects: [
        {
          id: 'p1',
          title: 'P1',
          notes: '',
          area_id: null,
          status: 'open',
          scheduled_at: null,
          is_someday: false,
          due_at: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          completed_at: null,
          deleted_at: null,
        },
      ],
      project_sections: [],
      areas: [],
      tags: [],
      task_tags: [],
      project_tags: [{ project_id: 'p1', tag_id: 't_missing', position: 1000 }],
      area_tags: [],
      checklist_items: [],
      list_positions: [],
    }

    const importReq: DbWorkerRequest = {
      id: 'import',
      type: 'db',
      action: 'data.importOverwrite',
      payload: { mode: 'overwrite', data: badV3 },
    }
    const imported = dispatchDbRequest(handlers, importReq)

    expect(imported.ok).toBe(false)
    if (!imported.ok) {
      expect(imported.error.code).toBe('DB_UNHANDLED')
    }

    const after = db.prepare('SELECT COUNT(1) AS c FROM tasks WHERE deleted_at IS NULL').get() as { c: number }
    expect(after.c).toBe(1)
  })
})
