import { toAppError } from '../../shared/app-error'
import type {
  SyncBatch,
  SyncCredentials,
  SyncCursor,
  SyncPendingOutboxBatch,
  SyncRepositoryConfig,
  SyncState,
} from '../../shared/schemas/sync'

type SyncDbBridge = {
  getState(): Promise<SyncState>
  listPendingOutboxBatches(): Promise<SyncPendingOutboxBatch[]>
  markOutboxBatchesUploaded(input: { batch_ids: string[]; uploaded_at: string }): Promise<void>
  markOutboxBatchError(input: { batch_id: string; error: { code: string; message: string } }): Promise<void>
  applyRemoteBatch(input: { batch: SyncBatch }): Promise<{ applied: boolean; duplicate: boolean }>
  listRemoteCursors(): Promise<SyncCursor[]>
  updateStatus(patch: Partial<SyncState>): Promise<SyncState>
}

type SyncCredentialsStore = {
  isAvailable(): boolean
  load(): Promise<SyncCredentials>
}

type SyncRepository = {
  ensureReady(config: SyncRepositoryConfig, credentials: SyncCredentials): Promise<void>
  putBatch(config: SyncRepositoryConfig, credentials: SyncCredentials, batch: SyncBatch): Promise<void>
  listRemoteBatches(
    config: SyncRepositoryConfig,
    credentials: SyncCredentials,
    params: { current_device_id: string; cursors: SyncCursor[] }
  ): Promise<SyncBatch[]>
}

type SyncTiming = {
  local_debounce_ms: number
  foreground_poll_ms: number
  background_poll_ms: number
  retry_backoff_ms: number
}

