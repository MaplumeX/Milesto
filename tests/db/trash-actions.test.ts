import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildDbHandlers } from '../../electron/workers/db/db-handlers'
import type { DbActionHandler } from '../../electron/workers/db/actions/db-actions'
import { dispatchDbRequest } from '../../electron/workers/db/db-dispatch'
import { createTestDb } from './db-test-helper'

import type { DbWorkerRequest } from '../../shared/db-worker-protocol'
import type { SyncBatch } from '../../shared/schemas/sync'

type Ok<T> = { ok: true; data: T }
type Err = { ok: false; error: { code: string; message: string; details?: unknown } }
type Res<T> = Ok<T> | Err

type TrashTaskEntry = {
  kind: 'task'
  id: string
  title: string
  deleted_at: string
}

type TrashProjectEntry = {
  kind: 'project'
  id: string
  title: string
  deleted_at: string
  open_task_count: number
}

type TrashEntry = TrashTaskEntry | TrashProjectEntry

function run<T>(handlers: Record<string, DbActionHandler>, action: string, payload: unknown): Res<T> {
  return dispatchDbRequest(handlers, {
    id: `${action}-${Math.random()}`,
    type: 'db',
    action,
    payload,
  } satisfies DbWorkerRequest) as Res<T>
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

describe('trash DB contract', () => {
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    vi.useRealTimers()
    if (cleanup) await cleanup()
    cleanup = null
  })

  it('lists mixed trash roots by deletion recency and absorbs earlier deleted project tasks', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T09:00:00.000Z'))

    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const createdProject = run<{ id: string }>(handlers, 'project.create', {
      title: 'Project Alpha',
    })
    expect(createdProject.ok).toBe(true)
    if (!createdProject.ok) return

    const createdOpenTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Absorbed open task',
      project_id: createdProject.data.id,
    })
    expect(createdOpenTask.ok).toBe(true)
    if (!createdOpenTask.ok) return

    const createdDoneTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Absorbed done task',
      project_id: createdProject.data.id,
    })
    expect(createdDoneTask.ok).toBe(true)
    if (!createdDoneTask.ok) return

    const markedDone = run<{ id: string }>(handlers, 'task.toggleDone', {
      id: createdDoneTask.data.id,
      done: true,
    })
    expect(markedDone.ok).toBe(true)

    const createdStandaloneTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Standalone task root',
      is_inbox: true,
    })
    expect(createdStandaloneTask.ok).toBe(true)
    if (!createdStandaloneTask.ok) return

    vi.setSystemTime(new Date('2026-03-16T10:00:00.000Z'))
    const deletedTask = run<{ deleted: boolean }>(handlers, 'task.delete', {
      id: createdOpenTask.data.id,
    })
    expect(deletedTask).toMatchObject({ ok: true, data: { deleted: true } })

    vi.setSystemTime(new Date('2026-03-16T11:00:00.000Z'))
    const deletedProject = run<{ deleted: boolean }>(handlers, 'project.delete', {
      id: createdProject.data.id,
    })
    expect(deletedProject).toMatchObject({ ok: true, data: { deleted: true } })

    vi.setSystemTime(new Date('2026-03-16T12:00:00.000Z'))
    const deletedStandaloneTask = run<{ deleted: boolean }>(handlers, 'task.delete', {
      id: createdStandaloneTask.data.id,
    })
    expect(deletedStandaloneTask).toMatchObject({ ok: true, data: { deleted: true } })

    const trash = run<TrashEntry[]>(handlers, 'trash.list', {})
    expect(trash.ok).toBe(true)
    if (!trash.ok) return

    expect(trash.data).toHaveLength(2)
    expect(trash.data.map((entry) => `${entry.kind}:${entry.id}`)).toEqual([
      `task:${createdStandaloneTask.data.id}`,
      `project:${createdProject.data.id}`,
    ])
    expect(trash.data[0]).toMatchObject({
      kind: 'task',
      id: createdStandaloneTask.data.id,
      title: 'Standalone task root',
      deleted_at: '2026-03-16T12:00:00.000Z',
    })
    expect(trash.data[1]).toMatchObject({
      kind: 'project',
      id: createdProject.data.id,
      title: 'Project Alpha',
      deleted_at: '2026-03-16T11:00:00.000Z',
      open_task_count: 1,
    })
  })

  it('surfaces deleted area descendants as project and direct-task trash roots only', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T09:30:00.000Z'))

    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const createdArea = run<{ id: string }>(handlers, 'area.create', { title: 'Area One' })
    expect(createdArea.ok).toBe(true)
    if (!createdArea.ok) return

    const createdProject = run<{ id: string }>(handlers, 'project.create', {
      title: 'Area project',
      area_id: createdArea.data.id,
    })
    expect(createdProject.ok).toBe(true)
    if (!createdProject.ok) return

    const createdProjectTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Project descendant task',
      project_id: createdProject.data.id,
      area_id: createdArea.data.id,
    })
    expect(createdProjectTask.ok).toBe(true)

    const createdAreaTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Direct area task',
      area_id: createdArea.data.id,
    })
    expect(createdAreaTask.ok).toBe(true)
    if (!createdAreaTask.ok) return

    vi.setSystemTime(new Date('2026-03-16T10:30:00.000Z'))
    const deletedArea = run<{ deleted: boolean }>(handlers, 'area.delete', {
      id: createdArea.data.id,
    })
    expect(deletedArea).toMatchObject({ ok: true, data: { deleted: true } })

    const trash = run<TrashEntry[]>(handlers, 'trash.list', {})
    expect(trash.ok).toBe(true)
    if (!trash.ok) return

    expect(trash.data.map((entry) => `${entry.kind}:${entry.id}`)).toEqual([
      `project:${createdProject.data.id}`,
      `task:${createdAreaTask.data.id}`,
    ])
    expect(trash.data[0]).toMatchObject({
      kind: 'project',
      id: createdProject.data.id,
      open_task_count: 1,
    })
    expect(trash.data[1]).toMatchObject({
      kind: 'task',
      id: createdAreaTask.data.id,
      title: 'Direct area task',
    })
  })

  it('restores direct task roots into Inbox when the original area is gone', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T11:00:00.000Z'))

    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const createdArea = run<{ id: string }>(handlers, 'area.create', { title: 'Area Restore Source' })
    expect(createdArea.ok).toBe(true)
    if (!createdArea.ok) return

    const createdTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Fallback to inbox',
      area_id: createdArea.data.id,
      scheduled_at: '2026-03-20',
    })
    expect(createdTask.ok).toBe(true)
    if (!createdTask.ok) return

    vi.setSystemTime(new Date('2026-03-16T11:05:00.000Z'))
    expect(
      run<{ deleted: boolean }>(handlers, 'task.delete', { id: createdTask.data.id })
    ).toMatchObject({ ok: true, data: { deleted: true } })

    vi.setSystemTime(new Date('2026-03-16T11:10:00.000Z'))
    expect(
      run<{ deleted: boolean }>(handlers, 'area.delete', { id: createdArea.data.id })
    ).toMatchObject({ ok: true, data: { deleted: true } })

    const restored = run<{ restored: boolean }>(handlers, 'trash.restoreTask', {
      id: createdTask.data.id,
    })
    expect(restored).toMatchObject({ ok: true, data: { restored: true } })

    const restoredRow = db
      .prepare(
        `SELECT is_inbox, project_id, section_id, area_id, scheduled_at, deleted_at, purged_at
         FROM tasks
         WHERE id = ?`
      )
      .get(createdTask.data.id) as {
      is_inbox: number
      project_id: string | null
      section_id: string | null
      area_id: string | null
      scheduled_at: string | null
      deleted_at: string | null
      purged_at: string | null
    }

    expect(restoredRow).toEqual({
      is_inbox: 1,
      project_id: null,
      section_id: null,
      area_id: null,
      scheduled_at: null,
      deleted_at: null,
      purged_at: null,
    })

    const inbox = run<Array<{ id: string }>>(handlers, 'task.listInbox', {})
    expect(inbox.ok).toBe(true)
    if (!inbox.ok) return
    expect(inbox.data.map((task) => task.id)).toContain(createdTask.data.id)
  })

  it('restores deleted project trees to the ungrouped list when the original area is deleted', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T12:30:00.000Z'))

    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const createdArea = run<{ id: string }>(handlers, 'area.create', { title: 'Area To Remove' })
    expect(createdArea.ok).toBe(true)
    if (!createdArea.ok) return

    const createdProject = run<{ id: string }>(handlers, 'project.create', {
      title: 'Project To Restore',
      area_id: createdArea.data.id,
    })
    expect(createdProject.ok).toBe(true)
    if (!createdProject.ok) return

    const createdSection = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: createdProject.data.id,
      title: 'Section A',
    })
    expect(createdSection.ok).toBe(true)
    if (!createdSection.ok) return

    const createdTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Project descendant',
      project_id: createdProject.data.id,
      section_id: createdSection.data.id,
      area_id: createdArea.data.id,
    })
    expect(createdTask.ok).toBe(true)
    if (!createdTask.ok) return

    vi.setSystemTime(new Date('2026-03-16T12:45:00.000Z'))
    expect(
      run<{ deleted: boolean }>(handlers, 'area.delete', { id: createdArea.data.id })
    ).toMatchObject({ ok: true, data: { deleted: true } })

    const restored = run<{ restored: boolean }>(handlers, 'trash.restoreProject', {
      id: createdProject.data.id,
    })
    expect(restored).toMatchObject({ ok: true, data: { restored: true } })

    const restoredProject = run<{ id: string; area_id: string | null }>(handlers, 'project.get', {
      id: createdProject.data.id,
    })
    expect(restoredProject.ok).toBe(true)
    if (!restoredProject.ok) return
    expect(restoredProject.data.area_id).toBeNull()

    const sections = run<Array<{ id: string }>>(handlers, 'project.section.list', {
      project_id: createdProject.data.id,
    })
    expect(sections.ok).toBe(true)
    if (!sections.ok) return
    expect(sections.data.map((section) => section.id)).toEqual([createdSection.data.id])

    const restoredTaskRow = db
      .prepare(
        `SELECT deleted_at, purged_at, area_id
         FROM tasks
         WHERE id = ?`
      )
      .get(createdTask.data.id) as {
      deleted_at: string | null
      purged_at: string | null
      area_id: string | null
    }

    expect(restoredTaskRow).toEqual({
      deleted_at: null,
      purged_at: null,
      area_id: null,
    })
  })

  it('permanently removes roots and records purged_at in sync metadata', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T14:00:00.000Z'))

    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const purgedTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Task to purge',
      is_inbox: true,
    })
    expect(purgedTask.ok).toBe(true)
    if (!purgedTask.ok) return

    const purgedProject = run<{ id: string }>(handlers, 'project.create', {
      title: 'Project to purge',
    })
    expect(purgedProject.ok).toBe(true)
    if (!purgedProject.ok) return

    const purgedProjectTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Project child',
      project_id: purgedProject.data.id,
    })
    expect(purgedProjectTask.ok).toBe(true)

    const emptyTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Task emptied later',
      is_inbox: true,
    })
    expect(emptyTask.ok).toBe(true)
    if (!emptyTask.ok) return

    vi.setSystemTime(new Date('2026-03-16T14:05:00.000Z'))
    expect(run<{ deleted: boolean }>(handlers, 'task.delete', { id: purgedTask.data.id })).toMatchObject({
      ok: true,
      data: { deleted: true },
    })
    expect(
      run<{ deleted: boolean }>(handlers, 'project.delete', { id: purgedProject.data.id })
    ).toMatchObject({ ok: true, data: { deleted: true } })
    expect(run<{ deleted: boolean }>(handlers, 'task.delete', { id: emptyTask.data.id })).toMatchObject({
      ok: true,
      data: { deleted: true },
    })

    vi.setSystemTime(new Date('2026-03-16T14:10:00.000Z'))
    expect(run<{ purged: boolean }>(handlers, 'trash.purgeTask', { id: purgedTask.data.id })).toMatchObject({
      ok: true,
      data: { purged: true },
    })

    const purgedTaskRow = db
      .prepare(
        `SELECT deleted_at, purged_at
         FROM tasks
         WHERE id = ?`
      )
      .get(purgedTask.data.id) as {
      deleted_at: string | null
      purged_at: string | null
    }

    expect(purgedTaskRow.deleted_at).toBe('2026-03-16T14:05:00.000Z')
    expect(purgedTaskRow.purged_at).toBe('2026-03-16T14:10:00.000Z')

    const latestBatch = readLatestBatch(db)
    expect(latestBatch.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'entity.put',
          entity_type: 'task',
          changed_fields: expect.arrayContaining(['purged_at', 'updated_at']),
          entity: expect.objectContaining({
            id: purgedTask.data.id,
            purged_at: '2026-03-16T14:10:00.000Z',
          }),
        }),
      ])
    )

    const purgedVersionRow = db
      .prepare(
        `SELECT version
         FROM sync_field_versions
         WHERE entity_type = 'task' AND entity_id = ? AND field_name = 'purged_at'`
      )
      .get(purgedTask.data.id) as { version: string } | undefined
    expect(purgedVersionRow?.version).toEqual(expect.any(String))

    const restoreAfterPurge = run<{ restored: boolean }>(handlers, 'trash.restoreTask', {
      id: purgedTask.data.id,
    })
    expect(restoreAfterPurge.ok).toBe(false)
    if (!restoreAfterPurge.ok) {
      expect(restoreAfterPurge.error.code).toBe('NOT_FOUND')
    }

    vi.setSystemTime(new Date('2026-03-16T14:15:00.000Z'))
    expect(run<{ purged: boolean }>(handlers, 'trash.purgeProject', { id: purgedProject.data.id })).toMatchObject({
      ok: true,
      data: { purged: true },
    })

    vi.setSystemTime(new Date('2026-03-16T14:20:00.000Z'))
    const emptied = run<{ purged_count: number }>(handlers, 'trash.empty', {})
    expect(emptied).toMatchObject({ ok: true, data: { purged_count: 1 } })

    const remaining = run<TrashEntry[]>(handlers, 'trash.list', {})
    expect(remaining).toMatchObject({ ok: true, data: [] })

    const purgedProjectTaskRow = db
      .prepare(
        `SELECT purged_at
         FROM tasks
         WHERE id = ?`
      )
      .get(purgedProjectTask.ok ? purgedProjectTask.data.id : '') as { purged_at: string | null }
    expect(purgedProjectTaskRow.purged_at).toBe('2026-03-16T14:15:00.000Z')
  })
})
