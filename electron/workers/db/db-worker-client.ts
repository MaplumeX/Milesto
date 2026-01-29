import { pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { randomUUID } from 'node:crypto'

import { DbWorkerResponseSchema } from '../../../shared/db-worker-protocol'
import type { DbWorkerResponse } from '../../../shared/db-worker-protocol'
import type { AppError } from '../../../shared/app-error'

type Pending = {
  resolve: (value: DbWorkerResponse) => void
  timeoutId: NodeJS.Timeout
}

export class DbWorkerClient {
  private worker: Worker
  private pending = new Map<string, Pending>()

  constructor(workerScriptPath: string, dbPath: string) {
    const workerUrl = pathToFileURL(workerScriptPath)
    this.worker = new Worker(workerUrl, {
      workerData: { dbPath },
    })

    this.worker.on('message', (raw) => {
      const parsed = DbWorkerResponseSchema.safeParse(raw)
      if (!parsed.success) return

      const res = parsed.data
      const pending = this.pending.get(res.id)
      if (!pending) return

      clearTimeout(pending.timeoutId)
      this.pending.delete(res.id)
      pending.resolve(res)
    })

    this.worker.on('exit', (code) => {
      const error: AppError = {
        code: 'DB_WORKER_EXITED',
        message: 'DB worker exited unexpectedly.',
        details: { code },
      }
      for (const [id, pending] of this.pending) {
        clearTimeout(pending.timeoutId)
        pending.resolve({ id, ok: false, error })
      }
      this.pending.clear()
    })

    this.worker.on('error', (e) => {
      const error: AppError = {
        code: 'DB_WORKER_ERROR',
        message: 'DB worker error.',
        details: { error: String(e) },
      }
      for (const [id, pending] of this.pending) {
        clearTimeout(pending.timeoutId)
        pending.resolve({ id, ok: false, error })
      }
      this.pending.clear()
    })
  }

  async request(action: string, payload: unknown, timeoutMs = 30_000): Promise<DbWorkerResponse> {
    const id = randomUUID()

    return await new Promise<DbWorkerResponse>((resolve) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(id)
        resolve({
          id,
          ok: false,
          error: {
            code: 'DB_TIMEOUT',
            message: 'DB operation timed out.',
            details: { action, timeoutMs },
          },
        })
      }, timeoutMs)

      this.pending.set(id, { resolve, timeoutId })
      this.worker.postMessage({ id, type: 'db', action, payload })
    })
  }

  async terminate(): Promise<void> {
    await this.worker.terminate()
  }
}
