import type { TaskListItem } from '../../../shared/schemas/task-list'

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
} from './upcoming-labels'

export type UpcomingHeaderKind = 'day' | 'month'

export type UpcomingDayLabel = { day: string; weekday: string }

export type UpcomingRow =
  | { type: 'header'; kind: 'day'; key: string; label: UpcomingDayLabel }
  | { type: 'header'; kind: 'month'; key: string; label: string }
  | { type: 'task'; task: TaskListItem; datePrefix: string | null }
  | { type: 'spacer'; kind: UpcomingHeaderKind; key: string }

export function buildUpcomingRows(params: {
  tasks: TaskListItem[]
  today: string
  locale: string
}): { rows: UpcomingRow[]; visibleTasks: TaskListItem[] } {
  const { tasks, today, locale } = params

  const todayDate = parseLocalDate(today) ?? new Date()
  todayDate.setHours(0, 0, 0, 0)

  const d0 = addDays(todayDate, 1)

  const dayDates = Array.from({ length: 7 }, (_, i) => addDays(d0, i))
  const dayKeys = dayDates.map((d) => formatLocalDate(d))
  const daySet = new Set(dayKeys)

  const dayBuckets = new Map<string, TaskListItem[]>()
  for (const k of dayKeys) dayBuckets.set(k, [])

  const m0 = addDays(d0, 7)
  const monthStarts = Array.from({ length: 5 }, (_, i) => startOfMonth(new Date(m0.getFullYear(), m0.getMonth() + i, 1)))
  const monthKeys = monthStarts.map((d) => formatLocalMonthKey(d))
  const monthSet = new Set(monthKeys)

  const monthBuckets = new Map<string, TaskListItem[]>()
  for (const k of monthKeys) monthBuckets.set(k, [])

  const monthEnd = endOfMonth(monthStarts[monthStarts.length - 1] ?? m0)

  const visibleTasks: TaskListItem[] = []

  for (const t of tasks) {
    if (!t.scheduled_at) continue

    if (daySet.has(t.scheduled_at)) {
      const bucket = dayBuckets.get(t.scheduled_at)
      if (bucket) bucket.push(t)
      visibleTasks.push(t)
      continue
    }

    const scheduled = parseLocalDate(t.scheduled_at)
    if (!scheduled) continue

    if (scheduled < m0 || scheduled > monthEnd) continue

    const mk = formatLocalMonthKey(scheduled)
    if (!monthSet.has(mk)) continue
    const bucket = monthBuckets.get(mk)
    if (bucket) bucket.push(t)
    visibleTasks.push(t)
  }

  const rows: UpcomingRow[] = []

  for (let i = 0; i < dayDates.length; i++) {
    const date = dayDates[i]
    const key = dayKeys[i]
    rows.push({ type: 'header', kind: 'day', key, label: formatUpcomingDayHeader(date, locale) })

    for (const task of dayBuckets.get(key) ?? []) {
      rows.push({ type: 'task', task, datePrefix: null })
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

    for (const task of monthBuckets.get(key) ?? []) {
      const scheduled = task.scheduled_at ? parseLocalDate(task.scheduled_at) : null
      const prefix = scheduled ? formatUpcomingMonthTaskPrefix(scheduled, locale) : null
      rows.push({ type: 'task', task, datePrefix: prefix })
    }

    rows.push({ type: 'spacer', kind: 'month', key })
  }

  return { rows, visibleTasks }
}
