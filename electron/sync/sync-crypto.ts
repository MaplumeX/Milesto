import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

const ENC_INFO = 'milesto-enc'
const AUTH_INFO = 'milesto-auth'
const KEY_LENGTH = 32
const IV_LENGTH = 12
const TAG_LENGTH = 16

export class SyncCrypto {
  private readonly encKey: Buffer
  private readonly authToken: string

  constructor(masterToken: string) {
    this.encKey = Buffer.from(hkdfSync('sha256', masterToken, '', ENC_INFO, KEY_LENGTH))
    this.authToken = Buffer.from(hkdfSync('sha256', masterToken, '', AUTH_INFO, KEY_LENGTH)).toString('base64')
  }

  getAuthToken(): string {
    return this.authToken
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv('aes-256-gcm', this.encKey, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
    const tag = cipher.getAuthTag()
    const combined = Buffer.concat([iv, tag, encrypted])
    return combined.toString('base64')
  }

  decrypt(ciphertext: string): string {
    const combined = Buffer.from(ciphertext, 'base64')
    if (combined.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error('Invalid ciphertext: too short')
    }
    const iv = combined.subarray(0, IV_LENGTH)
    const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH)
    const decipher = createDecipheriv('aes-256-gcm', this.encKey, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return decrypted.toString('utf-8')
  }
}
