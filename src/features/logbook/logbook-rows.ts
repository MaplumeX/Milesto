import type { Project } from '../../../shared/schemas/project'
import type { TaskListItem } from '../../../shared/schemas/task-list'

import { formatLocalMonthKey } from '../../lib/dates'
import { formatLogbookDatePrefix, formatLogbookMonthHeader } from './logbook-labels'

export type LogbookTaskEntry = {
  kind: 'task'
  id: string
  title: string
  completedAt: string | null
  updatedAt: string
  task: TaskListItem

  timestampIso: string
  timestampMs: number
  monthKey: string
  datePrefix: string
}

export type LogbookProjectEntry = {
  kind: 'project'
  id: string
  title: string
  completedAt: string | null
  updatedAt: string
  project: Project

  timestampIso: string
  timestampMs: number
  monthKey: string
  datePrefix: string
}

export type LogbookEntry = LogbookTaskEntry | LogbookProjectEntry

export type LogbookRow =
  | { type: 'month'; monthKey: string; label: string }
  | { type: 'task'; entry: LogbookTaskEntry }
  | { type: 'project'; entry: LogbookProjectEntry }

function toTimestampIso(completedAt: string | null, updatedAt: string): string {
  return completedAt ?? updatedAt
}

function toTimestampMs(iso: string): number {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : 0
}

function toLocalDate(ms: number): Date {
  return ms > 0 ? new Date(ms) : new Date(0)
}

function toTaskEntry(task: TaskListItem): LogbookTaskEntry {
  const completedAt = task.completed_at
  const updatedAt = task.updated_at
  const timestampIso = toTimestampIso(completedAt, updatedAt)
  const timestampMs = toTimestampMs(timestampIso)
  const localDate = toLocalDate(timestampMs)

  return {
    kind: 'task',
    id: task.id,
    title: task.title,
    completedAt,
    updatedAt,
    task,
    timestampIso,
    timestampMs,
    monthKey: formatLocalMonthKey(localDate),
    datePrefix: formatLogbookDatePrefix(localDate),
  }
}

function toProjectEntry(project: Project): LogbookProjectEntry {
  const completedAt = project.completed_at
  const updatedAt = project.updated_at
  const timestampIso = toTimestampIso(completedAt, updatedAt)
  const timestampMs = toTimestampMs(timestampIso)
  const localDate = toLocalDate(timestampMs)

  return {
    kind: 'project',
    id: project.id,
    title: project.title,
    completedAt,
    updatedAt,
    project,
    timestampIso,
    timestampMs,
    monthKey: formatLocalMonthKey(localDate),
    datePrefix: formatLogbookDatePrefix(localDate),
  }
}

function mergeSortedEntriesByTimestampDesc(tasks: LogbookTaskEntry[], projects: LogbookProjectEntry[]): LogbookEntry[] {
  const out: LogbookEntry[] = []

  let i = 0
  let j = 0
  while (i < tasks.length || j < projects.length) {
    const t = tasks[i]
    const p = projects[j]

    if (!t && p) {
      out.push(p)
      j++
      continue
    }
    if (!p && t) {
      out.push(t)
      i++
      continue
    }
    if (!t || !p) break

    if (t.timestampMs >= p.timestampMs) {
      out.push(t)
      i++
      continue
    }

    out.push(p)
    j++
  }

  return out
}

export function buildLogbookRows(params: {
  tasks: TaskListItem[]
  projects: Project[]
  locale: string
  now: Date
}): { rows: LogbookRow[]; visibleTasks: TaskListItem[] } {
  const baseYear = params.now.getFullYear()

  const taskEntries = params.tasks.map(toTaskEntry)
  const projectEntries = params.projects.map(toProjectEntry)

  const entries = mergeSortedEntriesByTimestampDesc(taskEntries, projectEntries)

  const rows: LogbookRow[] = []
  const visibleTasks: TaskListItem[] = []

  let lastMonthKey: string | null = null
  for (const e of entries) {
    if (e.monthKey !== lastMonthKey) {
      rows.push({
        type: 'month',
        monthKey: e.monthKey,
        label: formatLogbookMonthHeader({ monthKey: e.monthKey, locale: params.locale, baseYear }),
      })
      lastMonthKey = e.monthKey
    }

    if (e.kind === 'task') {
      rows.push({ type: 'task', entry: e })
      visibleTasks.push(e.task)
      continue
    }

    rows.push({ type: 'project', entry: e })
  }

  return { rows, visibleTasks }
}
