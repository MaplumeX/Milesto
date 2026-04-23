import WebSocket from 'ws'
import type { SyncConfig, SyncEntity, SyncState } from '../../shared/schemas/sync'
import type { DbWorkerClient } from '../workers/db/db-worker-client'
import { SyncCrypto } from './sync-crypto.js'

interface SyncEngineOptions {
  dbWorker: DbWorkerClient
  onStateChange?: (state: SyncState) => void
}

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000, 60000]

export class SyncEngine {
  private readonly dbWorker: DbWorkerClient
  private readonly onStateChange?: (state: SyncState) => void

  private config: SyncConfig | null = null
  private crypto: SyncCrypto | null = null
  private ws: WebSocket | null = null
  private state: SyncState = {
    status: 'disabled',
    lastSyncAt: null,
    lastError: null,
    pendingCount: 0,
  }

  private reconnectAttempt = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private lastPongAt = 0
  private isSyncing = false
  private fetchOffset = 0
  private fetchSince: string | undefined = undefined
  private syncInterval: NodeJS.Timeout | null = null

  constructor(options: SyncEngineOptions) {
    this.dbWorker = options.dbWorker
    this.onStateChange = options.onStateChange
  }

  getState(): SyncState {
    return { ...this.state }
  }

  async configure(config: SyncConfig): Promise<void> {
    await this.disconnect()

    this.config = config
    this.crypto = new SyncCrypto(config.token)

    if (config.enabled) {
      this.updateState({ status: 'connecting' })
      this.connect()
    }
  }

  async disconnect(): Promise<void> {
    this.clearTimers()

    if (this.ws) {
      this.ws.terminate()
      this.ws = null
    }

    this.config = null
    this.crypto = null
    this.reconnectAttempt = 0
    this.updateState({
      status: 'disabled',
      lastSyncAt: this.state.lastSyncAt,
      lastError: null,
      pendingCount: 0,
    })
  }

  private connect() {
    if (!this.config || !this.crypto) return

    this.clearReconnectTimer()

    try {
      this.ws = new WebSocket(this.config.serverUrl)
    } catch (err) {
      this.handleError(`Failed to create WebSocket: ${(err as Error).message}`)
      this.scheduleReconnect()
      return
    }

    this.ws.on('open', () => {
      this.reconnectAttempt = 0
      this.lastPongAt = Date.now()
      this.send({ type: 'auth', token: this.crypto!.getAuthToken() })
    })

    this.ws.on('message', (data) => {
      this.handleMessage(data.toString())
    })

    this.ws.on('pong', () => {
      this.lastPongAt = Date.now()
    })

    this.ws.on('close', () => {
      if (this.state.status !== 'disabled') {
        this.updateState({ status: 'offline' })
        this.scheduleReconnect()
      }
    })

    this.ws.on('error', (err) => {
      this.handleError(`WebSocket error: ${err.message}`)
    })

    this.startHeartbeat()
  }

  private handleMessage(raw: string) {
    try {
      const msg = JSON.parse(raw) as { type: string }

      switch (msg.type) {
        case 'auth_result': {
          const authMsg = msg as unknown as { success: boolean; error?: string }
          if (authMsg.success) {
            this.updateState({ status: 'connected', lastError: null })
            this.startSyncInterval()
            void this.performSync()
          } else {
            this.handleError(authMsg.error ?? 'Authentication failed')
            void this.disconnect()
          }
          break
        }
        case 'broadcast': {
          const broadcast = msg as unknown as SyncEntity
          void this.applyRemoteEntity(broadcast)
          break
        }
        case 'fetch_result': {
          const fetchResult = msg as unknown as { entities: SyncEntity[]; hasMore: boolean }
          void this.applyFetchResult(fetchResult.entities, fetchResult.hasMore)
          break
        }
        case 'pong': {
          this.lastPongAt = Date.now()
          break
        }
      }
    } catch {
      // ignore malformed messages
    }
  }

  private async applyRemoteEntity(entity: SyncEntity) {
    if (!this.crypto) return

    try {
      const decryptedPayload = this.crypto.decrypt(entity.payload)
      const parsed = JSON.parse(decryptedPayload) as Record<string, unknown>

      // Apply to local DB based on entity type
      await this.dbWorker.request('sync.applyRemote', {
        entity_type: entity.entityType,
        entity_id: entity.entityId,
        updated_at: entity.updatedAt,
        deleted_at: entity.deletedAt,
        payload: parsed,
      })
    } catch (err) {
      console.error('[sync] Failed to apply remote entity:', err)
    }
  }

