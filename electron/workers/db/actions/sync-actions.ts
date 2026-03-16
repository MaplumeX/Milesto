import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'
import {
  applyRemoteBatch,
  clearEncryptedCredentials,
  getEncryptedCredentials,
  getSyncDbState,
  listRemoteCursors,
  listPendingOutboxBatches,
  markOutboxBatchError,
  markOutboxBatchesUploaded,
  saveEncryptedCredentials,
  saveSyncConfig,
  setSyncEnabled,
  updateSyncStatus,
} from './sync-support'

import {
  SyncMarkOutboxUploadedInputSchema,
  SyncRepositoryConfigSchema,
  SyncSetCredentialsBlobInputSchema,
  SyncStatusUpdateInputSchema,
} from '../../../../shared/schemas'

const SyncSaveConfigInputSchema = z.object({
  config: SyncRepositoryConfigSchema,
  device_name: z.string().min(1),
  enabled: z.boolean().optional(),
})

const SyncSetEnabledInputSchema = z.object({
  enabled: z.boolean(),
})

const SyncMarkBatchErrorInputSchema = z.object({
  batch_id: z.string().min(1),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
})

export function createSyncActions(db: Database.Database): Record<string, DbActionHandler> {
  return {
    'sync.getState': () => ({
      ok: true,
      data: getSyncDbState(db),
    }),

    'sync.saveConfig': (payload) => {
      const parsed = SyncSaveConfigInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid sync.saveConfig payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const tx = db.transaction(() => {
        saveSyncConfig(db, {
          config: parsed.data.config,
          deviceName: parsed.data.device_name,
          enabled: parsed.data.enabled ?? null,
        })
        return { ok: true as const, data: getSyncDbState(db) }
      })

      return tx()
    },

    'sync.setEnabled': (payload) => {
      const parsed = SyncSetEnabledInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid sync.setEnabled payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const tx = db.transaction(() => {
        setSyncEnabled(db, parsed.data.enabled)
        return { ok: true as const, data: getSyncDbState(db) }
      })

      return tx()
    },

    'sync.saveEncryptedCredentials': (payload) => {
      const parsed = SyncSetCredentialsBlobInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid sync.saveEncryptedCredentials payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const tx = db.transaction(() => {
        saveEncryptedCredentials(db, parsed.data.encrypted_blob)
        return { ok: true as const, data: { saved: true } }
      })

      return tx()
    },

    'sync.clearEncryptedCredentials': () => {
      const tx = db.transaction(() => {
        clearEncryptedCredentials(db)
        return { ok: true as const, data: { cleared: true } }
      })

      return tx()
    },

    'sync.getEncryptedCredentials': () => ({
      ok: true,
      data: { encrypted_blob: getEncryptedCredentials(db) },
    }),

    'sync.listPendingOutboxBatches': () => ({
      ok: true,
      data: listPendingOutboxBatches(db),
    }),

    'sync.listRemoteCursors': () => ({
      ok: true,
      data: listRemoteCursors(db),
    }),

    'sync.markOutboxBatchesUploaded': (payload) => {
      const parsed = SyncMarkOutboxUploadedInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid sync.markOutboxBatchesUploaded payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const tx = db.transaction(() => {
        markOutboxBatchesUploaded(db, parsed.data.batch_ids, parsed.data.uploaded_at)
        return { ok: true as const, data: { updated: true } }
      })

      return tx()
    },

    'sync.markOutboxBatchError': (payload) => {
      const parsed = SyncMarkBatchErrorInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid sync.markOutboxBatchError payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const tx = db.transaction(() => {
        markOutboxBatchError(db, parsed.data.batch_id, parsed.data.error)
        return { ok: true as const, data: { updated: true } }
      })

      return tx()
    },

    'sync.updateStatus': (payload) => {
      const parsed = SyncStatusUpdateInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid sync.updateStatus payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const tx = db.transaction(() => {
        updateSyncStatus(db, parsed.data)
        return { ok: true as const, data: getSyncDbState(db) }
      })

      return tx()
    },

    'sync.applyRemoteBatch': (payload) => {
      try {
        const result = applyRemoteBatch(db, payload)
        return { ok: true as const, data: result }
      } catch (error) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid sync.applyRemoteBatch payload.',
            details: { error: String(error) },
          },
        }
      }
    },
  }
}
