import { afterEach, describe, expect, it } from 'vitest'

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

describe('project.section.move', () => {
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    if (cleanup) await cleanup()
    cleanup = null
  })

  it('moves a section to another open project and migrates task ordering', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const sourceProject = run<{ id: string }>(handlers, 'project.create', { title: 'Source' })
    const targetProject = run<{ id: string }>(handlers, 'project.create', { title: 'Target' })
    expect(sourceProject.ok).toBe(true)
    expect(targetProject.ok).toBe(true)
    if (!sourceProject.ok || !targetProject.ok) return

    const sourceA = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: sourceProject.data.id,
      title: 'Source A',
    })
    const movedSection = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: sourceProject.data.id,
      title: 'Moved',
    })
    const sourceC = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: sourceProject.data.id,
      title: 'Source C',
    })
    const targetA = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: targetProject.data.id,
      title: 'Target A',
    })
    const targetB = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: targetProject.data.id,
      title: 'Target B',
    })
    expect(sourceA.ok && movedSection.ok && sourceC.ok && targetA.ok && targetB.ok).toBe(true)
    if (!sourceA.ok || !movedSection.ok || !sourceC.ok || !targetA.ok || !targetB.ok) return

    const task1 = run<{ id: string }>(handlers, 'task.create', {
      title: 'Task 1',
      project_id: sourceProject.data.id,
      section_id: movedSection.data.id,
    })
    const task2 = run<{ id: string }>(handlers, 'task.create', {
      title: 'Task 2',
      project_id: sourceProject.data.id,
      section_id: movedSection.data.id,
    })
    const task3 = run<{ id: string }>(handlers, 'task.create', {
      title: 'Task 3',
      project_id: sourceProject.data.id,
      section_id: movedSection.data.id,
    })
    expect(task1.ok && task2.ok && task3.ok).toBe(true)
    if (!task1.ok || !task2.ok || !task3.ok) return

    const sourceListId = taskListIdProject(sourceProject.data.id, movedSection.data.id)
    const targetListId = taskListIdProject(targetProject.data.id, movedSection.data.id)
    const reordered = run<{ reordered: boolean }>(handlers, 'task.reorderBatch', {
      list_id: sourceListId,
      ordered_task_ids: [task2.data.id, task1.data.id, task3.data.id],
    })
    expect(reordered).toMatchObject({ ok: true, data: { reordered: true } })

    const moved = run<{ moved: boolean }>(handlers, 'project.section.move', {
      id: movedSection.data.id,
      target_project_id: targetProject.data.id,
    })
    expect(moved).toMatchObject({ ok: true, data: { moved: true } })

    const sourceSections = run<Array<{ id: string; position: number }>>(handlers, 'project.section.list', {
      project_id: sourceProject.data.id,
    })
    const targetSections = run<Array<{ id: string; position: number }>>(handlers, 'project.section.list', {
      project_id: targetProject.data.id,
    })
    expect(sourceSections.ok).toBe(true)
    expect(targetSections.ok).toBe(true)
    if (!sourceSections.ok || !targetSections.ok) return

    expect(sourceSections.data.map((section) => section.id)).toEqual([sourceA.data.id, sourceC.data.id])
    expect(sourceSections.data.map((section) => section.position)).toEqual([1000, 2000])
    expect(targetSections.data.map((section) => section.id)).toEqual([
      targetA.data.id,
      targetB.data.id,
      movedSection.data.id,
    ])

    const movedSectionRow = db
      .prepare(
        `SELECT project_id, position
         FROM project_sections
         WHERE id = ?`
      )
      .get(movedSection.data.id) as { project_id: string; position: number } | undefined
    expect(movedSectionRow).toEqual({
      project_id: targetProject.data.id,
      position: 3000,
    })

    const movedTaskRows = db
      .prepare(
        `SELECT id, project_id, section_id
         FROM tasks
         WHERE section_id = ?
         ORDER BY id ASC`
      )
      .all(movedSection.data.id) as Array<{ id: string; project_id: string; section_id: string | null }>
    const expectedMovedTaskRows = [
      { id: task1.data.id, project_id: targetProject.data.id, section_id: movedSection.data.id },
      { id: task2.data.id, project_id: targetProject.data.id, section_id: movedSection.data.id },
      { id: task3.data.id, project_id: targetProject.data.id, section_id: movedSection.data.id },
    ].sort((left, right) => left.id.localeCompare(right.id))
    expect(movedTaskRows).toEqual(expectedMovedTaskRows)

    const sourceListRows = db
      .prepare(
        `SELECT task_id, rank
         FROM list_positions
         WHERE list_id = ?
         ORDER BY rank ASC`
      )
      .all(sourceListId) as Array<{ task_id: string; rank: number }>
    const targetListRows = db
      .prepare(
        `SELECT task_id, rank
         FROM list_positions
         WHERE list_id = ?
         ORDER BY rank ASC`
      )
      .all(targetListId) as Array<{ task_id: string; rank: number }>
    expect(sourceListRows).toEqual([])
    expect(targetListRows).toEqual([
      { task_id: task2.data.id, rank: 1000 },
      { task_id: task1.data.id, rank: 2000 },
      { task_id: task3.data.id, rank: 3000 },
    ])

  })

  it('treats moving into the current project as a no-op', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const project = run<{ id: string }>(handlers, 'project.create', { title: 'Project' })
    expect(project.ok).toBe(true)
    if (!project.ok) return

    const section = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: project.data.id,
      title: 'Section',
    })
    expect(section.ok).toBe(true)
    if (!section.ok) return

    const result = run<{ moved: boolean }>(handlers, 'project.section.move', {
      id: section.data.id,
      target_project_id: project.data.id,
    })
    expect(result).toMatchObject({ ok: true, data: { moved: false } })

    const row = db
      .prepare(
        `SELECT project_id, position
         FROM project_sections
         WHERE id = ?`
      )
      .get(section.data.id) as { project_id: string; position: number } | undefined
    expect(row).toEqual({ project_id: project.data.id, position: 1000 })
  })

  it('rejects closed target projects', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const sourceProject = run<{ id: string }>(handlers, 'project.create', { title: 'Source' })
    const targetProject = run<{ id: string }>(handlers, 'project.create', { title: 'Closed Target' })
    expect(sourceProject.ok && targetProject.ok).toBe(true)
    if (!sourceProject.ok || !targetProject.ok) return

    const section = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: sourceProject.data.id,
      title: 'Section',
    })
    expect(section.ok).toBe(true)
    if (!section.ok) return

    const closed = run<{ project: { status: string } }>(handlers, 'project.complete', {
      id: targetProject.data.id,
    })
    expect(closed).toMatchObject({ ok: true, data: { project: { status: 'done' } } })

    const result = run<{ moved: boolean }>(handlers, 'project.section.move', {
      id: section.data.id,
      target_project_id: targetProject.data.id,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_MOVE')
    }

    const row = db
      .prepare(
        `SELECT project_id
         FROM project_sections
         WHERE id = ?`
      )
      .get(section.data.id) as { project_id: string } | undefined
    expect(row?.project_id).toBe(sourceProject.data.id)
  })

  it('rolls back section, task, and ordering changes when persistence fails mid-transfer', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const sourceProject = run<{ id: string }>(handlers, 'project.create', { title: 'Source' })
    const targetProject = run<{ id: string }>(handlers, 'project.create', { title: 'Target' })
    expect(sourceProject.ok && targetProject.ok).toBe(true)
    if (!sourceProject.ok || !targetProject.ok) return

    const section = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: sourceProject.data.id,
      title: 'Section',
    })
    const sibling = run<{ id: string }>(handlers, 'project.section.create', {
      project_id: sourceProject.data.id,
      title: 'Sibling',
    })
    expect(section.ok && sibling.ok).toBe(true)
    if (!section.ok || !sibling.ok) return

    const task = run<{ id: string }>(handlers, 'task.create', {
      title: 'Task',
      project_id: sourceProject.data.id,
      section_id: section.data.id,
    })
    expect(task.ok).toBe(true)
    if (!task.ok) return

    const sourceListId = taskListIdProject(sourceProject.data.id, section.data.id)
    const targetListId = taskListIdProject(targetProject.data.id, section.data.id)
    expect(
      run<{ reordered: boolean }>(handlers, 'task.reorderBatch', {
        list_id: sourceListId,
        ordered_task_ids: [task.data.id],
      })
    ).toMatchObject({ ok: true, data: { reordered: true } })

    db.exec(`
      CREATE TRIGGER fail_section_move_task_update
      BEFORE UPDATE OF project_id ON tasks
      WHEN old.section_id = '${section.data.id}' AND new.project_id = '${targetProject.data.id}'
      BEGIN
        SELECT RAISE(ABORT, 'forced move failure');
      END;
    `)

    const result = run<{ moved: boolean }>(handlers, 'project.section.move', {
      id: section.data.id,
      target_project_id: targetProject.data.id,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('DB_UNHANDLED')
    }

    const sectionRow = db
      .prepare(
        `SELECT project_id, position
         FROM project_sections
         WHERE id = ?`
      )
      .get(section.data.id) as { project_id: string; position: number } | undefined
    expect(sectionRow).toEqual({
      project_id: sourceProject.data.id,
      position: 1000,
    })

    const taskRow = db
      .prepare(
        `SELECT project_id, section_id
         FROM tasks
         WHERE id = ?`
      )
      .get(task.data.id) as { project_id: string; section_id: string | null } | undefined
    expect(taskRow).toEqual({
      project_id: sourceProject.data.id,
      section_id: section.data.id,
    })

    const sourceSections = run<Array<{ id: string }>>(handlers, 'project.section.list', {
      project_id: sourceProject.data.id,
    })
    const targetSections = run<Array<{ id: string }>>(handlers, 'project.section.list', {
      project_id: targetProject.data.id,
    })
    expect(sourceSections.ok && targetSections.ok).toBe(true)
    if (!sourceSections.ok || !targetSections.ok) return

    expect(sourceSections.data.map((entry) => entry.id)).toEqual([section.data.id, sibling.data.id])
    expect(targetSections.data).toEqual([])

    const sourceListRows = db
      .prepare(
        `SELECT task_id, rank
         FROM list_positions
         WHERE list_id = ?
         ORDER BY rank ASC`
      )
      .all(sourceListId) as Array<{ task_id: string; rank: number }>
    const targetListRows = db
      .prepare(
        `SELECT task_id, rank
         FROM list_positions
         WHERE list_id = ?
         ORDER BY rank ASC`
      )
      .all(targetListId) as Array<{ task_id: string; rank: number }>
    expect(sourceListRows).toEqual([{ task_id: task.data.id, rank: 1000 }])
    expect(targetListRows).toEqual([])
  })
})
