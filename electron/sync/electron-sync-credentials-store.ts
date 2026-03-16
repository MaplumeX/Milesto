import { safeStorage } from 'electron'

import { SyncCredentialsSchema, type SyncCredentials } from '../../shared/schemas/sync'

type SyncCredentialPersistence = {
  loadEncrypted(): Promise<string | null>
  saveEncrypted(encryptedBlob: string): Promise<void>
  clearEncrypted(): Promise<void>
}

export class ElectronSyncCredentialsStore {
  private readonly persistence: SyncCredentialPersistence

  constructor(options: { persistence: SyncCredentialPersistence }) {
    this.persistence = options.persistence
  }

  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  async load(): Promise<SyncCredentials> {
    const encryptedBlob = await this.persistence.loadEncrypted()
    if (!encryptedBlob) {
      throw {
        code: 'SYNC_CREDENTIALS_MISSING',
        message: 'No sync credentials are stored for this device.',
      }
    }

    if (!this.isAvailable()) {
      throw {
        code: 'SYNC_SECURE_STORAGE_UNAVAILABLE',
        message: 'Secure storage is unavailable on this device.',
      }
    }

    const decrypted = safeStorage.decryptString(Buffer.from(encryptedBlob, 'base64'))
    return SyncCredentialsSchema.parse(JSON.parse(decrypted) as unknown)
  }

  async save(credentials: SyncCredentials): Promise<void> {
    if (!this.isAvailable()) {
      throw {
        code: 'SYNC_SECURE_STORAGE_UNAVAILABLE',
        message: 'Secure storage is unavailable on this device.',
      }
    }

    const encrypted = safeStorage
      .encryptString(JSON.stringify(SyncCredentialsSchema.parse(credentials)))
      .toString('base64')

    await this.persistence.saveEncrypted(encrypted)
  }

  async clear(): Promise<void> {
    await this.persistence.clearEncrypted()
  }
}

export type { SyncCredentialPersistence }
