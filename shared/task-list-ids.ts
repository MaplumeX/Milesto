// Centralized list-id strings used for per-view ordering (list_positions).
// Keep these stable: they are persisted in the DB.

export const TASK_LIST_ID_INBOX = 'inbox' as const
export const TASK_LIST_ID_ANYTIME = 'anytime' as const
export const TASK_LIST_ID_SOMEDAY = 'someday' as const
export const TASK_LIST_ID_TODAY = 'today' as const

export function taskListIdArea(areaId: string): string {
  return `area:${areaId}`
}

export function taskListIdProject(projectId: string, sectionId: string | null): string {
  return `project:${projectId}:${sectionId ?? 'none'}`
}
