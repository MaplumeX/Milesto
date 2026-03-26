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

describe('cancelled status DB contract', () => {
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    vi.useRealTimers()
    if (cleanup) await cleanup()
    cleanup = null
  })

  it('treats cancelled tasks as closed entries across project queries, logbook, progress, and search', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-20T09:00:00.000Z'))

    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const handlers = buildDbHandlers(testDb.db)

    const createdProject = run<{ id: string }>(handlers, 'project.create', {
      title: 'Cancelled query project',
    })
    expect(createdProject.ok).toBe(true)
    if (!createdProject.ok) return

    const openTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'open keyword task',
      project_id: createdProject.data.id,
    })
    expect(openTask.ok).toBe(true)
    if (!openTask.ok) return

    vi.setSystemTime(new Date('2026-03-20T09:01:00.000Z'))
    const doneTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'done keyword task',
      project_id: createdProject.data.id,
    })
    expect(doneTask.ok).toBe(true)
    if (!doneTask.ok) return

    vi.setSystemTime(new Date('2026-03-20T09:02:00.000Z'))
    expect(
      run<{ id: string; status: 'done' }>(handlers, 'task.toggleDone', {
        id: doneTask.data.id,
        done: true,
      })
    ).toMatchObject({
      ok: true,
      data: {
        id: doneTask.data.id,
        status: 'done',
      },
    })

    vi.setSystemTime(new Date('2026-03-20T09:03:00.000Z'))
    const cancelledTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'cancelled keyword task',
      project_id: createdProject.data.id,
    })
    expect(cancelledTask.ok).toBe(true)
    if (!cancelledTask.ok) return

    vi.setSystemTime(new Date('2026-03-20T09:04:00.000Z'))
    expect(
      run<{ id: string; status: 'cancelled'; completed_at: string | null }>(handlers, 'task.cancel', {
        id: cancelledTask.data.id,
      })
    ).toMatchObject({
      ok: true,
      data: {
        id: cancelledTask.data.id,
        status: 'cancelled',
        completed_at: '2026-03-20T09:04:00.000Z',
      },
    })

    expect(
      run<Array<{ id: string }>>(handlers, 'task.listProject', {
        project_id: createdProject.data.id,
      })
    ).toMatchObject({
      ok: true,
      data: [{ id: openTask.data.id }],
    })

    const closedTasks = run<Array<{ id: string; status: string }>>(handlers, 'task.listProjectDone', {
      project_id: createdProject.data.id,
    })
    expect(closedTasks.ok).toBe(true)
    if (!closedTasks.ok) return
    expect(
      closedTasks.data
        .map((task) => `${task.id}:${task.status}`)
        .sort()
    ).toEqual([
      `${cancelledTask.data.id}:cancelled`,
      `${doneTask.data.id}:done`,
    ].sort())

    expect(
      run<{ count: number }>(handlers, 'task.countProjectDone', {
        project_id: createdProject.data.id,
      })
    ).toMatchObject({
      ok: true,
      data: { count: 2 },
    })

    expect(
      run<Array<{ project_id: string; total_count: number; done_count: number }>>(
        handlers,
        'task.countProjectsProgress',
        { project_ids: [createdProject.data.id] }
      )
    ).toMatchObject({
      ok: true,
      data: [
        {
          project_id: createdProject.data.id,
          total_count: 3,
          done_count: 2,
        },
      ],
    })

    const logbook = run<Array<{ id: string; status: string }>>(handlers, 'task.listLogbook', {})
    expect(logbook.ok).toBe(true)
    if (!logbook.ok) return
    expect(
      logbook.data
        .map((task) => `${task.id}:${task.status}`)
        .sort()
    ).toEqual([
      `${cancelledTask.data.id}:cancelled`,
      `${doneTask.data.id}:done`,
    ].sort())

    const activeSearch = run<Array<{ id: string }>>(handlers, 'task.search', {
      query: 'keyword',
      include_logbook: false,
    })
    expect(activeSearch.ok).toBe(true)
    if (!activeSearch.ok) return
    expect(activeSearch.data.map((task) => task.id)).toEqual([openTask.data.id])

    const closedSearch = run<Array<{ id: string }>>(handlers, 'task.search', {
      query: 'keyword',
      include_logbook: true,
    })
    expect(closedSearch.ok).toBe(true)
    if (!closedSearch.ok) return
    expect(closedSearch.data.map((task) => task.id).sort()).toEqual(
      [openTask.data.id, doneTask.data.id, cancelledTask.data.id].sort()
    )

    vi.setSystemTime(new Date('2026-03-20T09:05:00.000Z'))
    expect(
      run<{ id: string; status: 'open'; completed_at: string | null }>(handlers, 'task.restore', {
        id: cancelledTask.data.id,
      })
    ).toMatchObject({
      ok: true,
      data: {
        id: cancelledTask.data.id,
        status: 'open',
        completed_at: null,
      },
    })
  })

  it('cancels a project atomically without overwriting already-closed child tasks and reopening does not restore children', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-20T10:00:00.000Z'))

    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const createdProject = run<{ id: string }>(handlers, 'project.create', {
      title: 'Project cancel root',
    })
    expect(createdProject.ok).toBe(true)
    if (!createdProject.ok) return

    const openTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Open child',
      project_id: createdProject.data.id,
    })
    expect(openTask.ok).toBe(true)
    if (!openTask.ok) return

    vi.setSystemTime(new Date('2026-03-20T10:01:00.000Z'))
    const doneTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Done child',
      project_id: createdProject.data.id,
    })
    expect(doneTask.ok).toBe(true)
    if (!doneTask.ok) return

    vi.setSystemTime(new Date('2026-03-20T10:02:00.000Z'))
    expect(
      run<{ id: string; status: 'done' }>(handlers, 'task.toggleDone', {
        id: doneTask.data.id,
        done: true,
      })
    ).toMatchObject({
      ok: true,
      data: {
        id: doneTask.data.id,
        status: 'done',
      },
    })

    vi.setSystemTime(new Date('2026-03-20T10:03:00.000Z'))
    const alreadyCancelledTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Already cancelled child',
      project_id: createdProject.data.id,
    })
    expect(alreadyCancelledTask.ok).toBe(true)
    if (!alreadyCancelledTask.ok) return

    vi.setSystemTime(new Date('2026-03-20T10:04:00.000Z'))
    expect(
      run<{ id: string; status: 'cancelled' }>(handlers, 'task.cancel', {
        id: alreadyCancelledTask.data.id,
      })
    ).toMatchObject({
      ok: true,
      data: {
        id: alreadyCancelledTask.data.id,
        status: 'cancelled',
      },
    })

    vi.setSystemTime(new Date('2026-03-20T10:05:00.000Z'))
    expect(
      run<{ project: { id: string; status: 'cancelled' }; tasks_completed: number }>(
        handlers,
        'project.cancel',
        { id: createdProject.data.id }
      )
    ).toMatchObject({
      ok: true,
      data: {
        project: {
          id: createdProject.data.id,
          status: 'cancelled',
        },
        tasks_completed: 1,
      },
    })

    const childRows = db
      .prepare(
        `SELECT title, status, completed_at
         FROM tasks
         WHERE project_id = ?
         ORDER BY title ASC`
      )
      .all(createdProject.data.id) as Array<{
      title: string
      status: string
      completed_at: string | null
    }>

    expect(childRows).toEqual([
      {
        title: 'Already cancelled child',
        status: 'cancelled',
        completed_at: '2026-03-20T10:04:00.000Z',
      },
      {
        title: 'Done child',
        status: 'done',
        completed_at: '2026-03-20T10:02:00.000Z',
      },
      {
        title: 'Open child',
        status: 'cancelled',
        completed_at: '2026-03-20T10:05:00.000Z',
      },
    ])

    expect(run<Array<{ id: string; status: string }>>(handlers, 'project.listDone', {})).toMatchObject({
      ok: true,
      data: [{ id: createdProject.data.id, status: 'cancelled' }],
    })

    expect(
      run<Array<{ id: string; status: string }>>(handlers, 'task.listProjectDone', {
        project_id: createdProject.data.id,
      })
    ).toMatchObject({
      ok: true,
      data: [
        { id: openTask.data.id, status: 'cancelled' },
        { id: doneTask.data.id, status: 'done' },
        { id: alreadyCancelledTask.data.id, status: 'cancelled' },
      ],
    })

    expect(
      run<{ count: number }>(handlers, 'task.countProjectDone', {
        project_id: createdProject.data.id,
      })
    ).toMatchObject({
      ok: true,
      data: { count: 3 },
    })

    vi.setSystemTime(new Date('2026-03-20T10:06:00.000Z'))
    expect(
      run<{ id: string; status: 'open'; completed_at: string | null }>(handlers, 'project.update', {
        id: createdProject.data.id,
        status: 'open',
      })
    ).toMatchObject({
      ok: true,
      data: {
        id: createdProject.data.id,
        status: 'open',
        completed_at: null,
      },
    })

    const reopenedChildRows = db
      .prepare(
        `SELECT title, status
         FROM tasks
         WHERE project_id = ?
         ORDER BY title ASC`
      )
      .all(createdProject.data.id) as Array<{ title: string; status: string }>

    expect(reopenedChildRows).toEqual([
      { title: 'Already cancelled child', status: 'cancelled' },
      { title: 'Done child', status: 'done' },
      { title: 'Open child', status: 'cancelled' },
    ])
  })
})
