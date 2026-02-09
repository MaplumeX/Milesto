import { describe, expect, it } from 'vitest'

import { toAppError } from '../../shared/app-error'

describe('shared/app-error', () => {
  it('passes through an AppError shape', () => {
    const input = { code: 'X', message: 'm', details: { a: 1 } }
    expect(toAppError(input, { code: 'F', message: 'fallback' })).toEqual(input)
  })

  it('returns fallback for non-AppError input', () => {
    const fallback = { code: 'F', message: 'fallback' }
    expect(toAppError(new Error('boom'), fallback)).toEqual(fallback)
  })
})
