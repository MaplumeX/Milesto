import { afterEach, describe, expect, it } from 'vitest'

import { buildDbHandlers } from '../../electron/workers/db/db-handlers'
import { dispatchDbRequest } from '../../electron/workers/db/db-dispatch'
import { createTestDb } from './db-test-helper'

import type { DbActionHandler } from '../../electron/workers/db/actions/db-actions'
import type { SyncBatch } from '../../shared/schemas/sync'

type Ok<T> = { ok: true; data: T }
type Err = { ok: false; error: { code: string; message: string; details?: unknown } }
type Res<T> = Ok<T> | Err

const VERY_OLD_VERSION = '0000000000000-000000-remote-a'
const VERY_NEW_VERSION = '9999999999999-999999-remote-a'
const REMOTE_CREATED_AT = '2026-03-16T00:00:00.000Z'
const REMOTE_UPDATED_AT = '2026-03-16T00:00:01.000Z'
const REMOTE_DELETED_AT = '2026-03-16T00:00:02.000Z'

function run<T>(handlers: Record<string, DbActionHandler>, action: string, payload: unknown): Res<T> {
  return dispatchDbRequest(handlers, {
    id: `${action}-${Math.random()}`,
    type: 'db',
    action,
    payload,
  }) as Res<T>
}

function readLatestBatch(db: Database.Database): SyncBatch {
  const row = db
    .prepare(
      `SELECT batch_json
       FROM sync_outbox_batches
       ORDER BY sequence_number DESC
       LIMIT 1`
    )
    .get() as { batch_json: string } | undefined

  if (!row) {
    throw new Error('expected sync_outbox_batches row')
  }

  return JSON.parse(row.batch_json) as SyncBatch
}

