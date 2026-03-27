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
