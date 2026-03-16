import { z, type ZodType } from 'zod'

import {
  SyncApplyRemoteBatchResultSchema,
  SyncCursorSchema,
  SyncDbStateSchema,
  SyncPendingOutboxBatchSchema,
  SyncStateSchema,
  type SyncBatch,
  type SyncDbState,
  type SyncPendingOutboxBatch,
  type SyncState,
} from '../../shared/schemas/sync'

import type { DbWorkerClient } from '../workers/db/db-worker-client'

const EncryptedCredentialsSchema = z.object({
  encrypted_blob: z.string().nullable(),
})

function buildRuntimeMode(dbState: SyncDbState): SyncState['mode'] {
  if (!dbState.enabled) return 'disabled'
  if (dbState.last_error) return 'error'
  return 'idle'
}

export function buildSyncStateFromDbState(dbState: SyncDbState, mode = buildRuntimeMode(dbState)): SyncState {
  return SyncStateSchema.parse({
    enabled: dbState.enabled,
    mode,
    device_id: dbState.device_id,
    device_name: dbState.device_name,
    config: dbState.config,
    has_stored_credentials: dbState.has_stored_credentials,
    pending_outbox_count: dbState.pending_outbox_count,
    last_successful_sync_at: dbState.last_successful_sync_at,
    last_attempted_sync_at: dbState.last_attempted_sync_at,
    last_error: dbState.last_error,
  })
}

async function requestDb<T>(
  dbWorker: DbWorkerClient,
  action: string,
  payload: unknown,
  schema: ZodType<T>
): Promise<T> {
  const response = await dbWorker.request(action, payload)
  if (!response.ok) throw response.error
  return schema.parse(response.data)
}

export function createMainSyncBridge(dbWorker: DbWorkerClient) {
  return {
    async getDbState(): Promise<SyncDbState> {
      return await requestDb(dbWorker, 'sync.getState', {}, SyncDbStateSchema)
    },

    async getState(): Promise<SyncState> {
      const dbState = await requestDb(dbWorker, 'sync.getState', {}, SyncDbStateSchema)
      return buildSyncStateFromDbState(dbState)
    },

    async saveConfiguration(input: { config: SyncState['config']; device_name: string; enabled?: boolean }) {
      const dbState = await requestDb(
        dbWorker,
        'sync.saveConfig',
        input,
        SyncDbStateSchema
      )
      return buildSyncStateFromDbState(dbState)
    },

    async setEnabled(enabled: boolean): Promise<SyncState> {
      const dbState = await requestDb(dbWorker, 'sync.setEnabled', { enabled }, SyncDbStateSchema)
      return buildSyncStateFromDbState(dbState)
    },

    async getEncryptedCredentials(): Promise<string | null> {
      const payload = await requestDb(dbWorker, 'sync.getEncryptedCredentials', {}, EncryptedCredentialsSchema)
      return payload.encrypted_blob
    },

    async saveEncryptedCredentials(encryptedBlob: string): Promise<void> {
      const response = await dbWorker.request('sync.saveEncryptedCredentials', { encrypted_blob: encryptedBlob })
      if (!response.ok) throw response.error
    },

    async clearEncryptedCredentials(): Promise<void> {
      const response = await dbWorker.request('sync.clearEncryptedCredentials', {})
      if (!response.ok) throw response.error
    },

    async listPendingOutboxBatches(): Promise<SyncPendingOutboxBatch[]> {
      return await requestDb(
        dbWorker,
        'sync.listPendingOutboxBatches',
        {},
        SyncPendingOutboxBatchSchema.array()
      )
    },

    async markOutboxBatchesUploaded(input: { batch_ids: string[]; uploaded_at: string }): Promise<void> {
      const response = await dbWorker.request('sync.markOutboxBatchesUploaded', input)
      if (!response.ok) throw response.error
    },

    async markOutboxBatchError(input: { batch_id: string; error: { code: string; message: string } }): Promise<void> {
      const response = await dbWorker.request('sync.markOutboxBatchError', input)
      if (!response.ok) throw response.error
    },

    async applyRemoteBatch(input: { batch: SyncBatch }): Promise<{ applied: boolean; duplicate: boolean }> {
      return await requestDb(
        dbWorker,
        'sync.applyRemoteBatch',
        input,
        SyncApplyRemoteBatchResultSchema
      )
    },

    async listRemoteCursors() {
      return await requestDb(dbWorker, 'sync.listRemoteCursors', {}, SyncCursorSchema.array())
    },

    async updateStatus(patch: Partial<SyncState>): Promise<SyncState> {
      const dbState = await requestDb(
        dbWorker,
        'sync.updateStatus',
        {
          last_attempted_sync_at: patch.last_attempted_sync_at ?? null,
          last_successful_sync_at: patch.last_successful_sync_at ?? null,
          last_error: patch.last_error ?? null,
        },
        SyncDbStateSchema
      )

      return buildSyncStateFromDbState(dbState, patch.mode ?? buildRuntimeMode(dbState))
    },
  }
}

export type MainSyncBridge = ReturnType<typeof createMainSyncBridge>
