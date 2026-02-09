import { describe, expect, it } from 'vitest'

import { dispatchDbRequest } from '../../electron/workers/db/db-dispatch'
import type { DbWorkerRequest } from '../../shared/db-worker-protocol'

describe('dispatchDbRequest', () => {
  it('maps unknown action to DB_UNKNOWN_ACTION', () => {
    const req: DbWorkerRequest = { id: '1', type: 'db', action: 'nope', payload: null }
    const res = dispatchDbRequest({}, req)

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('DB_UNKNOWN_ACTION')
      expect(res.error.details).toEqual({ action: 'nope' })
    }
  })

  it('contains thrown exceptions as DB_UNHANDLED (no crash)', () => {
    const handlers = {
      boom: () => {
        throw new Error('boom')
      },
    }

    const req: DbWorkerRequest = { id: '1', type: 'db', action: 'boom', payload: null }
    const res = dispatchDbRequest(handlers, req)

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('DB_UNHANDLED')
    }
  })
})