  private async applyFetchResult(entities: SyncEntity[], hasMore: boolean) {
    if (!this.crypto) return

    this.updateState({ status: 'syncing' })

    try {
      for (const entity of entities) {
        const decryptedPayload = this.crypto.decrypt(entity.payload)
        const parsed = JSON.parse(decryptedPayload) as Record<string, unknown>

        await this.dbWorker.request('sync.applyRemote', {
          entity_type: entity.entityType,
          entity_id: entity.entityId,
          updated_at: entity.updatedAt,
          deleted_at: entity.deletedAt,
          payload: parsed,
        })
      }

      if (hasMore) {
        // Fetch next page
        void this.fetchNextPage()
      } else {
        this.updateState({
          status: 'connected',
          lastSyncAt: new Date().toISOString(),
        })
      }
    } catch (err) {
      this.handleError(`Sync failed: ${(err as Error).message}`)
    }
  }

  private async performSync() {
    if (this.isSyncing || !this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.isSyncing = true
    this.updateState({ status: 'syncing' })

    try {
      // First, push local changes
      await this.pushLocalChanges()

      // Then, fetch remote changes
      await this.fetchRemoteChanges()
    } catch (err) {
      this.handleError(`Sync failed: ${(err as Error).message}`)
    } finally {
      this.isSyncing = false
    }
  }

  private async pushLocalChanges() {
    if (!this.crypto || !this.ws) return

    const pendingRes = await this.dbWorker.request('sync.listPendingChanges', {})
    if (!pendingRes.ok) return

    const pending = pendingRes.data as Array<{
      entity_type: string
      entity_id: string
      updated_at: string
      deleted_at: string | null
      payload: Record<string, unknown>
    }>

    for (const change of pending) {
      const encrypted = this.crypto.encrypt(JSON.stringify(change.payload))
      this.send({
        type: 'push',
        entityType: change.entity_type,
        entityId: change.entity_id,
        updatedAt: change.updated_at,
        deletedAt: change.deleted_at,
        payload: encrypted,
      })
    }

  }

  private async fetchRemoteChanges() {
    if (!this.ws) return

    const lastSyncRes = await this.dbWorker.request('sync.getLastSyncAt', {})
    const lastSyncAt = lastSyncRes.ok ? (lastSyncRes.data as { last_sync_at: string | null }).last_sync_at : null

    this.fetchSince = lastSyncAt ?? undefined
    this.fetchOffset = 0

    this.send({
      type: 'fetch',
      since: this.fetchSince,
      limit: 500,
      offset: this.fetchOffset,
    })
  }

  private fetchNextPage() {
    if (!this.ws) return
    this.fetchOffset += 500
    this.send({
      type: 'fetch',
      since: this.fetchSince,
      limit: 500,
      offset: this.fetchOffset,
    })
  }

  private send(msg: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  private handleError(message: string) {
    console.error('[sync]', message)
    this.updateState({ status: 'error', lastError: message })
  }

  private updateState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch }
    this.onStateChange?.(this.state)
  }

  private scheduleReconnect() {
    if (this.state.status === 'disabled') return

    this.clearReconnectTimer()
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)]
    this.reconnectAttempt++

    this.reconnectTimer = setTimeout(() => {
      this.updateState({ status: 'connecting' })
      this.connect()
    }, delay)
  }

  private startHeartbeat() {
    this.clearHeartbeatTimer()
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

      if (Date.now() - this.lastPongAt > 90000) {
        this.ws.terminate()
        this.scheduleReconnect()
        return
      }

      this.ws.ping()
    }, 30000)
  }

  private startSyncInterval() {
    this.clearSyncInterval()
    this.syncInterval = setInterval(() => {
      if (this.state.status === 'connected' && !this.isSyncing) {
        void this.pushLocalChanges()
      }
    }, 5000)
  }

  private clearSyncInterval() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  private clearTimers() {
    this.clearReconnectTimer()
    this.clearHeartbeatTimer()
    this.clearSyncInterval()
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private clearHeartbeatTimer() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}
