import { describe, expect, it } from 'vitest'

import type { Project } from '../../shared/schemas/project'
import type { TaskListItem } from '../../shared/schemas/task-list'
import { buildLogbookRows } from '../../src/features/logbook/logbook-rows'
import { formatLogbookDatePrefix } from '../../src/features/logbook/logbook-labels'

function makeDoneTask(params: {
  id: string
  title: string
  completed_at: string | null
  updated_at: string
}): TaskListItem {
  const created_at = '2026-01-01T00:00:00.000Z'
  return {
    id: params.id,
    title: params.title,
    status: 'done',
    is_inbox: false,
    is_someday: false,
    project_id: null,
    section_id: null,
    area_id: null,
    scheduled_at: null,
    due_at: null,
    created_at,
    updated_at: params.updated_at,
    completed_at: params.completed_at,
    deleted_at: null,
  }
}

function makeDoneProject(params: {
  id: string
  title: string
  completed_at: string | null
  updated_at: string
}): Project {
  const created_at = '2026-01-01T00:00:00.000Z'
  return {
    id: params.id,
    title: params.title,
    notes: '',
    area_id: null,
    status: 'done',
    scheduled_at: null,
    is_someday: false,
    due_at: null,
    created_at,
    updated_at: params.updated_at,
    completed_at: params.completed_at,
    deleted_at: null,
  }
}

describe('logbook-rows', () => {
  it('merges tasks + projects into one descending stream and groups by month', () => {
    const tasks: TaskListItem[] = [
      makeDoneTask({
        id: 't1',
        title: 'Task 1',
        completed_at: '2026-02-17T12:00:00.000Z',
        updated_at: '2026-02-17T12:00:00.000Z',
      }),
      makeDoneTask({
        id: 't2',
        title: 'Task 2 (fallback)',
        completed_at: null,
        updated_at: '2026-02-15T12:00:00.000Z',
      }),
      makeDoneTask({
        id: 't3',
        title: 'Task 3',
        completed_at: '2026-01-04T12:00:00.000Z',
        updated_at: '2026-01-04T12:00:00.000Z',
      }),
    ]

    const projects: Project[] = [
      makeDoneProject({
        id: 'p1',
        title: 'Project 1',
        completed_at: '2026-02-16T12:00:00.000Z',
        updated_at: '2026-02-16T12:00:00.000Z',
      }),
      makeDoneProject({
        id: 'p2',
        title: 'Project 2',
        completed_at: '2026-01-05T12:00:00.000Z',
        updated_at: '2026-01-05T12:00:00.000Z',
      }),
    ]

    const { rows } = buildLogbookRows({ tasks, projects, locale: 'zh-CN', now: new Date(2026, 1, 20) })

    const ids = rows.map((r) => {
      if (r.type === 'month') return `m:${r.monthKey}`
      if (r.type === 'task') return `t:${r.entry.id}`
      return `p:${r.entry.id}`
    })

    expect(ids).toEqual(['m:2026-02', 't:t1', 'p:p1', 't:t2', 'm:2026-01', 'p:p2', 't:t3'])

    const t2Row = rows.find((r) => r.type === 'task' && r.entry.id === 't2')
    if (!t2Row || t2Row.type !== 'task') throw new Error('Missing t2 row')
    expect(t2Row.entry.completedAt).toBe(null)
    expect(t2Row.entry.timestampIso).toBe('2026-02-15T12:00:00.000Z')
    expect(t2Row.entry.datePrefix).toBe(formatLogbookDatePrefix(new Date(Date.parse('2026-02-15T12:00:00.000Z'))))
  })
})
