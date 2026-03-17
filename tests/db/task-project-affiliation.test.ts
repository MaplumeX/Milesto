import { afterEach, describe, expect, it } from 'vitest'

import { buildDbHandlers } from '../../electron/workers/db/db-handlers'
import { dispatchDbRequest } from '../../electron/workers/db/db-dispatch'
import { createTestDb } from './db-test-helper'

import type { DbWorkerRequest } from '../../shared/db-worker-protocol'

describe('task project affiliation DB contract', () => {
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    if (cleanup) await cleanup()
    cleanup = null
  })

  it('returns project_title for non-project task queries and search', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const createdProject = dispatchDbRequest(handlers, {
      id: '1',
      type: 'db',
      action: 'project.create',
      payload: { title: 'Project Alpha' },
    } satisfies DbWorkerRequest)
    expect(createdProject.ok).toBe(true)
    if (!createdProject.ok) return

    const projectId = createdProject.data.id

    const createdTodayTask = dispatchDbRequest(handlers, {
      id: '2',
      type: 'db',
      action: 'task.create',
      payload: { title: 'Task A', project_id: projectId, scheduled_at: '2026-03-17' },
    } satisfies DbWorkerRequest)
    expect(createdTodayTask.ok).toBe(true)

    const today = dispatchDbRequest(handlers, {
      id: '3',
      type: 'db',
      action: 'task.listToday',
      payload: { date: '2026-03-17' },
    } satisfies DbWorkerRequest)
    expect(today.ok).toBe(true)
    if (!today.ok) return
    expect(today.data[0]).toMatchObject({ project_id: projectId, project_title: 'Project Alpha' })

    const createdArea = dispatchDbRequest(handlers, {
      id: '4',
      type: 'db',
      action: 'area.create',
      payload: { title: 'Area One' },
    } satisfies DbWorkerRequest)
    expect(createdArea.ok).toBe(true)
    if (!createdArea.ok) return

    const areaId = createdArea.data.id

    const areaMove = dispatchDbRequest(handlers, {
      id: '5',
      type: 'db',
      action: 'task.update',
      payload: { id: createdTodayTask.ok ? createdTodayTask.data.id : '', area_id: areaId },
    } satisfies DbWorkerRequest)
    expect(areaMove.ok).toBe(true)

    const areaList = dispatchDbRequest(handlers, {
      id: '6',
      type: 'db',
      action: 'task.listArea',
      payload: { area_id: areaId },
    } satisfies DbWorkerRequest)
    expect(areaList.ok).toBe(true)
    if (!areaList.ok) return
    expect(areaList.data[0]).toMatchObject({ project_id: projectId, project_title: 'Project Alpha' })

    const search = dispatchDbRequest(handlers, {
      id: '7',
      type: 'db',
      action: 'task.search',
      payload: { query: 'Task' },
    } satisfies DbWorkerRequest)
    expect(search.ok).toBe(true)
    if (!search.ok) return
    expect(search.data[0]).toMatchObject({ project_id: projectId, project_title: 'Project Alpha' })
  })
})
