import { afterEach, describe, expect, it } from 'vitest'

import { buildDbHandlers } from '../../electron/workers/db/db-handlers'
import { dispatchDbRequest } from '../../electron/workers/db/db-dispatch'
import type { DbActionHandler } from '../../electron/workers/db/actions/db-actions'
import type { DbWorkerRequest } from '../../shared/db-worker-protocol'
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
  } satisfies DbWorkerRequest) as Res<T>
}

function unwrap<T>(res: Res<T>): T {
  if (!res.ok) throw new Error(`Expected ok, got ${res.error.code}: ${res.error.message}`)
  return res.data
}

describe('project section status behavior', () => {
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    if (cleanup) await cleanup()
    cleanup = null
  })

  it('reorders only open sections when archived sections exist', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const handlers = buildDbHandlers(testDb.db)
    const project = unwrap(run<{ id: string }>(handlers, 'project.create', { title: 'Project' }))
    const first = unwrap(
      run<{ id: string }>(handlers, 'project.section.create', { project_id: project.id, title: 'First' })
    )
    const archived = unwrap(
      run<{ id: string }>(handlers, 'project.section.create', { project_id: project.id, title: 'Archived' })
    )
    const last = unwrap(
      run<{ id: string }>(handlers, 'project.section.create', { project_id: project.id, title: 'Last' })
    )

    expect(run(handlers, 'project.section.archive', { id: archived.id })).toMatchObject({ ok: true })

    const reordered = run<{ reordered: boolean }>(handlers, 'project.section.reorderBatch', {
      project_id: project.id,
      ordered_section_ids: [last.id, first.id],
    })
    expect(reordered).toMatchObject({ ok: true, data: { reordered: true } })

    const openRows = testDb.db
      .prepare(
        `SELECT id, position
         FROM project_sections
         WHERE project_id = ? AND status = 'open'
         ORDER BY position ASC`
      )
      .all(project.id) as Array<{ id: string; position: number }>

    expect(openRows).toEqual([
      { id: last.id, position: 1000 },
      { id: first.id, position: 2000 },
    ])
  })

  it('does not move tasks into archived sections when deleting a later open section', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const handlers = buildDbHandlers(testDb.db)
    const project = unwrap(run<{ id: string }>(handlers, 'project.create', { title: 'Project' }))
    const archived = unwrap(
      run<{ id: string }>(handlers, 'project.section.create', { project_id: project.id, title: 'Archived' })
    )
    const deleted = unwrap(
      run<{ id: string }>(handlers, 'project.section.create', { project_id: project.id, title: 'Delete me' })
    )
    const task = unwrap(
      run<{ id: string }>(handlers, 'task.create', {
        title: 'Task',
        project_id: project.id,
        section_id: deleted.id,
      })
    )

    expect(run(handlers, 'project.section.archive', { id: archived.id })).toMatchObject({ ok: true })
    expect(run(handlers, 'project.section.delete', { id: deleted.id })).toMatchObject({
      ok: true,
      data: { deleted: true, moved_to_section_id: null },
    })

    const taskRow = testDb.db.prepare('SELECT section_id FROM tasks WHERE id = ?').get(task.id) as {
      section_id: string | null
    }
    expect(taskRow.section_id).toBeNull()
  })
})
