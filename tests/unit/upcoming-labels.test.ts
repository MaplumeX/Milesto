import { describe, expect, it } from 'vitest'

import {
  formatUpcomingDayHeader,
  formatUpcomingMonthHeader,
  formatUpcomingMonthTaskPrefix,
} from '../../src/features/tasks/upcoming-labels'

describe('upcoming-labels', () => {
  it('formats day headers (en)', () => {
    const d = new Date(2026, 1, 13)
    expect(formatUpcomingDayHeader(d, 'en')).toBe('2/13 Fri')
  })

  it('formats day headers (zh-CN)', () => {
    const d = new Date(2026, 1, 13)
    expect(formatUpcomingDayHeader(d, 'zh-CN')).toBe('2.13 周五')
  })

  it('formats month headers (no range)', () => {
    const feb = new Date(2026, 1, 1)
    expect(formatUpcomingMonthHeader({ month: feb, locale: 'en', baseYear: 2026 })).toBe('Feb')
    expect(formatUpcomingMonthHeader({ month: feb, locale: 'zh-CN', baseYear: 2026 })).toBe('2月')
  })

  it('formats the first month header range when needed', () => {
    const feb = new Date(2026, 1, 1)
    const start = new Date(2026, 1, 20)
    const end = new Date(2026, 1, 28)
    expect(formatUpcomingMonthHeader({ month: feb, locale: 'en', rangeStart: start, rangeEnd: end })).toBe(
      'Feb (20-28)'
    )
    expect(formatUpcomingMonthHeader({ month: feb, locale: 'zh-CN', rangeStart: start, rangeEnd: end })).toBe(
      '2月（20-28）'
    )
  })

  it('includes the year when the month is not in the current year', () => {
    const jan2027 = new Date(2027, 0, 1)
    expect(formatUpcomingMonthHeader({ month: jan2027, locale: 'en', baseYear: 2026 })).toBe('Jan 2027')
    expect(formatUpcomingMonthHeader({ month: jan2027, locale: 'zh-CN', baseYear: 2026 })).toBe('2027年1月')
  })

  it('formats month task date prefixes', () => {
    const d = new Date(2026, 1, 21)
    expect(formatUpcomingMonthTaskPrefix(d, 'en')).toBe('2/21')
    expect(formatUpcomingMonthTaskPrefix(d, 'zh-CN')).toBe('2.21')
  })
})
