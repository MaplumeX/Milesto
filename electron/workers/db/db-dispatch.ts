import type { DbWorkerRequest, DbWorkerResponse } from '../../../shared/db-worker-protocol'

import type { DbActionHandler } from './actions/db-actions'

export function dispatchDbRequest(
  handlers: Record<string, DbActionHandler>,
  req: DbWorkerRequest
): DbWorkerResponse {
  try {
    const handler = handlers[req.action]
    if (!handler) {
      return {
        id: req.id,
        ok: false,
        error: {
          code: 'DB_UNKNOWN_ACTION',
          message: 'Unknown DB action.',
          details: { action: req.action },
        },
      }
    }

    const result = handler(req.payload)
    return { id: req.id, ...result }
  } catch (e) {
    return {
      id: req.id,
      ok: false,
      error: {
        code: 'DB_UNHANDLED',
        message: 'Unhandled DB error.',
        details: { error: String(e) },
      },
    }
  }
}
