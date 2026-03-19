import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildDbHandlers } from '../../electron/workers/db/db-handlers'
import type { DbActionHandler } from '../../electron/workers/db/actions/db-actions'
import { dispatchDbRequest } from '../../electron/workers/db/db-dispatch'
import { createTestDb } from './db-test-helper'

import type { DbWorkerRequest } from '../../shared/db-worker-protocol'

type Ok<T> = { ok: true; data: T }
type Err = { ok: false; error: { code: string; message: string; details?: unknown } }
type Res<T> = Ok<T> | Err

function run<T>(handlers: Record<string, DbActionHandler>, action: string, payload: unknown): Res<T> {
  return dispatchDbRequest(handlers, {
    id: `${action}-${Math.random()}`,
    type: 'db',
    action,
    payload,
  } satisfies DbWorkerRequest) as Res<T>
}

describe('trash scope DB contract', () => {
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    vi.useRealTimers()
    if (cleanup) await cleanup()
    cleanup = null
  })

  it('reads and updates a deleted task only in trash scope while preserving deleted_at', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-18T09:00:00.000Z'))

    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const createdTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Deleted task',
      is_inbox: true,
    })
    expect(createdTask.ok).toBe(true)
    if (!createdTask.ok) return

    vi.setSystemTime(new Date('2026-03-18T09:05:00.000Z'))
    expect(run<{ deleted: boolean }>(handlers, 'task.delete', { id: createdTask.data.id })).toMatchObject({
      ok: true,
      data: { deleted: true },
    })

    const activeDetail = run<{ task: { id: string } }>(handlers, 'task.getDetail', { id: createdTask.data.id })
    expect(activeDetail.ok).toBe(false)
    if (!activeDetail.ok) {
      expect(activeDetail.error.code).toBe('NOT_FOUND')
    }

    const trashDetail = run<{ task: { id: string; deleted_at: string | null } }>(handlers, 'task.getDetail', {
      id: createdTask.data.id,
      scope: 'trash',
    })
    expect(trashDetail).toMatchObject({
      ok: true,
      data: {
        task: {
          id: createdTask.data.id,
          deleted_at: '2026-03-18T09:05:00.000Z',
        },
      },
    })

    vi.setSystemTime(new Date('2026-03-18T09:10:00.000Z'))
    const updatedTask = run<{ id: string; title: string; deleted_at: string | null }>(handlers, 'task.update', {
      id: createdTask.data.id,
      title: 'Deleted task updated',
      notes: 'Still deleted',
      scope: 'trash',
    })
    expect(updatedTask).toMatchObject({
      ok: true,
      data: {
        id: createdTask.data.id,
        title: 'Deleted task updated',
        deleted_at: '2026-03-18T09:05:00.000Z',
      },
    })

    vi.setSystemTime(new Date('2026-03-18T09:12:00.000Z'))
    const toggledTask = run<{ id: string; status: 'done'; deleted_at: string | null }>(
      handlers,
      'task.toggleDone',
      {
        id: createdTask.data.id,
        done: true,
        scope: 'trash',
      }
    )
    expect(toggledTask).toMatchObject({
      ok: true,
      data: {
        id: createdTask.data.id,
        status: 'done',
        deleted_at: '2026-03-18T09:05:00.000Z',
      },
    })

    const storedRow = db
      .prepare(
        `SELECT title, notes, status, deleted_at
         FROM tasks
         WHERE id = ?`
      )
      .get(createdTask.data.id) as {
      title: string
      notes: string
      status: string
      deleted_at: string | null
    }

    expect(storedRow).toEqual({
      title: 'Deleted task updated',
      notes: 'Still deleted',
      status: 'done',
      deleted_at: '2026-03-18T09:05:00.000Z',
    })
  })

  it('reads and edits a deleted project tree only in trash scope', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-18T10:00:00.000Z'))

    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const handlers = buildDbHandlers(testDb.db)

    const createdProject = run<{ id: string }>(handlers, 'project.create', {
      title: 'Deleted project',
    })
    expect(createdProject.ok).toBe(true)
    if (!createdProject.ok) return

    const createdSection = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: createdProject.data.id,
      title: 'Deleted section',
    })
    expect(createdSection.ok).toBe(true)
    if (!createdSection.ok) return

    const createdOpenTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Open child',
      project_id: createdProject.data.id,
      section_id: createdSection.data.id,
    })
    expect(createdOpenTask.ok).toBe(true)
    if (!createdOpenTask.ok) return

    const createdDoneTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Done child',
      project_id: createdProject.data.id,
    })
    expect(createdDoneTask.ok).toBe(true)
    if (!createdDoneTask.ok) return

    expect(
      run<{ id: string; status: string }>(handlers, 'task.toggleDone', {
        id: createdDoneTask.data.id,
        done: true,
      })
    ).toMatchObject({ ok: true, data: { id: createdDoneTask.data.id, status: 'done' } })

    vi.setSystemTime(new Date('2026-03-18T10:05:00.000Z'))
    expect(run<{ deleted: boolean }>(handlers, 'project.delete', { id: createdProject.data.id })).toMatchObject({
      ok: true,
      data: { deleted: true },
    })

    const activeProject = run<{ id: string }>(handlers, 'project.get', { id: createdProject.data.id })
    expect(activeProject.ok).toBe(false)
    if (!activeProject.ok) {
      expect(activeProject.error.code).toBe('NOT_FOUND')
    }

    expect(run<{ id: string; deleted_at: string | null }>(handlers, 'project.get', {
      id: createdProject.data.id,
      scope: 'trash',
    })).toMatchObject({
      ok: true,
      data: {
        id: createdProject.data.id,
        deleted_at: '2026-03-18T10:05:00.000Z',
      },
    })

    expect(run<{ project: { id: string; deleted_at: string | null } }>(handlers, 'project.getDetail', {
      id: createdProject.data.id,
      scope: 'trash',
    })).toMatchObject({
      ok: true,
      data: {
        project: {
          id: createdProject.data.id,
          deleted_at: '2026-03-18T10:05:00.000Z',
        },
      },
    })

    vi.setSystemTime(new Date('2026-03-18T10:08:00.000Z'))
    expect(
      run<{ id: string; notes: string; deleted_at: string | null }>(handlers, 'project.update', {
        id: createdProject.data.id,
        notes: 'Edited inside trash scope',
        scope: 'trash',
      })
    ).toMatchObject({
      ok: true,
      data: {
        id: createdProject.data.id,
        notes: 'Edited inside trash scope',
        deleted_at: '2026-03-18T10:05:00.000Z',
      },
    })

    expect(
      run<Array<{ id: string }>>(handlers, 'project.section.list', {
        project_id: createdProject.data.id,
        scope: 'trash',
      })
    ).toMatchObject({
      ok: true,
      data: [{ id: createdSection.data.id }],
    })

    expect(
      run<Array<{ id: string }>>(handlers, 'task.listProject', {
        project_id: createdProject.data.id,
        scope: 'trash',
      })
    ).toMatchObject({
      ok: true,
      data: [{ id: createdOpenTask.data.id }],
    })

    expect(
      run<Array<{ id: string }>>(handlers, 'task.listProjectDone', {
        project_id: createdProject.data.id,
        scope: 'trash',
      })
    ).toMatchObject({
      ok: true,
      data: [{ id: createdDoneTask.data.id }],
    })

    expect(
      run<{ count: number }>(handlers, 'task.countProjectDone', {
        project_id: createdProject.data.id,
        scope: 'trash',
      })
    ).toMatchObject({
      ok: true,
      data: { count: 1 },
    })
  })

  it('creates deleted descendants inside a deleted project and restores them with the project tree', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-18T11:00:00.000Z'))

    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const createdProject = run<{ id: string }>(handlers, 'project.create', {
      title: 'Project for deleted descendants',
    })
    expect(createdProject.ok).toBe(true)
    if (!createdProject.ok) return

    vi.setSystemTime(new Date('2026-03-18T11:05:00.000Z'))
    expect(run<{ deleted: boolean }>(handlers, 'project.delete', { id: createdProject.data.id })).toMatchObject({
      ok: true,
      data: { deleted: true },
    })

    vi.setSystemTime(new Date('2026-03-18T11:10:00.000Z'))
    const createdSection = run<{ id: string; deleted_at: string | null }>(handlers, 'project.section.create', {
      project_id: createdProject.data.id,
      title: 'Created while deleted',
      scope: 'trash',
    })
    expect(createdSection).toMatchObject({
      ok: true,
      data: {
        deleted_at: '2026-03-18T11:10:00.000Z',
      },
    })
    if (!createdSection.ok) return

    const createdTask = run<{ id: string; project_id: string | null; deleted_at: string | null }>(
      handlers,
      'task.create',
      {
        title: 'Task created while deleted',
        project_id: createdProject.data.id,
        section_id: createdSection.data.id,
        scope: 'trash',
      }
    )
    expect(createdTask).toMatchObject({
      ok: true,
      data: {
        project_id: createdProject.data.id,
        deleted_at: '2026-03-18T11:10:00.000Z',
      },
    })
    if (!createdTask.ok) return

    const activeProjectTasks = run<Array<{ id: string }>>(handlers, 'task.listProject', {
      project_id: createdProject.data.id,
    })
    expect(activeProjectTasks).toMatchObject({ ok: true, data: [] })

    vi.setSystemTime(new Date('2026-03-18T11:15:00.000Z'))
    expect(run<{ restored: boolean }>(handlers, 'trash.restoreProject', { id: createdProject.data.id })).toMatchObject({
      ok: true,
      data: { restored: true },
    })

    const restoredSection = db
      .prepare(
        `SELECT deleted_at
         FROM project_sections
         WHERE id = ?`
      )
      .get(createdSection.data.id) as { deleted_at: string | null }

    const restoredTask = db
      .prepare(
        `SELECT deleted_at
         FROM tasks
         WHERE id = ?`
      )
      .get(createdTask.data.id) as { deleted_at: string | null }

    expect(restoredSection.deleted_at).toBeNull()
    expect(restoredTask.deleted_at).toBeNull()
  })

  it('purges descendants created after project deletion when emptying trash', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-18T12:00:00.000Z'))

    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const createdProject = run<{ id: string }>(handlers, 'project.create', {
      title: 'Project purged from trash',
    })
    expect(createdProject.ok).toBe(true)
    if (!createdProject.ok) return

    vi.setSystemTime(new Date('2026-03-18T12:05:00.000Z'))
    expect(run<{ deleted: boolean }>(handlers, 'project.delete', { id: createdProject.data.id })).toMatchObject({
      ok: true,
      data: { deleted: true },
    })

    vi.setSystemTime(new Date('2026-03-18T12:10:00.000Z'))
    const createdTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Deleted descendant purged later',
      project_id: createdProject.data.id,
      scope: 'trash',
    })
    expect(createdTask.ok).toBe(true)
    if (!createdTask.ok) return

    vi.setSystemTime(new Date('2026-03-18T12:15:00.000Z'))
    expect(run<{ purged_count: number }>(handlers, 'trash.empty', {})).toMatchObject({
      ok: true,
      data: { purged_count: 1 },
    })

    const purgedTask = db
      .prepare(
        `SELECT purged_at
         FROM tasks
         WHERE id = ?`
      )
      .get(createdTask.data.id) as { purged_at: string | null }

    expect(purgedTask.purged_at).toBe('2026-03-18T12:15:00.000Z')
  })
})
