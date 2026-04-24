import { z } from 'zod'

function isHttpBaseUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export const SyncStatusSchema = z.enum([
  'disabled',
  'connecting',
  'connected',
  'syncing',
  'error',
  'offline',
])

export type SyncStatus = z.infer<typeof SyncStatusSchema>

export const SyncStateSchema = z.object({
  status: SyncStatusSchema,
  lastSyncAt: z.string().datetime().nullable(),
  lastError: z.string().nullable(),
  pendingCount: z.number().int().min(0),
})

export type SyncState = z.infer<typeof SyncStateSchema>

export const SyncServerUrlSchema = z.string().trim().url().refine(isHttpBaseUrl, {
  message: 'Sync server URL must use http:// or https://.',
})

export const SyncConfigSchema = z.object({
  serverUrl: SyncServerUrlSchema,
  token: z.string().min(1),
  enabled: z.boolean(),
})

export type SyncConfig = z.infer<typeof SyncConfigSchema>

export const SyncEntitySchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  payload: z.string(),
})

export type SyncEntity = z.infer<typeof SyncEntitySchema>
