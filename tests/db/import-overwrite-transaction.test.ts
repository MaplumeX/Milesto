import { afterEach, describe, expect, it } from 'vitest'

import { buildDbHandlers } from '../../electron/workers/db/db-handlers'
import { dispatchDbRequest } from '../../electron/workers/db/db-dispatch'
import { createTestDb } from './db-test-helper'

import type { DbWorkerRequest } from '../../shared/db-worker-protocol'
import type { DataExport } from '../../shared/schemas/data-transfer'

describe('DB import overwrite is transactional', () => {
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    if (cleanup) await cleanup()
    cleanup = null
  })

  it('rolls back on foreign key failure (no partial data)', async () => {
    const testDb = await createTestDb()
    cleanup = testDb.cleanup

    const { db } = testDb
    const handlers = buildDbHandlers(db)

    const createReq: DbWorkerRequest = {
      id: '1',
      type: 'db',
      action: 'task.create',
      payload: { title: 'Existing task' },
    }
    const created = dispatchDbRequest(handlers, createReq)
    expect(created.ok).toBe(true)

    const before = db.prepare('SELECT COUNT(1) AS c FROM tasks WHERE deleted_at IS NULL').get() as { c: number }
    expect(before.c).toBe(1)

    const badExport: DataExport = {
      schema_version: 2,
      app_version: 'test',
      exported_at: '2026-01-01T00:00:00.000Z',
      tasks: [
        {
          id: 't_bad',
          title: 'Bad task',
          notes: '',
          status: 'open',
          is_inbox: false,
          is_someday: false,
          project_id: 'p_missing',
          section_id: null,
          area_id: null,
          scheduled_at: null,
          due_at: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          completed_at: null,
          deleted_at: null,
        },
      ],
      projects: [],
      project_sections: [],
      areas: [],
      tags: [],
      task_tags: [],
      checklist_items: [],
      list_positions: [],
    }

    const importReq: DbWorkerRequest = {
      id: '2',
      type: 'db',
      action: 'data.importOverwrite',
      payload: { mode: 'overwrite', data: badExport },
    }
    const imported = dispatchDbRequest(handlers, importReq)

    expect(imported.ok).toBe(false)
    if (!imported.ok) {
      expect(imported.error.code).toBe('DB_UNHANDLED')
    }

    // If the transaction rolled back, the original row must still be present.
    const after = db.prepare('SELECT COUNT(1) AS c FROM tasks WHERE deleted_at IS NULL').get() as { c: number }
    expect(after.c).toBe(1)

    const row = db.prepare('SELECT title FROM tasks WHERE deleted_at IS NULL LIMIT 1').get() as { title: string }
    expect(row.title).toBe('Existing task')
  })
})
