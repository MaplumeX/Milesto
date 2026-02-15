import { afterEach, describe, expect, it } from 'vitest'

import { buildDbHandlers } from '../../electron/workers/db/db-handlers'
import { dispatchDbRequest } from '../../electron/workers/db/db-dispatch'
import { createTestDb } from './db-test-helper'

import type { DbWorkerRequest } from '../../shared/db-worker-protocol'

describe('task.rolloverScheduledToToday', () => {
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    if (cleanup) await cleanup()
    cleanup = null
  })

  it('rolls past scheduled open tasks to today (done/deleted untouched; idempotent)', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const createPastOpen: DbWorkerRequest = {
      id: '1',
      type: 'db',
      action: 'task.create',
      payload: { title: 'Past open', scheduled_at: '2026-02-14' },
    }
    const pastOpen = dispatchDbRequest(handlers, createPastOpen)
    expect(pastOpen.ok).toBe(true)
    if (!pastOpen.ok) return
    const pastOpenId = (pastOpen.data as { id: string }).id

    db.prepare('UPDATE tasks SET updated_at = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z', pastOpenId)

    const today = '2026-02-15'
    const createTodayOpen = dispatchDbRequest(handlers, {
      id: '2',
      type: 'db',
      action: 'task.create',
      payload: { title: 'Today open', scheduled_at: today },
    })
    expect(createTodayOpen.ok).toBe(true)

    const createFutureOpen = dispatchDbRequest(handlers, {
      id: '3',
      type: 'db',
      action: 'task.create',
      payload: { title: 'Future open', scheduled_at: '2026-02-20' },
    })
    expect(createFutureOpen.ok).toBe(true)

    const donePast = dispatchDbRequest(handlers, {
      id: '4',
      type: 'db',
      action: 'task.create',
      payload: { title: 'Past done', scheduled_at: '2026-02-14' },
    })
    expect(donePast.ok).toBe(true)
    if (!donePast.ok) return
    const donePastId = (donePast.data as { id: string }).id
    const toggled = dispatchDbRequest(handlers, {
      id: '5',
      type: 'db',
      action: 'task.toggleDone',
      payload: { id: donePastId, done: true },
    })
    expect(toggled.ok).toBe(true)

    const deletedPast = dispatchDbRequest(handlers, {
      id: '6',
      type: 'db',
      action: 'task.create',
      payload: { title: 'Past deleted', scheduled_at: '2026-02-14' },
    })
    expect(deletedPast.ok).toBe(true)
    if (!deletedPast.ok) return
    const deletedPastId = (deletedPast.data as { id: string }).id
    const deleted = dispatchDbRequest(handlers, {
      id: '7',
      type: 'db',
      action: 'task.delete',
      payload: { id: deletedPastId },
    })
    expect(deleted.ok).toBe(true)

    const roll1 = dispatchDbRequest(handlers, {
      id: '8',
      type: 'db',
      action: 'task.rolloverScheduledToToday',
      payload: { today },
    })
    expect(roll1.ok).toBe(true)
    if (!roll1.ok) return
    expect((roll1.data as { rolled_count: number }).rolled_count).toBe(1)

    const pastRow1 = db
      .prepare('SELECT scheduled_at, updated_at FROM tasks WHERE id = ? LIMIT 1')
      .get(pastOpenId) as { scheduled_at: string | null; updated_at: string }
    expect(pastRow1.scheduled_at).toBe(today)
    expect(pastRow1.updated_at).not.toBe('2000-01-01T00:00:00.000Z')

    const doneRow = db
      .prepare('SELECT status, scheduled_at FROM tasks WHERE id = ? LIMIT 1')
      .get(donePastId) as { status: string; scheduled_at: string | null }
    expect(doneRow.status).toBe('done')
    expect(doneRow.scheduled_at).toBe('2026-02-14')

    const deletedRow = db
      .prepare('SELECT deleted_at, scheduled_at FROM tasks WHERE id = ? LIMIT 1')
      .get(deletedPastId) as { deleted_at: string | null; scheduled_at: string | null }
    expect(deletedRow.deleted_at).not.toBeNull()
    expect(deletedRow.scheduled_at).toBe('2026-02-14')

    const roll2 = dispatchDbRequest(handlers, {
      id: '9',
      type: 'db',
      action: 'task.rolloverScheduledToToday',
      payload: { today },
    })
    expect(roll2.ok).toBe(true)
    if (!roll2.ok) return
    expect((roll2.data as { rolled_count: number }).rolled_count).toBe(0)

    const pastRow2 = db
      .prepare('SELECT scheduled_at, updated_at FROM tasks WHERE id = ? LIMIT 1')
      .get(pastOpenId) as { scheduled_at: string | null; updated_at: string }
    expect(pastRow2.scheduled_at).toBe(today)
    expect(pastRow2.updated_at).toBe(pastRow1.updated_at)
  })
})
