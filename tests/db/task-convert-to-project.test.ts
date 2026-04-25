import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildDbHandlers } from '../../electron/workers/db/db-handlers'
import { dispatchDbRequest } from '../../electron/workers/db/db-dispatch'
import type { DbActionHandler } from '../../electron/workers/db/actions/db-actions'
import { taskListIdProject } from '../../shared/task-list-ids'
import { createTestDb } from './db-test-helper'

type Ok<T> = { ok: true; data: T }
type Err = { ok: false; error: { code: string; message: string; details?: unknown } }
type Res<T> = Ok<T> | Err

function run<T>(handlers: Record<string, DbActionHandler>, action: string, payload: unknown): Res<T> {
  return dispatchDbRequest(handlers, {
    id: `${action}-${Math.random()}`,
    type: 'db',
    action,
    payload,
  }) as Res<T>
}

describe('task.convertToProject', () => {
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    vi.useRealTimers()
    if (cleanup) await cleanup()
    cleanup = null
  })

  it('converts a standalone task into a project and permanently purges the source task', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-25T10:30:00.000Z'))

    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const handlers = buildDbHandlers(testDb.db)

    const area = run<{ id: string }>(handlers, 'area.create', { title: 'Work' })
    expect(area.ok).toBe(true)
    if (!area.ok) return

    const sourceTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Launch campaign',
      notes: 'Project-level notes',
      area_id: area.data.id,
      scheduled_at: '2026-05-01',
      due_at: '2026-05-15',
    })
    expect(sourceTask.ok).toBe(true)
    if (!sourceTask.ok) return

    const tagA = run<{ id: string }>(handlers, 'tag.create', { title: 'Focus' })
    const tagB = run<{ id: string }>(handlers, 'tag.create', { title: 'Client' })
    expect(tagA.ok && tagB.ok).toBe(true)
    if (!tagA.ok || !tagB.ok) return

    expect(
      run(handlers, 'task.setTags', {
        task_id: sourceTask.data.id,
        tag_ids: [tagA.data.id, tagB.data.id],
      })
    ).toMatchObject({ ok: true })

    const openChecklist = run<{ id: string }>(handlers, 'checklist.create', {
      task_id: sourceTask.data.id,
      title: 'Draft brief',
    })
    const doneChecklist = run<{ id: string }>(handlers, 'checklist.create', {
      task_id: sourceTask.data.id,
      title: 'Collect references',
    })
    expect(openChecklist.ok && doneChecklist.ok).toBe(true)
    if (!openChecklist.ok || !doneChecklist.ok) return

    expect(
      run(handlers, 'checklist.update', {
        id: doneChecklist.data.id,
        done: true,
      })
    ).toMatchObject({ ok: true })

    const converted = run<{
      project: { id: string; title: string; notes: string; area_id: string | null; scheduled_at: string | null; due_at: string | null }
      tasks_created: number
    }>(handlers, 'task.convertToProject', { id: sourceTask.data.id })
    expect(converted.ok).toBe(true)
    if (!converted.ok) return

    expect(converted.data.tasks_created).toBe(2)
    expect(converted.data.project).toMatchObject({
      title: 'Launch campaign',
      notes: 'Project-level notes',
      area_id: area.data.id,
      scheduled_at: '2026-05-01',
      due_at: '2026-05-15',
    })

    const projectDetail = run<{ project: { id: string }; tags: Array<{ id: string; title: string }> }>(
      handlers,
      'project.getDetail',
      { id: converted.data.project.id }
    )
    expect(projectDetail.ok).toBe(true)
    if (!projectDetail.ok) return
    expect(projectDetail.data.tags.map((tag) => tag.title)).toEqual(['Focus', 'Client'])

    const openChildren = run<Array<{ id: string; title: string; status: string }>>(handlers, 'task.listProject', {
      project_id: converted.data.project.id,
    })
    expect(openChildren.ok).toBe(true)
    if (!openChildren.ok) return
    expect(openChildren.data).toMatchObject([{ title: 'Draft brief', status: 'open' }])

    const doneChildren = run<Array<{ id: string; title: string; status: string; completed_at: string | null }>>(
      handlers,
      'task.listProjectDone',
      { project_id: converted.data.project.id }
    )
    expect(doneChildren.ok).toBe(true)
    if (!doneChildren.ok) return
    expect(doneChildren.data).toMatchObject([
      {
        title: 'Collect references',
        status: 'done',
        completed_at: '2026-04-25T10:30:00.000Z',
      },
    ])

    const childPositions = testDb.db
      .prepare(
        `SELECT task_id, rank
         FROM list_positions
         WHERE list_id = ?
         ORDER BY rank ASC`
      )
      .all(taskListIdProject(converted.data.project.id, null)) as Array<{ task_id: string; rank: number }>
    expect(childPositions.map((row) => row.task_id)).toEqual([openChildren.data[0]!.id, doneChildren.data[0]!.id])
    expect(childPositions.map((row) => row.rank)).toEqual([1000, 2000])

    expect(run(handlers, 'task.getDetail', { id: sourceTask.data.id })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
    expect(run<Array<{ kind: string; id: string }>>(handlers, 'trash.list', {}).ok).toBe(true)
    const trash = run<Array<{ kind: string; id: string }>>(handlers, 'trash.list', {})
    expect(trash.ok).toBe(true)
    if (!trash.ok) return
    expect(trash.data.some((entry) => entry.kind === 'task' && entry.id === sourceTask.data.id)).toBe(false)

    const sourceRow = testDb.db
      .prepare(
        `SELECT deleted_at, purged_at
         FROM tasks
         WHERE id = ?`
      )
      .get(sourceTask.data.id) as { deleted_at: string | null; purged_at: string | null }
    expect(sourceRow).toEqual({
      deleted_at: '2026-04-25T10:30:00.000Z',
      purged_at: '2026-04-25T10:30:00.000Z',
    })

    const sourceChecklistRows = testDb.db
      .prepare(
        `SELECT deleted_at
         FROM task_checklist_items
         WHERE task_id = ?
         ORDER BY position ASC`
      )
      .all(sourceTask.data.id) as Array<{ deleted_at: string | null }>
    expect(sourceChecklistRows.map((row) => row.deleted_at)).toEqual([
      '2026-04-25T10:30:00.000Z',
      '2026-04-25T10:30:00.000Z',
    ])
  })

  it('inherits the parent project area when converting a task inside a project', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const handlers = buildDbHandlers(testDb.db)

    const parentArea = run<{ id: string }>(handlers, 'area.create', { title: 'Parent Area' })
    const directArea = run<{ id: string }>(handlers, 'area.create', { title: 'Direct Task Area' })
    expect(parentArea.ok && directArea.ok).toBe(true)
    if (!parentArea.ok || !directArea.ok) return

    const parentProject = run<{ id: string }>(handlers, 'project.create', {
      title: 'Parent Project',
      area_id: parentArea.data.id,
    })
    expect(parentProject.ok).toBe(true)
    if (!parentProject.ok) return

    const sourceTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Nested task',
      project_id: parentProject.data.id,
      area_id: directArea.data.id,
    })
    expect(sourceTask.ok).toBe(true)
    if (!sourceTask.ok) return

    const converted = run<{ project: { id: string; area_id: string | null } }>(handlers, 'task.convertToProject', {
      id: sourceTask.data.id,
    })
    expect(converted).toMatchObject({
      ok: true,
      data: {
        project: {
          area_id: parentArea.data.id,
        },
      },
    })
  })

  it('rejects closed tasks without creating a project or purging the source task', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const handlers = buildDbHandlers(testDb.db)

    const sourceTask = run<{ id: string }>(handlers, 'task.create', { title: 'Already done' })
    expect(sourceTask.ok).toBe(true)
    if (!sourceTask.ok) return

    expect(
      run(handlers, 'task.toggleDone', {
        id: sourceTask.data.id,
        done: true,
      })
    ).toMatchObject({ ok: true })

    const converted = run(handlers, 'task.convertToProject', { id: sourceTask.data.id })
    expect(converted).toMatchObject({
      ok: false,
      error: { code: 'INVALID_STATE_TRANSITION' },
    })

    const projectRows = testDb.db
      .prepare(
        `SELECT id
         FROM projects
         WHERE title = ?`
      )
      .all('Already done')
    expect(projectRows).toEqual([])

    const sourceRow = testDb.db
      .prepare(
        `SELECT deleted_at, purged_at
         FROM tasks
         WHERE id = ?`
      )
      .get(sourceTask.data.id) as { deleted_at: string | null; purged_at: string | null }
    expect(sourceRow).toEqual({ deleted_at: null, purged_at: null })
  })
})
