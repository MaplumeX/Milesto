import { afterEach, describe, expect, it } from 'vitest'

import { buildDbHandlers } from '../../electron/workers/db/db-handlers'
import { dispatchDbRequest } from '../../electron/workers/db/db-dispatch'
import type { DbActionHandler } from '../../electron/workers/db/actions/db-actions'
import { TASK_LIST_ID_TODAY } from '../../shared/task-list-ids'
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

describe('view list DB contract', () => {
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    if (cleanup) await cleanup()
    cleanup = null
  })

  it('lists today tasks and projects as independent mixed rows with project progress and tags', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const handlers = buildDbHandlers(testDb.db)

    const tag = run<{ id: string }>(handlers, 'tag.create', { title: 'Focus' })
    const project = run<{ id: string }>(handlers, 'project.create', {
      title: 'Launch',
      scheduled_at: '2026-04-24',
    })
    expect(tag.ok && project.ok).toBe(true)
    if (!tag.ok || !project.ok) return

    const childTask = run<{ id: string }>(handlers, 'task.create', {
      title: 'Launch child',
      project_id: project.data.id,
      scheduled_at: '2026-04-24',
    })
    expect(childTask.ok).toBe(true)
    if (!childTask.ok) return

    expect(
      run(handlers, 'project.setTags', {
        project_id: project.data.id,
        tag_ids: [tag.data.id],
      })
    ).toMatchObject({ ok: true })
    expect(
      run(handlers, 'task.setTags', {
        task_id: childTask.data.id,
        tag_ids: [tag.data.id],
      })
    ).toMatchObject({ ok: true })

    const today = run<
      Array<{
        kind: 'task' | 'project'
        id: string
        title: string
        tag_ids?: string[]
        total_count?: number
        done_count?: number
      }>
    >(handlers, 'view.listToday', { date: '2026-04-24' })
    expect(today.ok).toBe(true)
    if (!today.ok) return

    expect(today.data.map((item) => ({ kind: item.kind, id: item.id }))).toEqual([
      { kind: 'project', id: project.data.id },
      { kind: 'task', id: childTask.data.id },
    ])
    expect(today.data[0]).toMatchObject({
      kind: 'project',
      title: 'Launch',
      tag_ids: [tag.data.id],
      total_count: 1,
      done_count: 0,
    })
    expect(today.data[1]).toMatchObject({
      kind: 'task',
      title: 'Launch child',
      tag_ids: [tag.data.id],
    })
  })

  it('persists unified manual ordering for today across tasks and projects', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const project = run<{ id: string }>(handlers, 'project.create', {
      title: 'Project first',
      scheduled_at: '2026-04-24',
    })
    const task = run<{ id: string }>(handlers, 'task.create', {
      title: 'Task second',
      scheduled_at: '2026-04-24',
    })
    expect(project.ok && task.ok).toBe(true)
    if (!project.ok || !task.ok) return

    const reordered = run<{ reordered: boolean }>(handlers, 'view.reorderBatch', {
      list_id: TASK_LIST_ID_TODAY,
      ordered_items: [
        { kind: 'task', id: task.data.id },
        { kind: 'project', id: project.data.id },
      ],
    })
    expect(reordered).toMatchObject({ ok: true, data: { reordered: true } })

    const today = run<Array<{ kind: 'task' | 'project'; id: string }>>(handlers, 'view.listToday', {
      date: '2026-04-24',
    })
    expect(today.ok).toBe(true)
    if (!today.ok) return
    expect(today.data.map((item) => `${item.kind}:${item.id}`)).toEqual([
      `task:${task.data.id}`,
      `project:${project.data.id}`,
    ])

    const rows = db
      .prepare(
        `SELECT entity_type, entity_id, rank
         FROM view_positions
         WHERE list_id = ?
         ORDER BY rank ASC`
      )
      .all(TASK_LIST_ID_TODAY) as Array<{ entity_type: string; entity_id: string; rank: number }>
    expect(rows).toEqual([
      { entity_type: 'task', entity_id: task.data.id, rank: 1000 },
      { entity_type: 'project', entity_id: project.data.id, rank: 2000 },
    ])
  })

  it('covers anytime, someday, and upcoming project buckets', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const handlers = buildDbHandlers(testDb.db)

    const anytimeProject = run<{ id: string }>(handlers, 'project.create', { title: 'Anytime Project' })
    const somedayProject = run<{ id: string }>(handlers, 'project.create', {
      title: 'Someday Project',
      is_someday: true,
    })
    const upcomingProject = run<{ id: string }>(handlers, 'project.create', {
      title: 'Upcoming Project',
      scheduled_at: '2026-04-30',
    })
    expect(anytimeProject.ok && somedayProject.ok && upcomingProject.ok).toBe(true)
    if (!anytimeProject.ok || !somedayProject.ok || !upcomingProject.ok) return

    const anytime = run<Array<{ kind: string; id: string }>>(handlers, 'view.listAnytime', {})
    const someday = run<Array<{ kind: string; id: string }>>(handlers, 'view.listSomeday', {})
    const upcoming = run<Array<{ kind: string; id: string }>>(handlers, 'view.listUpcoming', {
      from_date: '2026-04-24',
    })

    expect(anytime.ok && someday.ok && upcoming.ok).toBe(true)
    if (!anytime.ok || !someday.ok || !upcoming.ok) return

    expect(anytime.data.map((item) => `${item.kind}:${item.id}`)).toContain(`project:${anytimeProject.data.id}`)
    expect(someday.data.map((item) => `${item.kind}:${item.id}`)).toContain(`project:${somedayProject.data.id}`)
    expect(upcoming.data.map((item) => `${item.kind}:${item.id}`)).toContain(`project:${upcomingProject.data.id}`)
  })
})
