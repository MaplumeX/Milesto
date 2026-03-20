// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3'

import { S3SyncRepository } from '../../electron/sync/s3-sync-repository'

import type { SyncBatch, SyncRepositoryConfig } from '../../shared/schemas/sync'

const CONFIG: SyncRepositoryConfig = {
  endpoint: 'https://objects.example.test',
  region: 'auto',
  bucket: 'milesto-sync',
  prefix: 'users/demo',
  force_path_style: true,
}

const CREDENTIALS = {
  access_key_id: 'access-key',
  secret_access_key: 'secret-key',
}

const BATCH: SyncBatch = {
  batch_id: 'device-a:7',
  source_device_id: 'device-a',
  sequence_number: 7,
  created_at: '2026-03-16T00:00:00.000Z',
  version: '2026031600000-000001-device-a',
  operations: [],
}

describe('S3SyncRepository', () => {
  it('writes repository metadata and device batches under the configured prefix', async () => {
    const send = vi.fn(async () => ({}))

    const repository = new S3SyncRepository({
      clientFactory: () => ({ send }) as never,
    })

    await repository.ensureReady(CONFIG, CREDENTIALS)
    await repository.putBatch(CONFIG, CREDENTIALS, BATCH)

    const commands = send.mock.calls.map(([command]) => command)

    expect(
      commands.some(
        (command) =>
          command instanceof PutObjectCommand &&
          command.input.Bucket === 'milesto-sync' &&
          command.input.Key === 'users/demo/repo.json'
      )
    ).toBe(true)

    expect(
      commands.some(
        (command) =>
          command instanceof PutObjectCommand &&
          command.input.Key === 'users/demo/devices/device-a/changes/7.json'
      )
    ).toBe(true)
  })

  it('lists and loads remote batches newer than the caller cursor', async () => {
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof ListObjectsV2Command) {
        return {
          Contents: [
            { Key: 'users/demo/devices/device-a/changes/1.json' },
            { Key: 'users/demo/devices/device-a/changes/2.json' },
          ],
        }
      }

      if (command instanceof GetObjectCommand) {
        const sequence = command.input.Key?.endsWith('/1.json') ? 1 : 2
        return {
          Body: {
            async transformToString() {
              return JSON.stringify({
                ...BATCH,
                sequence_number: sequence,
                batch_id: `device-a:${sequence}`,
              })
            },
          },
        }
      }

      return {}
    })

    const repository = new S3SyncRepository({
      clientFactory: () => ({ send }) as never,
    })

    const batches = await repository.listRemoteBatches(CONFIG, CREDENTIALS, {
      current_device_id: 'device-b',
      cursors: [{ source_device_id: 'device-a', last_applied_sequence: 1 }],
    })

    expect(batches.map((batch) => batch.sequence_number)).toEqual([2])
  })

  it('drops legacy session tokens before creating the repository client', async () => {
    const clientFactory = vi.fn(() => ({ send: vi.fn(async () => ({})) }) as never)

    const repository = new S3SyncRepository({
      clientFactory,
    })

    await repository.ensureReady(
      CONFIG,
      {
        ...CREDENTIALS,
        session_token: 'legacy-session-token',
      } as never
    )

    expect(clientFactory).toHaveBeenCalledWith(CONFIG, {
      access_key_id: 'access-key',
      secret_access_key: 'secret-key',
    })
  })
})
