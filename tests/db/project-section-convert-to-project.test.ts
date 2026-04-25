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

describe('project.section.convertToProject', () => {
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    vi.useRealTimers()
    if (cleanup) await cleanup()
    cleanup = null
  })

  it('converts a section into a project and flattens section tasks into the new default list', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-25T12:00:00.000Z'))

    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const area = run<{ id: string }>(handlers, 'area.create', { title: 'Work' })
    expect(area.ok).toBe(true)
    if (!area.ok) return

    const sourceProject = run<{ id: string }>(handlers, 'project.create', {
      title: 'Parent project',
      area_id: area.data.id,
      scheduled_at: '2026-05-01',
      due_at: '2026-05-15',
    })
    expect(sourceProject.ok).toBe(true)
    if (!sourceProject.ok) return

    const before = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: sourceProject.data.id,
      title: 'Before',
    })
    const section = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: sourceProject.data.id,
      title: 'Launch slice',
    })
    const after = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: sourceProject.data.id,
      title: 'After',
    })
    expect(before.ok && section.ok && after.ok).toBe(true)
    if (!before.ok || !section.ok || !after.ok) return

    const task1 = run<{ id: string }>(handlers, 'task.create', {
      title: 'Task 1',
      project_id: sourceProject.data.id,
      section_id: section.data.id,
    })
    const task2 = run<{ id: string }>(handlers, 'task.create', {
      title: 'Task 2',
      project_id: sourceProject.data.id,
      section_id: section.data.id,
    })
    const task3 = run<{ id: string }>(handlers, 'task.create', {
      title: 'Task 3',
      project_id: sourceProject.data.id,
      section_id: section.data.id,
    })
    expect(task1.ok && task2.ok && task3.ok).toBe(true)
    if (!task1.ok || !task2.ok || !task3.ok) return

    expect(run(handlers, 'task.toggleDone', { id: task3.data.id, done: true })).toMatchObject({ ok: true })

    const sourceListId = taskListIdProject(sourceProject.data.id, section.data.id)
    expect(
      run(handlers, 'task.reorderBatch', {
        list_id: sourceListId,
        ordered_task_ids: [task2.data.id, task1.data.id, task3.data.id],
      })
    ).toMatchObject({ ok: true, data: { reordered: true } })

    const converted = run<{
      project: {
        id: string
        title: string
        notes: string
        area_id: string | null
        scheduled_at: string | null
        due_at: string | null
      }
      tasks_moved: number
    }>(handlers, 'project.section.convertToProject', { id: section.data.id })
    expect(converted.ok).toBe(true)
    if (!converted.ok) return

    expect(converted.data.tasks_moved).toBe(3)
    expect(converted.data.project).toMatchObject({
      title: 'Launch slice',
      notes: '',
      area_id: area.data.id,
      scheduled_at: '2026-05-01',
      due_at: '2026-05-15',
    })

    const sourceSections = run<Array<{ id: string; position: number }>>(handlers, 'project.section.list', {
      project_id: sourceProject.data.id,
    })
    expect(sourceSections.ok).toBe(true)
    if (!sourceSections.ok) return
    expect(sourceSections.data).toEqual([
      expect.objectContaining({ id: before.data.id, position: 1000 }),
      expect.objectContaining({ id: after.data.id, position: 2000 }),
    ])

    const sourceSectionRow = db
      .prepare(
        `SELECT deleted_at, purged_at
         FROM project_sections
         WHERE id = ?`
      )
      .get(section.data.id) as { deleted_at: string | null; purged_at: string | null }
    expect(sourceSectionRow).toEqual({
      deleted_at: '2026-04-25T12:00:00.000Z',
      purged_at: '2026-04-25T12:00:00.000Z',
    })

    const movedTaskRows = db
      .prepare(
        `SELECT id, project_id, section_id, area_id
         FROM tasks
         WHERE id IN (?, ?, ?)
         ORDER BY id ASC`
      )
      .all(task1.data.id, task2.data.id, task3.data.id) as Array<{
      id: string
      project_id: string
      section_id: string | null
      area_id: string | null
    }>
    const expectedTaskRows = [
      { id: task1.data.id, project_id: converted.data.project.id, section_id: null, area_id: null },
      { id: task2.data.id, project_id: converted.data.project.id, section_id: null, area_id: null },
      { id: task3.data.id, project_id: converted.data.project.id, section_id: null, area_id: null },
    ].sort((left, right) => left.id.localeCompare(right.id))
    expect(movedTaskRows).toEqual(expectedTaskRows)

    const targetListRows = db
      .prepare(
        `SELECT task_id, rank
         FROM list_positions
         WHERE list_id = ?
         ORDER BY rank ASC`
      )
      .all(taskListIdProject(converted.data.project.id, null)) as Array<{ task_id: string; rank: number }>
    expect(targetListRows).toEqual([
      { task_id: task2.data.id, rank: 1000 },
      { task_id: task1.data.id, rank: 2000 },
      { task_id: task3.data.id, rank: 3000 },
    ])

    const sourceListRows = db
      .prepare(
        `SELECT task_id, rank
         FROM list_positions
         WHERE list_id = ?`
      )
      .all(sourceListId) as Array<{ task_id: string; rank: number }>
    expect(sourceListRows).toEqual([])
  })

  it('converts an empty untitled section into an empty untitled project', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const handlers = buildDbHandlers(testDb.db)

    const sourceProject = run<{ id: string }>(handlers, 'project.create', { title: 'Parent project' })
    expect(sourceProject.ok).toBe(true)
    if (!sourceProject.ok) return

    const section = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: sourceProject.data.id,
      title: '',
    })
    expect(section.ok).toBe(true)
    if (!section.ok) return

    const converted = run<{ project: { id: string; title: string }; tasks_moved: number }>(
      handlers,
      'project.section.convertToProject',
      { id: section.data.id }
    )
    expect(converted).toMatchObject({
      ok: true,
      data: {
        project: { title: '' },
        tasks_moved: 0,
      },
    })
  })

  it('rejects deleted sections without creating a project', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const sourceProject = run<{ id: string }>(handlers, 'project.create', { title: 'Parent project' })
    expect(sourceProject.ok).toBe(true)
    if (!sourceProject.ok) return

    const section = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: sourceProject.data.id,
      title: 'Deleted section',
    })
    expect(section.ok).toBe(true)
    if (!section.ok) return

    expect(run(handlers, 'project.section.delete', { id: section.data.id })).toMatchObject({ ok: true })

    const converted = run(handlers, 'project.section.convertToProject', { id: section.data.id })
    expect(converted).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })

    const projectRows = db
      .prepare(
        `SELECT id
         FROM projects
         WHERE title = ?`
      )
      .all('Deleted section')
    expect(projectRows).toEqual([])
  })

  it('rolls back project creation, task movement, and section deletion when conversion fails', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const sourceProject = run<{ id: string }>(handlers, 'project.create', { title: 'Parent project' })
    expect(sourceProject.ok).toBe(true)
    if (!sourceProject.ok) return

    const section = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: sourceProject.data.id,
      title: 'Rollback section',
    })
    expect(section.ok).toBe(true)
    if (!section.ok) return

    const task = run<{ id: string }>(handlers, 'task.create', {
      title: 'Task',
      project_id: sourceProject.data.id,
      section_id: section.data.id,
    })
    expect(task.ok).toBe(true)
    if (!task.ok) return

    const sourceListId = taskListIdProject(sourceProject.data.id, section.data.id)
    expect(
      run(handlers, 'task.reorderBatch', {
        list_id: sourceListId,
        ordered_task_ids: [task.data.id],
      })
    ).toMatchObject({ ok: true })

    db.exec(`
      CREATE TRIGGER fail_section_convert_task_update
      BEFORE UPDATE OF project_id ON tasks
      WHEN old.section_id = '${section.data.id}' AND new.section_id IS NULL
      BEGIN
        SELECT RAISE(ABORT, 'forced section convert failure');
      END;
    `)

    const converted = run(handlers, 'project.section.convertToProject', { id: section.data.id })
    expect(converted).toMatchObject({
      ok: false,
      error: { code: 'DB_UNHANDLED' },
    })

    const projectRows = db
      .prepare(
        `SELECT id
         FROM projects
         WHERE title = ?`
      )
      .all('Rollback section')
    expect(projectRows).toEqual([])

    const sectionRow = db
      .prepare(
        `SELECT deleted_at
         FROM project_sections
         WHERE id = ?`
      )
      .get(section.data.id) as { deleted_at: string | null }
    expect(sectionRow.deleted_at).toBeNull()

    const taskRow = db
      .prepare(
        `SELECT project_id, section_id
         FROM tasks
         WHERE id = ?`
      )
      .get(task.data.id) as { project_id: string; section_id: string | null }
    expect(taskRow).toEqual({
      project_id: sourceProject.data.id,
      section_id: section.data.id,
    })

    const sourceListRows = db
      .prepare(
        `SELECT task_id, rank
         FROM list_positions
         WHERE list_id = ?`
      )
      .all(sourceListId) as Array<{ task_id: string; rank: number }>
    expect(sourceListRows).toEqual([{ task_id: task.data.id, rank: 1000 }])
  })
})
