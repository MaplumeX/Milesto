import { describe, expect, it } from 'vitest'

import { toSyncWebSocketUrl } from '../../electron/sync/sync-url'
import { SyncConfigSchema } from '../../shared/schemas/sync'

describe('sync URL handling', () => {
  it('accepts HTTP(S) base URLs in sync config', () => {
    const parsed = SyncConfigSchema.parse({
      serverUrl: ' https://sync.example.com ',
      token: 'secret',
      enabled: true,
    })

    expect(parsed.serverUrl).toBe('https://sync.example.com')
  })

  it('rejects direct WebSocket URLs for new sync config', () => {
    const parsed = SyncConfigSchema.safeParse({
      serverUrl: 'wss://sync.example.com',
      token: 'secret',
      enabled: true,
    })

    expect(parsed.success).toBe(false)
  })

  it('converts HTTPS base URLs to secure WebSocket URLs', () => {
    expect(toSyncWebSocketUrl('https://sync.example.com')).toBe('wss://sync.example.com/sync')
  })

  it('converts HTTP base URLs to plain WebSocket URLs', () => {
    expect(toSyncWebSocketUrl('http://localhost:8787')).toBe('ws://localhost:8787/sync')
  })

  it('appends the sync endpoint under reverse-proxy base paths', () => {
    expect(toSyncWebSocketUrl('https://sync.example.com/milesto')).toBe('wss://sync.example.com/milesto/sync')
  })

  it('does not append the sync endpoint twice', () => {
    expect(toSyncWebSocketUrl('https://sync.example.com/sync')).toBe('wss://sync.example.com/sync')
  })

  it('keeps legacy WebSocket URLs connectable', () => {
    expect(toSyncWebSocketUrl('ws://localhost:8787')).toBe('ws://localhost:8787/sync')
  })

  it('rejects unsupported URL protocols', () => {
    expect(() => toSyncWebSocketUrl('ftp://sync.example.com')).toThrow('http:// or https://')
  })
})
