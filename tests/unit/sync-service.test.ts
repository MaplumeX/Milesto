// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

import { SyncService } from '../../electron/sync/sync-service'

import type {
  SyncBatch,
  SyncPendingOutboxBatch,
  SyncRepositoryConfig,
  SyncState,
} from '../../shared/schemas/sync'

const CONFIG: SyncRepositoryConfig = {
  endpoint: 'https://objects.example.test',
  region: 'auto',
  bucket: 'milesto-sync',
  prefix: 'users/demo',
  force_path_style: true,
}

const PENDING_BATCH: SyncPendingOutboxBatch = {
  batch_id: 'local-device:1',
  sequence_number: 1,
  created_at: '2026-03-16T00:00:00.000Z',
  retry_count: 0,
  last_error: null,
  batch: {
    batch_id: 'local-device:1',
    source_device_id: 'local-device',
    sequence_number: 1,
    created_at: '2026-03-16T00:00:00.000Z',
    version: '2026031600000-000001-local-device',
    operations: [],
  } satisfies SyncBatch,
}

const BASE_STATE: SyncState = {
  enabled: true,
  mode: 'idle',
  device_id: 'local-device',
  device_name: 'MacBook Pro',
  config: CONFIG,
  has_stored_credentials: true,
  pending_outbox_count: 1,
  last_successful_sync_at: null,
  last_attempted_sync_at: null,
  last_error: null,
}

const REMOTE_PROJECT_BATCH: SyncBatch = {
  batch_id: 'newer-device:1',
  source_device_id: 'newer-device',
  sequence_number: 1,
  created_at: '2026-03-16T00:00:01.000Z',
  version: '2026031600001-000000-newer-device',
  operations: [
    {
      kind: 'entity.put',
      entity_type: 'project',
      changed_fields: [
        'title',
        'notes',
        'area_id',
        'status',
        'scheduled_at',
        'is_someday',
        'due_at',
        'created_at',
        'updated_at',
        'completed_at',
        'deleted_at',
      ],
      field_versions: {
        title: '2026031600001-000000-newer-device',
        notes: '2026031600001-000000-newer-device',
        area_id: '2026031600001-000000-newer-device',
        status: '2026031600001-000000-newer-device',
        scheduled_at: '2026031600001-000000-newer-device',
        is_someday: '2026031600001-000000-newer-device',
        due_at: '2026031600001-000000-newer-device',
        created_at: '2026031600001-000000-newer-device',
        updated_at: '2026031600001-000000-newer-device',
        completed_at: '2026031600001-000000-newer-device',
        deleted_at: '2026031600001-000000-newer-device',
      },
      entity: {
        id: 'project-1',
        title: 'Remote project',
        notes: '',
        area_id: null,
        status: 'open',
        position: null,
        scheduled_at: null,
        is_someday: false,
        due_at: null,
        created_at: '2026-03-16T00:00:01.000Z',
        updated_at: '2026-03-16T00:00:01.000Z',
        completed_at: null,
        deleted_at: null,
      },
    },
  ],
}

const REMOTE_TASK_BATCH: SyncBatch = {
  batch_id: 'older-device:1',
  source_device_id: 'older-device',
  sequence_number: 1,
  created_at: '2026-03-16T00:00:02.000Z',
  version: '2026031600002-000000-older-device',
  operations: [
    {
      kind: 'entity.put',
      entity_type: 'task',
      changed_fields: [
        'title',
        'notes',
        'status',
        'is_inbox',
        'is_someday',
        'project_id',
        'section_id',
        'area_id',
        'scheduled_at',
        'due_at',
        'created_at',
        'updated_at',
        'completed_at',
        'deleted_at',
      ],
      field_versions: {
        title: '2026031600002-000000-older-device',
        notes: '2026031600002-000000-older-device',
        status: '2026031600002-000000-older-device',
        is_inbox: '2026031600002-000000-older-device',
        is_someday: '2026031600002-000000-older-device',
        project_id: '2026031600002-000000-older-device',
        section_id: '2026031600002-000000-older-device',
        area_id: '2026031600002-000000-older-device',
        scheduled_at: '2026031600002-000000-older-device',
        due_at: '2026031600002-000000-older-device',
        created_at: '2026031600002-000000-older-device',
        updated_at: '2026031600002-000000-older-device',
        completed_at: '2026031600002-000000-older-device',
        deleted_at: '2026031600002-000000-older-device',
      },
      entity: {
        id: 'task-1',
        title: 'Remote task',
        notes: '',
        status: 'open',
        is_inbox: false,
        is_someday: false,
        project_id: 'project-1',
        section_id: null,
        area_id: null,
        scheduled_at: null,
        due_at: null,
        created_at: '2026-03-16T00:00:02.000Z',
        updated_at: '2026-03-16T00:00:02.000Z',
        completed_at: null,
        deleted_at: null,
      },
    },
  ],
}

function createDbBridge() {
  let state = { ...BASE_STATE }

  return {
    setState(next: SyncState) {
      state = next
    },
    getState: vi.fn(async () => state),
    listPendingOutboxBatches: vi.fn(async () => [PENDING_BATCH]),
    markOutboxBatchesUploaded: vi.fn(async () => undefined),
    markOutboxBatchError: vi.fn(async () => undefined),
    applyRemoteBatch: vi.fn(async () => ({ applied: true, duplicate: false })),
    listRemoteCursors: vi.fn(async () => []),
    updateStatus: vi.fn(async (patch: Partial<SyncState>) => {
      state = {
        ...state,
        ...patch,
      }
      return state
    }),
  }
}