describe('DB sync support', () => {
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    if (cleanup) await cleanup()
    cleanup = null
  })

  it('creates sync metadata and an outbox batch when a local task write succeeds', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const created = run<{ id: string; title: string }>(handlers, 'task.create', {
      title: 'Sync me',
      notes: 'first batch',
      is_inbox: true,
    })

    expect(created.ok).toBe(true)
    if (!created.ok) return

    const deviceState = db
      .prepare(
        `SELECT device_id, device_name, sync_enabled
         FROM sync_device_state
         LIMIT 1`
      )
      .get() as { device_id: string; device_name: string; sync_enabled: number } | undefined

    expect(deviceState).toMatchObject({
      device_name: 'This Device',
      sync_enabled: 0,
    })
    expect(deviceState?.device_id).toEqual(expect.any(String))

    const versions = db
      .prepare(
        `SELECT field_name, version
         FROM sync_field_versions
         WHERE entity_type = 'task' AND entity_id = ?
         ORDER BY field_name ASC`
      )
      .all(created.data.id) as Array<{ field_name: string; version: string }>

    expect(versions.map((row) => row.field_name)).toEqual(
      expect.arrayContaining(['title', 'notes', 'status', 'is_inbox', 'updated_at'])
    )

    const batch = readLatestBatch(db)
    expect(batch.source_device_id).toBe(deviceState?.device_id)
    expect(batch.sequence_number).toBe(1)
    expect(batch.operations).toHaveLength(1)
    expect(batch.operations[0]).toMatchObject({
      kind: 'entity.put',
      entity_type: 'task',
      changed_fields: expect.arrayContaining(['title', 'notes', 'status', 'is_inbox', 'updated_at']),
      entity: {
        id: created.data.id,
        title: 'Sync me',
        notes: 'first batch',
      },
    })
  })

  it('applies a remote batch transactionally and ignores duplicate batches', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const remoteBatch: SyncBatch = {
      batch_id: 'remote-a:1',
      source_device_id: 'remote-a',
      sequence_number: 1,
      created_at: REMOTE_CREATED_AT,
      version: VERY_NEW_VERSION,
      operations: [
        {
          kind: 'entity.put',
          entity_type: 'task',
          changed_fields: [
            'title',
            'notes',
            'status',
            'is_inbox',
            'is_someday',
            'project_id',
            'section_id',
            'area_id',
            'scheduled_at',
            'due_at',
            'created_at',
            'updated_at',
            'completed_at',
            'deleted_at',
          ],
          field_versions: {
            title: VERY_NEW_VERSION,
            notes: VERY_NEW_VERSION,
            status: VERY_NEW_VERSION,
            is_inbox: VERY_NEW_VERSION,
            is_someday: VERY_NEW_VERSION,
            project_id: VERY_NEW_VERSION,
            section_id: VERY_NEW_VERSION,
            area_id: VERY_NEW_VERSION,
            scheduled_at: VERY_NEW_VERSION,
            due_at: VERY_NEW_VERSION,
            created_at: VERY_NEW_VERSION,
            updated_at: VERY_NEW_VERSION,
            completed_at: VERY_NEW_VERSION,
            deleted_at: VERY_NEW_VERSION,
          },
          entity: {
            id: 'remote-task-1',
            title: 'From remote',
            notes: '',
            status: 'open',
            is_inbox: true,
            is_someday: false,
            project_id: null,
            section_id: null,
            area_id: null,
            scheduled_at: null,
            due_at: null,
            created_at: REMOTE_CREATED_AT,
            updated_at: REMOTE_UPDATED_AT,
            completed_at: null,
            deleted_at: null,
          },
        },
      ],
    }

    const firstApply = run<{ applied: boolean; duplicate: boolean }>(handlers, 'sync.applyRemoteBatch', {
      batch: remoteBatch,
    })
    expect(firstApply).toMatchObject({ ok: true, data: { applied: true, duplicate: false } })

    const secondApply = run<{ applied: boolean; duplicate: boolean }>(handlers, 'sync.applyRemoteBatch', {
      batch: remoteBatch,
    })
    expect(secondApply).toMatchObject({ ok: true, data: { applied: false, duplicate: true } })

    const taskCount = db.prepare(`SELECT COUNT(1) AS count FROM tasks WHERE id = 'remote-task-1'`).get() as {
      count: number
    }
    expect(taskCount.count).toBe(1)

    const cursor = db
      .prepare(
        `SELECT last_applied_sequence
         FROM sync_remote_cursors
         WHERE source_device_id = 'remote-a'`
      )
      .get() as { last_applied_sequence: number } | undefined
    expect(cursor?.last_applied_sequence).toBe(1)
  })

  it('returns a runtime apply error when a remote batch arrives before its parent entity', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const childBatch: SyncBatch = {
      batch_id: 'older-device:1',
      source_device_id: 'older-device',
      sequence_number: 1,
      created_at: REMOTE_CREATED_AT,
      version: '2026031600002-000000-older-device',
      operations: [
        {
          kind: 'entity.put',
          entity_type: 'task',
          changed_fields: [
            'title',
            'notes',
            'status',
            'is_inbox',
            'is_someday',
            'project_id',
            'section_id',
            'area_id',
            'scheduled_at',
            'due_at',
            'created_at',
            'updated_at',
            'completed_at',
            'deleted_at',
          ],
          field_versions: {
            title: '2026031600002-000000-older-device',
            notes: '2026031600002-000000-older-device',
            status: '2026031600002-000000-older-device',
            is_inbox: '2026031600002-000000-older-device',
            is_someday: '2026031600002-000000-older-device',
            project_id: '2026031600002-000000-older-device',
            section_id: '2026031600002-000000-older-device',
            area_id: '2026031600002-000000-older-device',
            scheduled_at: '2026031600002-000000-older-device',
            due_at: '2026031600002-000000-older-device',
            created_at: '2026031600002-000000-older-device',
            updated_at: '2026031600002-000000-older-device',
            completed_at: '2026031600002-000000-older-device',
            deleted_at: '2026031600002-000000-older-device',
          },
          entity: {
            id: 'remote-task-with-parent',
            title: 'Task that depends on project',
            notes: '',
            status: 'open',
            is_inbox: false,
            is_someday: false,
            project_id: 'remote-project-parent',
            section_id: null,
            area_id: null,
            scheduled_at: null,
            due_at: null,
            created_at: REMOTE_CREATED_AT,
            updated_at: REMOTE_UPDATED_AT,
            completed_at: null,
            deleted_at: null,
          },
        },
      ],
    }

    const parentBatch: SyncBatch = {
      batch_id: 'newer-device:1',
      source_device_id: 'newer-device',
      sequence_number: 1,
      created_at: REMOTE_UPDATED_AT,
      version: '2026031600001-000000-newer-device',
      operations: [
        {
          kind: 'entity.put',
          entity_type: 'project',
          changed_fields: [
            'title',
            'notes',
            'area_id',
            'status',
            'scheduled_at',
            'is_someday',
            'due_at',
            'created_at',
            'updated_at',
            'completed_at',
            'deleted_at',
          ],
          field_versions: {
            title: '2026031600001-000000-newer-device',
            notes: '2026031600001-000000-newer-device',
            area_id: '2026031600001-000000-newer-device',
            status: '2026031600001-000000-newer-device',
            scheduled_at: '2026031600001-000000-newer-device',
            is_someday: '2026031600001-000000-newer-device',
            due_at: '2026031600001-000000-newer-device',
            created_at: '2026031600001-000000-newer-device',
            updated_at: '2026031600001-000000-newer-device',
            completed_at: '2026031600001-000000-newer-device',
            deleted_at: '2026031600001-000000-newer-device',
          },
          entity: {
            id: 'remote-project-parent',
            title: 'Parent project',
            notes: '',
            area_id: null,
            status: 'open',
            position: null,
            scheduled_at: null,
            is_someday: false,
            due_at: null,
            created_at: REMOTE_CREATED_AT,
            updated_at: REMOTE_UPDATED_AT,
            completed_at: null,
            deleted_at: null,
          },
        },
      ],
    }

    const failedApply = run<{ applied: boolean; duplicate: boolean }>(handlers, 'sync.applyRemoteBatch', {
      batch: childBatch,
    })
    expect(failedApply).toMatchObject({
      ok: false,
      error: {
        code: 'SYNC_APPLY_REMOTE_BATCH_FAILED',
        message: 'Failed to apply remote sync batch.',
      },
    })

    const parentApply = run<{ applied: boolean; duplicate: boolean }>(handlers, 'sync.applyRemoteBatch', {
      batch: parentBatch,
    })
    expect(parentApply).toMatchObject({ ok: true, data: { applied: true, duplicate: false } })

    const childRetry = run<{ applied: boolean; duplicate: boolean }>(handlers, 'sync.applyRemoteBatch', {
      batch: childBatch,
    })
    expect(childRetry).toMatchObject({ ok: true, data: { applied: true, duplicate: false } })
  })

  it('uses field-level LWW so newer remote notes can win without overwriting a newer local title', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const created = run<{ id: string }>(handlers, 'task.create', {
      title: 'Original title',
      notes: 'Original notes',
      is_inbox: true,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const updated = run<{ id: string }>(handlers, 'task.update', {
      id: created.data.id,
      title: 'Local newest title',
    })
    expect(updated.ok).toBe(true)

    const remoteBatch: SyncBatch = {
      batch_id: 'remote-a:2',
      source_device_id: 'remote-a',
      sequence_number: 2,
      created_at: REMOTE_CREATED_AT,
      version: VERY_NEW_VERSION,
      operations: [
        {
          kind: 'entity.put',
          entity_type: 'task',
          changed_fields: ['title', 'notes', 'updated_at'],
          field_versions: {
            title: VERY_OLD_VERSION,
            notes: VERY_NEW_VERSION,
            updated_at: VERY_NEW_VERSION,
          },
          entity: {
            id: created.data.id,
            title: 'Remote stale title',
            notes: 'Remote fresh notes',
            status: 'open',
            is_inbox: true,
            is_someday: false,
            project_id: null,
            section_id: null,
            area_id: null,
            scheduled_at: null,
            due_at: null,
            created_at: REMOTE_CREATED_AT,
            updated_at: REMOTE_UPDATED_AT,
            completed_at: null,
            deleted_at: null,
          },
        },
      ],
    }

    const applied = run<{ applied: boolean }>(handlers, 'sync.applyRemoteBatch', { batch: remoteBatch })
    expect(applied.ok).toBe(true)

    const task = db
      .prepare(
        `SELECT title, notes
         FROM tasks
         WHERE id = ?`
      )
      .get(created.data.id) as { title: string; notes: string }

    expect(task).toEqual({
      title: 'Local newest title',
      notes: 'Remote fresh notes',
    })
  })

  it('keeps a newer delete tombstone over an older remote edit', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const created = run<{ id: string }>(handlers, 'task.create', {
      title: 'Delete me',
      is_inbox: true,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const deleteBatch: SyncBatch = {
      batch_id: 'remote-a:3',
      source_device_id: 'remote-a',
      sequence_number: 3,
      created_at: REMOTE_CREATED_AT,
      version: VERY_NEW_VERSION,
      operations: [
        {
          kind: 'entity.put',
          entity_type: 'task',
          changed_fields: ['deleted_at', 'updated_at'],
          field_versions: {
            deleted_at: VERY_NEW_VERSION,
            updated_at: VERY_NEW_VERSION,
          },
          entity: {
            id: created.data.id,
            title: 'Delete me',
            notes: '',
            status: 'open',
            is_inbox: true,
            is_someday: false,
            project_id: null,
            section_id: null,
            area_id: null,
            scheduled_at: null,
            due_at: null,
            created_at: REMOTE_CREATED_AT,
            updated_at: REMOTE_DELETED_AT,
            completed_at: null,
            deleted_at: REMOTE_DELETED_AT,
          },
        },
      ],
    }

    const editBatch: SyncBatch = {
      batch_id: 'remote-a:4',
      source_device_id: 'remote-a',
      sequence_number: 4,
      created_at: REMOTE_CREATED_AT,
      version: VERY_OLD_VERSION,
      operations: [
        {
          kind: 'entity.put',
          entity_type: 'task',
          changed_fields: ['title', 'updated_at'],
          field_versions: {
            title: VERY_OLD_VERSION,
            updated_at: VERY_OLD_VERSION,
          },
          entity: {
            id: created.data.id,
            title: 'Remote stale edit',
            notes: '',
            status: 'open',
            is_inbox: true,
            is_someday: false,
            project_id: null,
            section_id: null,
            area_id: null,
            scheduled_at: null,
            due_at: null,
            created_at: REMOTE_CREATED_AT,
            updated_at: REMOTE_UPDATED_AT,
            completed_at: null,
            deleted_at: null,
          },
        },
      ],
    }

    expect(run(handlers, 'sync.applyRemoteBatch', { batch: deleteBatch }).ok).toBe(true)
    expect(run(handlers, 'sync.applyRemoteBatch', { batch: editBatch }).ok).toBe(true)

    const row = db
      .prepare(
        `SELECT title, deleted_at
         FROM tasks
         WHERE id = ?`
      )
      .get(created.data.id) as { title: string; deleted_at: string | null }

    expect(row.deleted_at).toBe(REMOTE_DELETED_AT)
    expect(row.title).toBe('Delete me')
  })

  it('turns removed task tag relations into tombstones instead of physical deletes', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const task = run<{ id: string }>(handlers, 'task.create', { title: 'Tagged task', is_inbox: true })
    const tagA = run<{ id: string }>(handlers, 'tag.create', { title: 'A' })
    const tagB = run<{ id: string }>(handlers, 'tag.create', { title: 'B' })
    expect(task.ok && tagA.ok && tagB.ok).toBe(true)
    if (!task.ok || !tagA.ok || !tagB.ok) return

    expect(
      run<{ updated: boolean }>(handlers, 'task.setTags', {
        task_id: task.data.id,
        tag_ids: [tagA.data.id, tagB.data.id],
      }).ok
    ).toBe(true)

    expect(
      run<{ updated: boolean }>(handlers, 'task.setTags', {
        task_id: task.data.id,
        tag_ids: [tagA.data.id],
      }).ok
    ).toBe(true)

    const rows = db
      .prepare(
        `SELECT task_id, tag_id, deleted_at
         FROM task_tags
         WHERE task_id = ?
         ORDER BY tag_id ASC`
      )
      .all(task.data.id) as Array<{ task_id: string; tag_id: string; deleted_at: string | null }>

    const rowsByTagId = new Map(rows.map((row) => [row.tag_id, row]))

    expect(rowsByTagId.get(tagA.data.id)).toEqual({
      task_id: task.data.id,
      tag_id: tagA.data.id,
      deleted_at: null,
    })
    expect(rowsByTagId.get(tagB.data.id)).toMatchObject({
      task_id: task.data.id,
      tag_id: tagB.data.id,
      deleted_at: expect.any(String),
    })
  })

  it('uses whole-list LWW for task order and sidebar area order', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const areaA = run<{ id: string }>(handlers, 'area.create', { title: 'Area A' })
    const areaB = run<{ id: string }>(handlers, 'area.create', { title: 'Area B' })
    const task1 = run<{ id: string }>(handlers, 'task.create', { title: 'One', is_inbox: true })
    const task2 = run<{ id: string }>(handlers, 'task.create', { title: 'Two', is_inbox: true })
    const task3 = run<{ id: string }>(handlers, 'task.create', { title: 'Three', is_inbox: true })
    expect(areaA.ok && areaB.ok && task1.ok && task2.ok && task3.ok).toBe(true)
    if (!areaA.ok || !areaB.ok || !task1.ok || !task2.ok || !task3.ok) return

    const winningBatch: SyncBatch = {
      batch_id: 'remote-a:5',
      source_device_id: 'remote-a',
      sequence_number: 5,
      created_at: REMOTE_CREATED_AT,
      version: VERY_NEW_VERSION,
      operations: [
        {
          kind: 'list.put',
          list_scope: 'task-list:inbox',
          version: VERY_NEW_VERSION,
          updated_at: REMOTE_UPDATED_AT,
          ordered_ids: [task3.data.id, task1.data.id, task2.data.id],
        },
        {
          kind: 'list.put',
          list_scope: 'sidebar-areas',
          version: VERY_NEW_VERSION,
          updated_at: REMOTE_UPDATED_AT,
          ordered_ids: [areaB.data.id, areaA.data.id],
        },
      ],
    }

    const staleBatch: SyncBatch = {
      batch_id: 'remote-a:6',
      source_device_id: 'remote-a',
      sequence_number: 6,
      created_at: REMOTE_CREATED_AT,
      version: VERY_OLD_VERSION,
      operations: [
        {
          kind: 'list.put',
          list_scope: 'task-list:inbox',
          version: VERY_OLD_VERSION,
          updated_at: REMOTE_CREATED_AT,
          ordered_ids: [task1.data.id, task2.data.id, task3.data.id],
        },
        {
          kind: 'list.put',
          list_scope: 'sidebar-areas',
          version: VERY_OLD_VERSION,
          updated_at: REMOTE_CREATED_AT,
          ordered_ids: [areaA.data.id, areaB.data.id],
        },
      ],
    }

    expect(run(handlers, 'sync.applyRemoteBatch', { batch: winningBatch }).ok).toBe(true)
    expect(run(handlers, 'sync.applyRemoteBatch', { batch: staleBatch }).ok).toBe(true)

    const taskOrder = db
      .prepare(
        `SELECT task_id
         FROM list_positions
         WHERE list_id = 'inbox'
         ORDER BY rank ASC`
      )
      .all() as Array<{ task_id: string }>
    expect(taskOrder.map((row) => row.task_id)).toEqual([task3.data.id, task1.data.id, task2.data.id])

    const areaOrder = db
      .prepare(
        `SELECT id
         FROM areas
         WHERE deleted_at IS NULL
         ORDER BY position ASC, created_at ASC`
      )
      .all() as Array<{ id: string }>
    expect(areaOrder.map((row) => row.id)).toEqual([areaB.data.id, areaA.data.id])
  })

  it('records checklist mutations and parent task touches into sync outbox batches', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const task = run<{ id: string }>(handlers, 'task.create', {
      title: 'Checklist task',
      is_inbox: true,
    })
    expect(task.ok).toBe(true)
    if (!task.ok) return

    const created = run<{ id: string }>(handlers, 'checklist.create', {
      task_id: task.data.id,
      title: 'First item',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    let batch = readLatestBatch(db)
    expect(batch.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'checklist_item',
          changed_fields: expect.arrayContaining(['title', 'done', 'position', 'updated_at']),
          entity: expect.objectContaining({
            id: created.data.id,
            task_id: task.data.id,
            title: 'First item',
          }),
        }),
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'task',
          changed_fields: ['updated_at'],
          entity: expect.objectContaining({
            id: task.data.id,
          }),
        }),
      ])
    )

    const updated = run<{ id: string }>(handlers, 'checklist.update', {
      id: created.data.id,
      title: 'Renamed item',
      done: true,
    })
    expect(updated.ok).toBe(true)

    batch = readLatestBatch(db)
    expect(batch.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'checklist_item',
          changed_fields: expect.arrayContaining(['title', 'done', 'updated_at']),
          entity: expect.objectContaining({
            id: created.data.id,
            title: 'Renamed item',
            done: true,
          }),
        }),
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'task',
          changed_fields: ['updated_at'],
          entity: expect.objectContaining({
            id: task.data.id,
          }),
        }),
      ])
    )

    const deleted = run<{ deleted: boolean }>(handlers, 'checklist.delete', {
      id: created.data.id,
    })
    expect(deleted.ok).toBe(true)

    batch = readLatestBatch(db)
    expect(batch.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'checklist_item',
          changed_fields: expect.arrayContaining(['deleted_at', 'updated_at']),
          entity: expect.objectContaining({
            id: created.data.id,
            deleted_at: expect.any(String),
          }),
        }),
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'task',
          changed_fields: ['updated_at'],
          entity: expect.objectContaining({
            id: task.data.id,
          }),
        }),
      ])
    )
  })

  it('records project, section, and completion mutations into sync outbox batches', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const area = run<{ id: string }>(handlers, 'area.create', { title: 'Projects' })
    expect(area.ok).toBe(true)
    if (!area.ok) return

    const project = run<{ id: string }>(handlers, 'project.create', {
      title: 'Ship sync',
      area_id: area.data.id,
    })
    expect(project.ok).toBe(true)
    if (!project.ok) return

    let batch = readLatestBatch(db)
    expect(batch.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'project',
          changed_fields: expect.arrayContaining(['title', 'area_id', 'status', 'updated_at']),
          entity: expect.objectContaining({
            id: project.data.id,
            title: 'Ship sync',
            area_id: area.data.id,
          }),
        }),
      ])
    )

    const projectUpdated = run<{ id: string }>(handlers, 'project.update', {
      id: project.data.id,
      notes: 'Final pass',
      status: 'open',
    })
    expect(projectUpdated.ok).toBe(true)

    batch = readLatestBatch(db)
    expect(batch.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'project',
          changed_fields: expect.arrayContaining(['notes', 'status', 'updated_at']),
          entity: expect.objectContaining({
            id: project.data.id,
            notes: 'Final pass',
          }),
        }),
      ])
    )

    const sectionA = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: project.data.id,
      title: 'Backlog',
    })
    expect(sectionA.ok).toBe(true)
    if (!sectionA.ok) return

    batch = readLatestBatch(db)
    expect(batch.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'project_section',
          changed_fields: expect.arrayContaining(['title', 'position', 'updated_at']),
          entity: expect.objectContaining({
            id: sectionA.data.id,
            project_id: project.data.id,
            title: 'Backlog',
          }),
        }),
        expect.objectContaining({
          kind: 'list.put',
          list_scope: `project-sections:${project.data.id}`,
          ordered_ids: [sectionA.data.id],
        }),
      ])
    )

    const sectionB = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: project.data.id,
      title: 'Doing',
    })
    expect(sectionB.ok).toBe(true)
    if (!sectionB.ok) return

    const task = run<{ id: string }>(handlers, 'task.create', {
      title: 'Wire batch upload',
      project_id: project.data.id,
      section_id: sectionA.data.id,
    })
    expect(task.ok).toBe(true)
    if (!task.ok) return

    const renamed = run<{ id: string }>(handlers, 'project.section.rename', {
      id: sectionB.data.id,
      title: 'In Progress',
    })
    expect(renamed.ok).toBe(true)

    batch = readLatestBatch(db)
    expect(batch.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'project_section',
          changed_fields: expect.arrayContaining(['title', 'updated_at']),
          entity: expect.objectContaining({
            id: sectionB.data.id,
            title: 'In Progress',
          }),
        }),
      ])
    )

    const reordered = run<{ reordered: boolean }>(handlers, 'project.section.reorderBatch', {
      project_id: project.data.id,
      ordered_section_ids: [sectionB.data.id, sectionA.data.id],
    })
    expect(reordered.ok).toBe(true)

    batch = readLatestBatch(db)
    expect(batch.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'list.put',
          list_scope: `project-sections:${project.data.id}`,
          ordered_ids: [sectionB.data.id, sectionA.data.id],
        }),
      ])
    )

    const deletedSection = run<{ deleted: boolean; moved_to_section_id: string | null }>(
      handlers,
      'project.section.delete',
      {
        id: sectionA.data.id,
      }
    )
    expect(deletedSection).toMatchObject({
      ok: true,
      data: { deleted: true, moved_to_section_id: sectionB.data.id },
    })

    batch = readLatestBatch(db)
    expect(batch.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'project_section',
          changed_fields: expect.arrayContaining(['deleted_at', 'updated_at']),
          entity: expect.objectContaining({
            id: sectionA.data.id,
            deleted_at: expect.any(String),
          }),
        }),
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'task',
          changed_fields: expect.arrayContaining(['section_id', 'updated_at']),
          entity: expect.objectContaining({
            id: task.data.id,
            section_id: sectionB.data.id,
          }),
        }),
        expect.objectContaining({
          kind: 'list.put',
          list_scope: `project-sections:${project.data.id}`,
          ordered_ids: [sectionB.data.id],
        }),
      ])
    )

    const completed = run<{ project: { status: string }; tasks_completed: number }>(
      handlers,
      'project.complete',
      {
        id: project.data.id,
      }
    )
    expect(completed).toMatchObject({
      ok: true,
      data: { project: { status: 'done' }, tasks_completed: 1 },
    })

    batch = readLatestBatch(db)
    expect(batch.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'project',
          changed_fields: expect.arrayContaining(['status', 'completed_at', 'updated_at']),
          entity: expect.objectContaining({
            id: project.data.id,
            status: 'done',
          }),
        }),
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'task',
          changed_fields: expect.arrayContaining(['status', 'completed_at', 'updated_at']),
          entity: expect.objectContaining({
            id: task.data.id,
            status: 'done',
          }),
        }),
      ])
    )
  })

  it('records list, sidebar, and cascading area deletion mutations into sync outbox batches', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const areaA = run<{ id: string }>(handlers, 'area.create', { title: 'Area A' })
    const areaB = run<{ id: string }>(handlers, 'area.create', { title: 'Area B' })
    const inboxTaskA = run<{ id: string }>(handlers, 'task.create', { title: 'Inbox A', is_inbox: true })
    const inboxTaskB = run<{ id: string }>(handlers, 'task.create', { title: 'Inbox B', is_inbox: true })
    const projectA = run<{ id: string }>(handlers, 'project.create', { title: 'Project A', area_id: areaA.ok ? areaA.data.id : null })
    const projectB = run<{ id: string }>(handlers, 'project.create', { title: 'Project B', area_id: areaA.ok ? areaA.data.id : null })
    expect(areaA.ok && areaB.ok && inboxTaskA.ok && inboxTaskB.ok && projectA.ok && projectB.ok).toBe(true)
    if (!areaA.ok || !areaB.ok || !inboxTaskA.ok || !inboxTaskB.ok || !projectA.ok || !projectB.ok) return

    const taskReordered = run<{ reordered: boolean }>(handlers, 'task.reorderBatch', {
      list_id: 'inbox',
      ordered_task_ids: [inboxTaskB.data.id, inboxTaskA.data.id],
    })
    expect(taskReordered.ok).toBe(true)

    let batch = readLatestBatch(db)
    expect(batch.operations).toEqual([
      expect.objectContaining({
        kind: 'list.put',
        list_scope: 'task-list:inbox',
        ordered_ids: [inboxTaskB.data.id, inboxTaskA.data.id],
      }),
    ])

    const areasReordered = run<{ reordered: boolean }>(handlers, 'sidebar.reorderAreas', {
      ordered_area_ids: [areaB.data.id, areaA.data.id],
    })
    expect(areasReordered.ok).toBe(true)

    batch = readLatestBatch(db)
    expect(batch.operations).toEqual([
      expect.objectContaining({
        kind: 'list.put',
        list_scope: 'sidebar-areas',
        ordered_ids: [areaB.data.id, areaA.data.id],
      }),
    ])

    const projectsReordered = run<{ reordered: boolean }>(handlers, 'sidebar.reorderProjects', {
      area_id: areaA.data.id,
      ordered_project_ids: [projectB.data.id, projectA.data.id],
    })
    expect(projectsReordered.ok).toBe(true)

    batch = readLatestBatch(db)
    expect(batch.operations).toEqual([
      expect.objectContaining({
        kind: 'list.put',
        list_scope: `sidebar-projects:${areaA.data.id}`,
        ordered_ids: [projectB.data.id, projectA.data.id],
      }),
    ])

    const movedProject = run<{ moved: boolean }>(handlers, 'sidebar.moveProject', {
      project_id: projectA.data.id,
      from_area_id: areaA.data.id,
      to_area_id: areaB.data.id,
      from_ordered_project_ids: [projectB.data.id],
      to_ordered_project_ids: [projectA.data.id],
    })
    expect(movedProject.ok).toBe(true)

    batch = readLatestBatch(db)
    expect(batch.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'project',
          changed_fields: expect.arrayContaining(['area_id', 'updated_at']),
          entity: expect.objectContaining({
            id: projectA.data.id,
            area_id: areaB.data.id,
          }),
        }),
        expect.objectContaining({
          kind: 'list.put',
          list_scope: `sidebar-projects:${areaA.data.id}`,
          ordered_ids: [projectB.data.id],
        }),
        expect.objectContaining({
          kind: 'list.put',
          list_scope: `sidebar-projects:${areaB.data.id}`,
          ordered_ids: [projectA.data.id],
        }),
      ])
    )

    const section = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: projectA.data.id,
      title: 'Section',
    })
    const projectTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Project task',
      project_id: projectA.data.id,
      section_id: section.ok ? section.data.id : null,
      area_id: areaB.data.id,
    })
    expect(section.ok && projectTask.ok).toBe(true)
    if (!section.ok || !projectTask.ok) return

    const areaDeleted = run<{ deleted: boolean }>(handlers, 'area.delete', {
      id: areaB.data.id,
    })
    expect(areaDeleted.ok).toBe(true)

    batch = readLatestBatch(db)
    expect(batch.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'area',
          changed_fields: expect.arrayContaining(['deleted_at', 'updated_at']),
          entity: expect.objectContaining({
            id: areaB.data.id,
            deleted_at: expect.any(String),
          }),
        }),
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'project',
          changed_fields: expect.arrayContaining(['deleted_at', 'updated_at']),
          entity: expect.objectContaining({
            id: projectA.data.id,
            deleted_at: expect.any(String),
          }),
        }),
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'task',
          changed_fields: expect.arrayContaining(['deleted_at', 'updated_at']),
          entity: expect.objectContaining({
            id: projectTask.data.id,
            deleted_at: expect.any(String),
          }),
        }),
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'project_section',
          changed_fields: expect.arrayContaining(['deleted_at', 'updated_at']),
          entity: expect.objectContaining({
            id: section.data.id,
            deleted_at: expect.any(String),
          }),
        }),
      ])
    )
  })

  it('clears stale sync error state when saving configuration', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const markedError = run(handlers, 'sync.updateStatus', {
      last_attempted_sync_at: '2026-03-16T00:00:00.000Z',
      last_error: {
        code: 'SYNC_PULL_FAILED',
        message: 'Pull failed.',
      },
    })
    expect(markedError.ok).toBe(true)

    const saved = run(handlers, 'sync.saveConfig', {
      config: {
        endpoint: 'https://objects.example.test',
        region: 'auto',
        bucket: 'milesto-sync',
        prefix: 'users/demo',
        force_path_style: true,
      },
      device_name: 'Studio Mac',
    })

    expect(saved).toMatchObject({
      ok: true,
      data: {
        device_name: 'Studio Mac',
        config: {
          endpoint: 'https://objects.example.test',
        },
        last_error: null,
      },
    })

    const state = run(handlers, 'sync.getState', {})
    expect(state).toMatchObject({
      ok: true,
      data: {
        device_name: 'Studio Mac',
        last_error: null,
      },
    })

    const deviceState = db
      .prepare(
        `SELECT last_error_code, last_error_message
         FROM sync_device_state
         WHERE singleton = 1`
      )
      .get() as { last_error_code: string | null; last_error_message: string | null }

    expect(deviceState).toEqual({
      last_error_code: null,
      last_error_message: null,
    })
  })
})
