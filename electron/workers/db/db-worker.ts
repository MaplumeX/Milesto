import { parentPort, workerData } from 'node:worker_threads'

import { DbWorkerRequestSchema } from '../../../shared/db-worker-protocol'
import type { DbWorkerResponse } from '../../../shared/db-worker-protocol'

import { initDb } from './db-bootstrap'
import { dispatchDbRequest } from './db-dispatch'
import { buildDbHandlers } from './db-handlers'

type WorkerData = {
  dbPath: string
}

function respond(response: DbWorkerResponse) {
  parentPort?.postMessage(response)
}

function main() {
  const data = workerData as WorkerData
  const db = initDb(data.dbPath)
  const handlers = buildDbHandlers(db)

  if (!parentPort) {
    throw new Error('DB worker started without parentPort')
  }

  parentPort.on('message', (raw) => {
    const parsed = DbWorkerRequestSchema.safeParse(raw)
    if (!parsed.success) {
      respond({
        id: 'unknown',
        ok: false,
        error: {
          code: 'DB_PROTOCOL_INVALID_REQUEST',
          message: 'Invalid DB worker request.',
          details: { issues: parsed.error.issues },
        },
      })
      return
    }

    const res = dispatchDbRequest(handlers, parsed.data)
    respond(res)
  })
}

main()