function createCredentialsStore() {
  return {
    isAvailable: vi.fn(() => true),
    load: vi.fn(async () => ({
      access_key_id: 'access-key',
      secret_access_key: 'secret-key',
    })),
  }
}

function createRepository() {
  return {
    ensureReady: vi.fn(async () => undefined),
    putBatch: vi.fn(async () => undefined),
    listRemoteBatches: vi.fn(async () => []),
  }
}

describe('SyncService', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('syncNow uploads pending outbox batches and returns to idle after a successful cycle', async () => {
    const db = createDbBridge()
    const credentials = createCredentialsStore()
    const repository = createRepository()

    const service = new SyncService({
      db,
      credentialsStore: credentials,
      repositoryFactory: () => repository,
    })

    const state = await service.syncNow()

    expect(credentials.load).toHaveBeenCalledTimes(1)
    expect(repository.ensureReady).toHaveBeenCalledWith(CONFIG, {
      access_key_id: 'access-key',
      secret_access_key: 'secret-key',
    })
    expect(repository.putBatch).toHaveBeenCalledWith(CONFIG, {
      access_key_id: 'access-key',
      secret_access_key: 'secret-key',
    }, PENDING_BATCH.batch)
    expect(db.markOutboxBatchesUploaded).toHaveBeenCalledTimes(1)
    expect(state.mode).toBe('idle')
    expect(state.last_error).toBeNull()
  })

  it('debounces local changes and retries with backoff after a failed cycle', async () => {
    vi.useFakeTimers()

    const db = createDbBridge()
    const credentials = createCredentialsStore()
    const repository = createRepository()

    repository.putBatch
      .mockRejectedValueOnce({
        code: 'SYNC_PUSH_FAILED',
        message: 'Upload failed.',
      })
      .mockResolvedValue(undefined)

    const service = new SyncService({
      db,
      credentialsStore: credentials,
      repositoryFactory: () => repository,
      timing: {
        local_debounce_ms: 100,
        foreground_poll_ms: 5_000,
        background_poll_ms: 30_000,
        retry_backoff_ms: 300,
      },
    })

    await service.start()
    service.notifyLocalChange()

    await vi.advanceTimersByTimeAsync(99)
    expect(repository.putBatch).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(repository.putBatch).toHaveBeenCalledTimes(1)
    expect(service.getStateSnapshot().mode).toBe('error')

    await vi.advanceTimersByTimeAsync(299)
    expect(repository.putBatch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(repository.putBatch).toHaveBeenCalledTimes(2)
  })

  it('refreshes out of error mode when persisted sync state no longer has an error', async () => {
    const db = createDbBridge()
    const credentials = createCredentialsStore()
    const repository = createRepository()

    repository.putBatch.mockRejectedValueOnce({
      code: 'SYNC_PUSH_FAILED',
      message: 'Upload failed.',
    })

    const service = new SyncService({
      db,
      credentialsStore: credentials,
      repositoryFactory: () => repository,
    })

    const failedState = await service.syncNow()
    expect(failedState.mode).toBe('error')

    db.setState({
      ...BASE_STATE,
      mode: 'idle',
      last_error: null,
    })

    await service.start()
    expect(service.getStateSnapshot().mode).toBe('idle')
  })

  it('reads the latest persisted pending count before the next sync cycle starts', async () => {
    vi.useFakeTimers()

    const db = createDbBridge()
    const credentials = createCredentialsStore()
    const repository = createRepository()

    const service = new SyncService({
      db,
      credentialsStore: credentials,
      repositoryFactory: () => repository,
      timing: {
        local_debounce_ms: 1_000,
      },
    })

    await service.start()
    db.setState({
      ...BASE_STATE,
      pending_outbox_count: 2,
      last_attempted_sync_at: '2026-03-16T00:00:01.000Z',
    })

    await service.notifyLocalChange()
    expect(service.getStateSnapshot().pending_outbox_count).toBe(2)
    expect(service.getStateSnapshot().mode).toBe('idle')
  })

  it('retries remote batches until parent entities are available locally', async () => {
    const db = createDbBridge()
    const credentials = createCredentialsStore()
    const repository = createRepository()
    let hasProject = false

    db.listPendingOutboxBatches.mockResolvedValue([])
    repository.listRemoteBatches.mockResolvedValue([REMOTE_TASK_BATCH, REMOTE_PROJECT_BATCH])
    db.applyRemoteBatch.mockImplementation(async ({ batch }) => {
      if (batch.batch_id === REMOTE_TASK_BATCH.batch_id && !hasProject) {
        throw {
          code: 'SYNC_APPLY_REMOTE_BATCH_FAILED',
          message: 'Failed to apply remote sync batch.',
        }
      }

      if (batch.batch_id === REMOTE_PROJECT_BATCH.batch_id) {
        hasProject = true
      }

      return { applied: true, duplicate: false }
    })

    const service = new SyncService({
      db,
      credentialsStore: credentials,
      repositoryFactory: () => repository,
    })

    const state = await service.syncNow()

    expect(state.mode).toBe('idle')
    expect(state.last_error).toBeNull()
    expect(db.applyRemoteBatch.mock.calls.map(([input]) => input.batch.batch_id)).toEqual([
      REMOTE_TASK_BATCH.batch_id,
      REMOTE_PROJECT_BATCH.batch_id,
      REMOTE_TASK_BATCH.batch_id,
    ])
  })
})