const DEFAULT_TIMING: SyncTiming = {
  local_debounce_ms: 1_500,
  foreground_poll_ms: 15_000,
  background_poll_ms: 60_000,
  retry_backoff_ms: 10_000,
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeSyncError(error: unknown, fallbackCode = 'SYNC_UNEXPECTED'): { code: string; message: string } {
  return toAppError(error, {
    code: fallbackCode,
    message: 'Synchronization failed.',
  })
}

function defaultState(): SyncState {
  return {
    enabled: false,
    mode: 'disabled',
    device_id: '',
    device_name: '',
    config: null,
    has_stored_credentials: false,
    pending_outbox_count: 0,
    last_successful_sync_at: null,
    last_attempted_sync_at: null,
    last_error: null,
  }
}

export class SyncService {
  private readonly db: SyncDbBridge
  private readonly credentialsStore: SyncCredentialsStore
  private readonly repositoryFactory: () => SyncRepository
  private readonly timing: SyncTiming

  private repository: SyncRepository | null = null
  private state: SyncState = defaultState()
  private isStarted = false
  private isForeground = true
  private isSyncing = false
  private pollTimer: NodeJS.Timeout | null = null
  private debounceTimer: NodeJS.Timeout | null = null

  constructor(options: {
    db: SyncDbBridge
    credentialsStore: SyncCredentialsStore
    repositoryFactory: () => SyncRepository
    timing?: Partial<SyncTiming>
  }) {
    this.db = options.db
    this.credentialsStore = options.credentialsStore
    this.repositoryFactory = options.repositoryFactory
    this.timing = {
      ...DEFAULT_TIMING,
      ...options.timing,
    }
  }

  async start(): Promise<void> {
    this.isStarted = true
    await this.refreshState()
    this.schedulePoll(this.currentPollDelay())
  }

  stop() {
    this.isStarted = false
    if (this.pollTimer) clearTimeout(this.pollTimer)
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.pollTimer = null
    this.debounceTimer = null
  }

  getStateSnapshot(): SyncState {
    return this.state
  }

  async getState(): Promise<SyncState> {
    await this.refreshState()
    return this.state
  }

  setForegroundState(isForeground: boolean) {
    this.isForeground = isForeground
    if (isForeground) {
      void this.syncNow()
      return
    }

    this.schedulePoll(this.currentPollDelay())
  }

  async notifyLocalChange(): Promise<void> {
    await this.refreshState()
    if (!this.state.enabled) return

    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      void this.syncNow()
    }, this.timing.local_debounce_ms)
  }

  async syncNow(): Promise<SyncState> {
    await this.refreshState()
    if (!this.state.enabled || !this.state.config) {
      this.state = {
        ...this.state,
        mode: 'disabled',
      }
      return this.state
    }

    const config = this.state.config

    if (!this.credentialsStore.isAvailable() || !this.state.has_stored_credentials) {
      const error = {
        code: 'SYNC_CREDENTIALS_UNAVAILABLE',
        message: 'Sync credentials are not available on this device.',
      }
      this.state = await this.db.updateStatus({
        ...this.state,
        mode: 'error',
        last_error: error,
        last_attempted_sync_at: nowIso(),
      })
      this.schedulePoll(this.timing.retry_backoff_ms)
      return this.state
    }

    if (this.isSyncing) return this.state

    this.isSyncing = true
    const attemptedAt = nowIso()
    this.state = {
      ...this.state,
      mode: 'syncing',
      last_attempted_sync_at: attemptedAt,
    }

    try {
      const credentials = await this.credentialsStore.load()
      const repository = this.getRepository()

      await repository.ensureReady(config, credentials)
      const pendingBatches = await this.db.listPendingOutboxBatches()

      for (const pending of pendingBatches) {
        try {
          await repository.putBatch(config, credentials, pending.batch)
          await this.db.markOutboxBatchesUploaded({
            batch_ids: [pending.batch_id],
            uploaded_at: attemptedAt,
          })
        } catch (error) {
          const appError = normalizeSyncError(error, 'SYNC_PUSH_FAILED')
          await this.db.markOutboxBatchError({
            batch_id: pending.batch_id,
            error: appError,
          })
          throw appError
        }
      }

      const remoteBatches = await repository.listRemoteBatches(config, credentials, {
        current_device_id: this.state.device_id,
        cursors: await this.db.listRemoteCursors(),
      })

      for (const batch of remoteBatches) {
        await this.db.applyRemoteBatch({ batch })
      }

      const successfulAt = nowIso()
      this.state = await this.db.updateStatus({
        ...this.state,
        mode: 'idle',
        pending_outbox_count: Math.max(this.state.pending_outbox_count - pendingBatches.length, 0),
        last_successful_sync_at: successfulAt,
        last_attempted_sync_at: attemptedAt,
        last_error: null,
      })
      this.schedulePoll(this.currentPollDelay())
      return this.state
    } catch (error) {
      const appError = normalizeSyncError(error, 'SYNC_CYCLE_FAILED')
      this.state = await this.db.updateStatus({
        ...this.state,
        mode: 'error',
        last_attempted_sync_at: attemptedAt,
        last_error: {
          code: appError.code,
          message: appError.message,
        },
      })
      this.schedulePoll(this.timing.retry_backoff_ms)
      return this.state
    } finally {
      this.isSyncing = false
    }
  }

  private getRepository(): SyncRepository {
    if (!this.repository) {
      this.repository = this.repositoryFactory()
    }

    return this.repository
  }

  private async refreshState() {
    const persisted = await this.db.getState()
    this.state = {
      ...persisted,
      mode: this.isSyncing ? 'syncing' : persisted.mode,
    }
  }

  private currentPollDelay(): number {
    return this.isForeground ? this.timing.foreground_poll_ms : this.timing.background_poll_ms
  }

  private schedulePoll(delayMs: number) {
    if (!this.isStarted || !this.state.enabled) return
    if (this.pollTimer) clearTimeout(this.pollTimer)

    this.pollTimer = setTimeout(() => {
      this.pollTimer = null
      void this.syncNow()
    }, delayMs)
  }
}

export type {
  SyncCredentialsStore,
  SyncDbBridge,
  SyncRepository,
  SyncTiming,
}
