import type { ViewListItem } from '../../../shared/schemas/view-list'

import {
  addDays,
  endOfMonth,
  formatLocalDate,
  formatLocalMonthKey,
  parseLocalDate,
  startOfMonth,
} from '../../lib/dates'
import {
  formatUpcomingDayHeader,
  formatUpcomingMonthHeader,
  formatUpcomingMonthTaskPrefix,
} from '../tasks/upcoming-labels'
import type { UpcomingDayLabel, UpcomingHeaderKind } from '../tasks/upcoming-grouping'

export type UpcomingViewRow =
  | { type: 'header'; kind: 'day'; key: string; label: UpcomingDayLabel }
  | { type: 'header'; kind: 'month'; key: string; label: string }
  | { type: 'item'; item: ViewListItem; datePrefix: string | null }
  | { type: 'spacer'; kind: UpcomingHeaderKind; key: string }

export function buildUpcomingViewRows(params: {
  items: ViewListItem[]
  today: string
  locale: string
}): { rows: UpcomingViewRow[]; visibleItems: ViewListItem[] } {
  const { items, today, locale } = params

  const todayDate = parseLocalDate(today) ?? new Date()
  todayDate.setHours(0, 0, 0, 0)

  const d0 = addDays(todayDate, 1)
  const dayDates = Array.from({ length: 7 }, (_, i) => addDays(d0, i))
  const dayKeys = dayDates.map((d) => formatLocalDate(d))
  const daySet = new Set(dayKeys)

  const dayBuckets = new Map<string, ViewListItem[]>()
  for (const key of dayKeys) dayBuckets.set(key, [])

  const m0 = addDays(d0, 7)
  const monthStarts = Array.from({ length: 5 }, (_, i) => startOfMonth(new Date(m0.getFullYear(), m0.getMonth() + i, 1)))
  const monthKeys = monthStarts.map((d) => formatLocalMonthKey(d))
  const monthSet = new Set(monthKeys)

  const monthBuckets = new Map<string, ViewListItem[]>()
  for (const key of monthKeys) monthBuckets.set(key, [])

  const monthEnd = endOfMonth(monthStarts[monthStarts.length - 1] ?? m0)
  const visibleItems: ViewListItem[] = []

  for (const item of items) {
    if (!item.scheduled_at) continue

    if (daySet.has(item.scheduled_at)) {
      const bucket = dayBuckets.get(item.scheduled_at)
      if (bucket) bucket.push(item)
      visibleItems.push(item)
      continue
    }

    const scheduled = parseLocalDate(item.scheduled_at)
    if (!scheduled) continue
    if (scheduled < m0 || scheduled > monthEnd) continue

    const monthKey = formatLocalMonthKey(scheduled)
    if (!monthSet.has(monthKey)) continue
    const bucket = monthBuckets.get(monthKey)
    if (bucket) bucket.push(item)
    visibleItems.push(item)
  }

  const rows: UpcomingViewRow[] = []

  for (let i = 0; i < dayDates.length; i++) {
    const date = dayDates[i]
    const key = dayKeys[i]
    rows.push({ type: 'header', kind: 'day', key, label: formatUpcomingDayHeader(date, locale) })

    for (const item of dayBuckets.get(key) ?? []) {
      rows.push({ type: 'item', item, datePrefix: null })
    }

    rows.push({ type: 'spacer', kind: 'day', key })
  }

  for (let i = 0; i < monthStarts.length; i++) {
    const month = monthStarts[i]
    const key = monthKeys[i]
    const isFirstMonth = i === 0
    const rangeStart = isFirstMonth && m0.getDate() !== 1 ? m0 : undefined
    const rangeEnd = rangeStart ? endOfMonth(month) : undefined

    rows.push({
      type: 'header',
      kind: 'month',
      key,
      label: formatUpcomingMonthHeader({ month, locale, rangeStart, rangeEnd, baseYear: todayDate.getFullYear() }),
    })

    for (const item of monthBuckets.get(key) ?? []) {
      const scheduled = item.scheduled_at ? parseLocalDate(item.scheduled_at) : null
      const prefix = scheduled ? formatUpcomingMonthTaskPrefix(scheduled, locale) : null
      rows.push({ type: 'item', item, datePrefix: prefix })
    }

    rows.push({ type: 'spacer', kind: 'month', key })
  }

  return { rows, visibleItems }
}
