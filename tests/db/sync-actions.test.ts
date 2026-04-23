import { describe, expect, it } from 'vitest'

import { buildDbHandlers } from '../../electron/workers/db/db-handlers'
import type { DbActionHandler } from '../../electron/workers/db/actions/db-actions'
import { dispatchDbRequest } from '../../electron/workers/db/db-dispatch'
import { createTestDb } from './db-test-helper'
import type { DbWorkerRequest } from '../../shared/db-worker-protocol'

type Res<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; details?: unknown } }

function run<T>(handlers: Record<string, DbActionHandler>, action: string, payload: unknown): Res<T> {
  return dispatchDbRequest(handlers, {
    id: `${action}-${Math.random()}`,
    type: 'db',
    action,
    payload,
  } satisfies DbWorkerRequest) as Res<T>
}

function ok<T>(res: Res<T>): T {
  if (!res.ok) throw new Error(`Expected ok, got error: ${res.error.code} - ${JSON.stringify(res.error.details ?? {})}`)
  return res.data
}

describe('sync-actions DB contract', () => {
  it('sync.getState returns sync state keys', async () => {
    const { db, cleanup } = await createTestDb()
    const handlers = buildDbHandlers(db)

    const state = ok(run<Record<string, string>>(handlers, 'sync.getState', {}))
    expect(state).toHaveProperty('last_sync_at')
    expect(state).toHaveProperty('sync_enabled')
    expect(state).toHaveProperty('server_url')
    expect(state).toHaveProperty('sync_token')

    await cleanup()
  })

  it('sync.setConfig and sync.getState round-trip', async () => {
    const { db, cleanup } = await createTestDb()
    const handlers = buildDbHandlers(db)

    ok(run(handlers, 'sync.setConfig', {
      server_url: 'ws://localhost:8787',
      sync_token: 'my-secret-token',
      sync_enabled: true,
    }))

    const state = ok(run<Record<string, string>>(handlers, 'sync.getState', {}))
    expect(state.server_url).toBe('ws://localhost:8787')
    expect(state.sync_token).toBe('my-secret-token')
    expect(state.sync_enabled).toBe('true')

    await cleanup()
  })

  it('sync.getLastSyncAt returns null initially', async () => {
    const { db, cleanup } = await createTestDb()
    const handlers = buildDbHandlers(db)

    const res = ok(run<{ last_sync_at: string | null }>(handlers, 'sync.getLastSyncAt', {}))
    expect(res.last_sync_at).toBeNull()

    await cleanup()
  })

  it('sync.setLastSyncAt and sync.getLastSyncAt round-trip', async () => {
    const { db, cleanup } = await createTestDb()
    const handlers = buildDbHandlers(db)

    const ts = '2024-01-15T10:30:00.000Z'
    ok(run(handlers, 'sync.setLastSyncAt', { last_sync_at: ts }))

    const res = ok(run<{ last_sync_at: string | null }>(handlers, 'sync.getLastSyncAt', {}))
    expect(res.last_sync_at).toBe(ts)

    await cleanup()
  })

  it('sync.listPendingChanges returns tasks modified since last sync', async () => {
    const { db, cleanup } = await createTestDb()
    const handlers = buildDbHandlers(db)

    // Insert a task using the correct action
    ok(run(handlers, 'task.create', {
      title: 'First task',
    }))

    // Set last sync before the task was created
    ok(run(handlers, 'sync.setLastSyncAt', { last_sync_at: '2023-12-31T00:00:00.000Z' }))

    const pending = ok(run<Array<Record<string, unknown>>>(handlers, 'sync.listPendingChanges', {}))
    const taskChanges = pending.filter((c) => c.entity_type === 'task')
    expect(taskChanges.length).toBeGreaterThanOrEqual(1)
    expect((taskChanges[0].payload as Record<string, unknown>).title).toBe('First task')

    await cleanup()
  })

  it('sync.listPendingChanges excludes tasks older than last sync', async () => {
    const { db, cleanup } = await createTestDb()
    const handlers = buildDbHandlers(db)

    ok(run(handlers, 'task.create', {
      title: 'Old task',
    }))

    // Set last sync far in the future
    ok(run(handlers, 'sync.setLastSyncAt', { last_sync_at: '2099-01-01T00:00:00.000Z' }))

    const pending = ok(run<Array<Record<string, unknown>>>(handlers, 'sync.listPendingChanges', {}))
    const taskChanges = pending.filter((c) => c.entity_type === 'task')
    expect(taskChanges).toHaveLength(0)

    await cleanup()
  })

  it('sync.applyRemote inserts a new task', async () => {
    const { db, cleanup } = await createTestDb()
    const handlers = buildDbHandlers(db)

    const res = ok(run<{ applied: boolean; reason?: string }>(handlers, 'sync.applyRemote', {
      entity_type: 'task',
      entity_id: 'remote-task-1',
      updated_at: '2024-01-15T10:00:00.000Z',
      deleted_at: null,
      payload: {
        title: 'Remote task',
        notes: 'From server',
        status: 'open',
        is_inbox: 0,
        is_someday: 0,
        created_at: '2024-01-15T10:00:00.000Z',
      },
    }))

    expect(res.applied).toBe(true)

    const row = db.prepare("SELECT title FROM tasks WHERE id = 'remote-task-1'").get() as { title: string } | undefined
    expect(row).toBeDefined()
    expect(row!.title).toBe('Remote task')

    await cleanup()
  })

  it('sync.applyRemote respects LWW: remote newer', async () => {
    const { db, cleanup } = await createTestDb()
    const handlers = buildDbHandlers(db)

    // Create local task
    ok(run(handlers, 'task.create', {
      title: 'Local title',
    }))
    const localTask = db.prepare("SELECT id, updated_at FROM tasks WHERE title = 'Local title'").get() as { id: string; updated_at: string }

    // Apply remote update with newer timestamp
    ok(run(handlers, 'sync.applyRemote', {
      entity_type: 'task',
      entity_id: localTask.id,
      updated_at: '2099-01-02T00:00:00.000Z',
      deleted_at: null,
      payload: {
        title: 'Remote title',
        notes: '',
        status: 'open',
        is_inbox: 1,
        is_someday: 0,
        created_at: localTask.updated_at,
      },
    }))

    const row = db.prepare('SELECT title FROM tasks WHERE id = ?').get(localTask.id) as { title: string }
    expect(row.title).toBe('Remote title')

    await cleanup()
  })

  it('sync.applyRemote respects LWW: local newer', async () => {
    const { db, cleanup } = await createTestDb()
    const handlers = buildDbHandlers(db)

    // Create local task (will have current timestamp)
    ok(run(handlers, 'task.create', {
      title: 'Local title',
    }))
    const localTask = db.prepare("SELECT id, updated_at FROM tasks WHERE title = 'Local title'").get() as { id: string; updated_at: string }

    // Apply remote update with older timestamp
    const res = ok(run<{ applied: boolean; reason?: string }>(handlers, 'sync.applyRemote', {
      entity_type: 'task',
      entity_id: localTask.id,
      updated_at: '2020-01-01T00:00:00.000Z',
      deleted_at: null,
      payload: {
        title: 'Remote title',
        notes: '',
        status: 'open',
        is_inbox: 1,
        is_someday: 0,
        created_at: '2020-01-01T00:00:00.000Z',
      },
    }))

    expect(res.applied).toBe(false)
    expect(res.reason).toBe('local_is_newer')

    const row = db.prepare('SELECT title FROM tasks WHERE id = ?').get(localTask.id) as { title: string }
    expect(row.title).toBe('Local title')

    await cleanup()
  })

  it('sync.applyRemote handles soft delete via deleted_at', async () => {
    const { db, cleanup } = await createTestDb()
    const handlers = buildDbHandlers(db)

    ok(run(handlers, 'task.create', {
      title: 'To be deleted',
    }))
    const localTask = db.prepare("SELECT id, updated_at FROM tasks WHERE title = 'To be deleted'").get() as { id: string; updated_at: string }

    ok(run(handlers, 'sync.applyRemote', {
      entity_type: 'task',
      entity_id: localTask.id,
      updated_at: '2099-01-02T00:00:00.000Z',
      deleted_at: '2099-01-02T00:00:00.000Z',
      payload: {
        title: 'To be deleted',
        notes: '',
        status: 'open',
        is_inbox: 1,
        is_someday: 0,
        created_at: localTask.updated_at,
      },
    }))

    const row = db.prepare('SELECT deleted_at FROM tasks WHERE id = ?').get(localTask.id) as { deleted_at: string | null }
    expect(row.deleted_at).not.toBeNull()

    await cleanup()
  })

  it('sync.applyRemote applies project entity', async () => {
    const { db, cleanup } = await createTestDb()
    const handlers = buildDbHandlers(db)

    const res = ok(run<{ applied: boolean }>(handlers, 'sync.applyRemote', {
      entity_type: 'project',
      entity_id: 'proj-1',
      updated_at: '2024-01-15T10:00:00.000Z',
      deleted_at: null,
      payload: {
        title: 'Remote project',
        notes: '',
        area_id: null,
        status: 'open',
        created_at: '2024-01-15T10:00:00.000Z',
      },
    }))

    expect(res.applied).toBe(true)

    const row = db.prepare("SELECT title FROM projects WHERE id = 'proj-1'").get() as { title: string } | undefined
    expect(row).toBeDefined()
    expect(row!.title).toBe('Remote project')

    await cleanup()
  })

  it('sync.applyRemote applies area entity', async () => {
    const { db, cleanup } = await createTestDb()
    const handlers = buildDbHandlers(db)

    const res = ok(run<{ applied: boolean }>(handlers, 'sync.applyRemote', {
      entity_type: 'area',
      entity_id: 'area-1',
      updated_at: '2024-01-15T10:00:00.000Z',
      deleted_at: null,
      payload: {
        title: 'Remote area',
        notes: '',
        created_at: '2024-01-15T10:00:00.000Z',
      },
    }))

    expect(res.applied).toBe(true)

    const row = db.prepare("SELECT title FROM areas WHERE id = 'area-1'").get() as { title: string } | undefined
    expect(row).toBeDefined()
    expect(row!.title).toBe('Remote area')

    await cleanup()
  })

  it('sync.applyRemote applies tag entity', async () => {
    const { db, cleanup } = await createTestDb()
    const handlers = buildDbHandlers(db)

    const res = ok(run<{ applied: boolean }>(handlers, 'sync.applyRemote', {
      entity_type: 'tag',
      entity_id: 'tag-1',
      updated_at: '2024-01-15T10:00:00.000Z',
      deleted_at: null,
      payload: {
        title: 'Remote tag',
        color: '#ff0000',
        created_at: '2024-01-15T10:00:00.000Z',
      },
    }))

    expect(res.applied).toBe(true)

    await cleanup()
  })

  it('sync.applyRemote applies checklist_item entity', async () => {
    const { db, cleanup } = await createTestDb()
    const handlers = buildDbHandlers(db)

    // Need a task first
    ok(run(handlers, 'task.create', {
      title: 'Parent task',
    }))
    const task = db.prepare("SELECT id FROM tasks WHERE title = 'Parent task'").get() as { id: string }

    const res = ok(run<{ applied: boolean }>(handlers, 'sync.applyRemote', {
      entity_type: 'checklist_item',
      entity_id: 'chk-1',
      updated_at: '2024-01-15T10:00:00.000Z',
      deleted_at: null,
      payload: {
        task_id: task.id,
        title: 'Check this',
        done: 0,
        position: 0,
        created_at: '2024-01-15T10:00:00.000Z',
      },
    }))

    expect(res.applied).toBe(true)

    await cleanup()
  })

  it('sync.applyRemote applies project_section entity', async () => {
    const { db, cleanup } = await createTestDb()
    const handlers = buildDbHandlers(db)

    // Need a project first
    ok(run(handlers, 'project.create', {
      title: 'Parent project',
    }))
    const project = db.prepare("SELECT id FROM projects WHERE title = 'Parent project'").get() as { id: string }

    const res = ok(run<{ applied: boolean }>(handlers, 'sync.applyRemote', {
      entity_type: 'project_section',
      entity_id: 'sec-1',
      updated_at: '2024-01-15T10:00:00.000Z',
      deleted_at: null,
      payload: {
        project_id: project.id,
        title: 'New section',
        position: 0,
        created_at: '2024-01-15T10:00:00.000Z',
      },
    }))

    expect(res.applied).toBe(true)

    await cleanup()
  })

  it('sync.applyRemote applies list_position entity', async () => {
    const { db, cleanup } = await createTestDb()
    const handlers = buildDbHandlers(db)

    ok(run(handlers, 'task.create', {
      title: 'Task',
    }))
    const task = db.prepare("SELECT id FROM tasks WHERE title = 'Task'").get() as { id: string }

    const res = ok(run<{ applied: boolean }>(handlers, 'sync.applyRemote', {
      entity_type: 'list_position',
      entity_id: `inbox:${task.id}`,
      updated_at: '2024-01-15T10:00:00.000Z',
      deleted_at: null,
      payload: {
        list_id: 'inbox',
        task_id: task.id,
        rank: 1000,
      },
    }))

    expect(res.applied).toBe(true)

    await cleanup()
  })

  it('sync.applyRemote rejects unknown entity type', async () => {
    const { db, cleanup } = await createTestDb()
    const handlers = buildDbHandlers(db)

    const res = ok(run<{ applied: boolean; reason: string }>(handlers, 'sync.applyRemote', {
      entity_type: 'unknown',
      entity_id: 'x',
      updated_at: '2024-01-15T10:00:00.000Z',
      deleted_at: null,
      payload: {},
    }))

    expect(res.applied).toBe(false)
    expect(res.reason).toBe('unknown_entity_type')

    await cleanup()
  })
})
