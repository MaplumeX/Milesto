import { describe, expect, it } from 'vitest'

import { formatLogbookMonthHeader } from '../../src/features/logbook/logbook-labels'

describe('logbook-labels', () => {
  it('omits year for current-year month headers (zh-CN)', () => {
    expect(formatLogbookMonthHeader({ monthKey: '2026-12', locale: 'zh-CN', baseYear: 2026 })).toBe('12月')
    expect(formatLogbookMonthHeader({ monthKey: '2025-12', locale: 'zh-CN', baseYear: 2026 })).toBe('2025年12月')
  })

  it('returns the key for invalid month keys', () => {
    expect(formatLogbookMonthHeader({ monthKey: 'nope', locale: 'en', baseYear: 2026 })).toBe('nope')
  })
})
