import { addDays, parseLocalDate } from '../../lib/dates'

export const TASK_TAG_PREVIEW_LIMIT = 2

export function getTaskSchedulePreviewLabel(
  input: {
    is_someday: boolean
    scheduled_at: string | null
  },
  labels: {
    someday: string
  }
): string | null {
  if (input.is_someday) return labels.someday
  return input.scheduled_at
}

export function getTaskTagPreview(tagTitles: readonly string[], totalCount = tagTitles.length) {
  const visible = tagTitles.slice(0, TASK_TAG_PREVIEW_LIMIT)
  const normalizedTotal = Math.max(totalCount, visible.length)

  return {
    visible,
    overflowCount: Math.max(normalizedTotal - visible.length, 0),
  }
}

export function isDueUrgent(dueAt: string | null, today: string): boolean {
  if (!dueAt) return false
  const due = parseLocalDate(dueAt)
  if (!due) return false
  const now = parseLocalDate(today)
  if (!now) return false
  return due.getTime() <= now.getTime()
}

export function isDueNear(dueAt: string | null, today: string): boolean {
  if (!dueAt) return false
  const due = parseLocalDate(dueAt)
  if (!due) return false
  const now = parseLocalDate(today)
  if (!now) return false
  const threshold = addDays(now, 3)
  return due.getTime() <= threshold.getTime()
}
