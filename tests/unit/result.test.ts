import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { err, ok, resultSchema } from '../../shared/result'

describe('shared/result', () => {
  it('ok() wraps data', () => {
    expect(ok(123)).toEqual({ ok: true, data: 123 })
  })

  it('err() wraps AppError', () => {
    expect(err({ code: 'X', message: 'm' })).toEqual({ ok: false, error: { code: 'X', message: 'm' } })
  })

  it('resultSchema() validates both shapes', () => {
    const schema = resultSchema(z.object({ a: z.number() }))

    expect(schema.parse({ ok: true, data: { a: 1 } })).toEqual({ ok: true, data: { a: 1 } })
    expect(schema.parse({ ok: false, error: { code: 'E', message: 'msg' } })).toEqual({
      ok: false,
      error: { code: 'E', message: 'msg' },
    })
  })
})
