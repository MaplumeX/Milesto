import { describe, expect, it } from 'vitest'

import { TaskSearchInputSchema } from '../../shared/schemas/search'

describe('shared/schemas/search', () => {
  it('requires non-empty query', () => {
    expect(TaskSearchInputSchema.safeParse({ query: '' }).success).toBe(false)
    expect(TaskSearchInputSchema.safeParse({ query: 'x' }).success).toBe(true)
  })
})
