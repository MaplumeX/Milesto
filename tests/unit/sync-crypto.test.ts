import { describe, expect, it } from 'vitest'

import { SyncCrypto } from '../../electron/sync/sync-crypto'

describe('SyncCrypto', () => {
  it('encrypt/decrypt round-trip preserves plaintext', () => {
    const crypto = new SyncCrypto('my-master-token-123')
    const plaintext = JSON.stringify({ title: 'Test task', notes: 'Some notes' })

    const encrypted = crypto.encrypt(plaintext)
    const decrypted = crypto.decrypt(encrypted)

    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertexts for same plaintext (random IV)', () => {
    const crypto = new SyncCrypto('my-master-token-123')
    const plaintext = 'hello world'

    const encrypted1 = crypto.encrypt(plaintext)
    const encrypted2 = crypto.encrypt(plaintext)

    expect(encrypted1).not.toBe(encrypted2)
    expect(crypto.decrypt(encrypted1)).toBe(plaintext)
    expect(crypto.decrypt(encrypted2)).toBe(plaintext)
  })

  it('generates deterministic auth token for same master token', () => {
    const crypto1 = new SyncCrypto('same-token')
    const crypto2 = new SyncCrypto('same-token')

    expect(crypto1.getAuthToken()).toBe(crypto2.getAuthToken())
  })

  it('generates different auth tokens for different master tokens', () => {
    const crypto1 = new SyncCrypto('token-a')
    const crypto2 = new SyncCrypto('token-b')

    expect(crypto1.getAuthToken()).not.toBe(crypto2.getAuthToken())
  })

  it('generates different encryption keys for different master tokens', () => {
    const crypto1 = new SyncCrypto('token-a')
    const crypto2 = new SyncCrypto('token-b')
    const plaintext = 'secret'

    const encrypted1 = crypto1.encrypt(plaintext)
    expect(() => crypto2.decrypt(encrypted1)).toThrow()
  })

  it('throws on tampered ciphertext', () => {
    const crypto = new SyncCrypto('my-master-token-123')
    const encrypted = crypto.encrypt('original')

    const combined = Buffer.from(encrypted, 'base64')
    combined[20] ^= 0xff // flip a bit in the encrypted payload
    const tampered = combined.toString('base64')

    expect(() => crypto.decrypt(tampered)).toThrow()
  })

  it('throws on truncated ciphertext', () => {
    const crypto = new SyncCrypto('my-master-token-123')
    const encrypted = crypto.encrypt('original')

    const truncated = encrypted.slice(0, 10)
    expect(() => crypto.decrypt(truncated)).toThrow('too short')
  })

  it('handles unicode and large payloads', () => {
    const crypto = new SyncCrypto('unicode-test-token')
    const plaintext = JSON.stringify({
      title: '你好世界 🌍 ñóëü',
      notes: 'x'.repeat(10000),
    })

    const encrypted = crypto.encrypt(plaintext)
    const decrypted = crypto.decrypt(encrypted)

    expect(decrypted).toBe(plaintext)
  })
})
