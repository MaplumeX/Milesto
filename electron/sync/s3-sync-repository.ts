import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

import {
  SyncBatchSchema,
  SyncCredentialsSchema,
  type SyncBatch,
  type SyncCredentials,
  type SyncCursor,
  type SyncRepositoryConfig,
} from '../../shared/schemas/sync'

type S3ClientLike = {
  send(command: unknown): Promise<unknown>
}

function normalizePrefix(prefix: string): string {
  return prefix.trim().replace(/^\/+|\/+$/g, '')
}

function joinKey(prefix: string, ...segments: string[]): string {
  const parts = [normalizePrefix(prefix), ...segments.map((segment) => segment.replace(/^\/+|\/+$/g, ''))]
    .filter((part) => part.length > 0)

  return parts.join('/')
}

function createDefaultClient(config: SyncRepositoryConfig, credentials: SyncCredentials): S3ClientLike {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.force_path_style,
    credentials: {
      accessKeyId: credentials.access_key_id,
      secretAccessKey: credentials.secret_access_key,
      sessionToken: credentials.session_token,
    },
  })
}

async function readBodyAsString(body: unknown): Promise<string> {
  if (!body || typeof body !== 'object' || !('transformToString' in body)) {
    throw new Error('S3 response body is not readable.')
  }

  const transformToString = (body as { transformToString: () => Promise<string> }).transformToString
  return await transformToString()
}

export class S3SyncRepository {
  private readonly clientFactory: (config: SyncRepositoryConfig, credentials: SyncCredentials) => S3ClientLike

  constructor(options?: {
    clientFactory?: (config: SyncRepositoryConfig, credentials: SyncCredentials) => S3ClientLike
  }) {
    this.clientFactory = options?.clientFactory ?? createDefaultClient
  }

  private getClient(config: SyncRepositoryConfig, credentials: SyncCredentials): S3ClientLike {
    return this.clientFactory(config, SyncCredentialsSchema.parse(credentials))
  }

  async ensureReady(config: SyncRepositoryConfig, credentials: SyncCredentials): Promise<void> {
    const client = this.getClient(config, credentials)

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: joinKey(config.prefix, 'repo.json'),
        ContentType: 'application/json',
        Body: JSON.stringify({
          schema_version: 1,
          updated_at: new Date().toISOString(),
        }),
      })
    )
  }

  async putBatch(config: SyncRepositoryConfig, credentials: SyncCredentials, batch: SyncBatch): Promise<void> {
    const client = this.getClient(config, credentials)

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: joinKey(
          config.prefix,
          'devices',
          batch.source_device_id,
          'changes',
          `${batch.sequence_number}.json`
        ),
        ContentType: 'application/json',
        Body: JSON.stringify(batch),
      })
    )
  }

  async listRemoteBatches(
    config: SyncRepositoryConfig,
    credentials: SyncCredentials,
    params: {
      current_device_id: string
      cursors: SyncCursor[]
    }
  ): Promise<SyncBatch[]> {
    const client = this.getClient(config, credentials)
    const cursorByDevice = new Map(
      params.cursors.map((cursor) => [cursor.source_device_id, cursor.last_applied_sequence])
    )
    const keys: string[] = []
    let continuationToken: string | undefined

    do {
      const response = (await client.send(
        new ListObjectsV2Command({
          Bucket: config.bucket,
          Prefix: joinKey(config.prefix, 'devices'),
          ContinuationToken: continuationToken,
        })
      )) as {
        Contents?: Array<{ Key?: string }>
        IsTruncated?: boolean
        NextContinuationToken?: string
      }

      for (const item of response.Contents ?? []) {
        if (!item.Key) continue
        keys.push(item.Key)
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
    } while (continuationToken)

    const changeKeys = keys
      .map((key) => {
        const normalizedPrefix = normalizePrefix(config.prefix)
        const relativeKey = normalizedPrefix ? key.slice(`${normalizedPrefix}/`.length) : key
        const match = /^devices\/([^/]+)\/changes\/(\d+)\.json$/.exec(relativeKey)
        if (!match) return null

        return {
          key,
          source_device_id: match[1] ?? '',
          sequence_number: Number(match[2]),
        }
      })
      .filter((entry): entry is { key: string; source_device_id: string; sequence_number: number } => Boolean(entry))
      .filter((entry) => entry.source_device_id !== params.current_device_id)
      .filter((entry) => entry.sequence_number > (cursorByDevice.get(entry.source_device_id) ?? 0))
      .sort((left, right) => {
        if (left.source_device_id !== right.source_device_id) {
          return left.source_device_id.localeCompare(right.source_device_id)
        }

        return left.sequence_number - right.sequence_number
      })

    const batches: SyncBatch[] = []

    for (const entry of changeKeys) {
      const response = (await client.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: entry.key,
        })
      )) as { Body?: unknown }

      const raw = await readBodyAsString(response.Body)
      batches.push(SyncBatchSchema.parse(JSON.parse(raw) as unknown))
    }

    return batches
  }
}
