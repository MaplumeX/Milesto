import { describe, expect, it } from 'vitest'

import type { TaskListItem } from '../../shared/schemas/task-list'
import { buildUpcomingRows } from '../../src/features/tasks/upcoming-grouping'

function makeTask(params: { id: string; title: string; scheduled_at: string | null }): TaskListItem {
  const now = '2026-01-01T00:00:00.000Z'
  return {
    id: params.id,
    title: params.title,
    status: 'open',
    is_inbox: false,
    is_someday: false,
    project_id: null,
    section_id: null,
    area_id: null,
    scheduled_at: params.scheduled_at,
    due_at: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
    deleted_at: null,
  }
}

describe('upcoming-grouping', () => {
  it('renders fixed headers even with no tasks', () => {
    const { rows, visibleTasks } = buildUpcomingRows({ tasks: [], today: '2026-01-15', locale: 'en' })
    expect(visibleTasks).toHaveLength(0)
    expect(rows.filter((r) => r.type === 'header')).toHaveLength(12)
    expect(rows.filter((r) => r.type === 'task')).toHaveLength(0)
  })

  it('splits the next 7 days by day and the following 5 months by month (no overlap)', () => {
    const tasks = [
      makeTask({ id: 'a', title: 'in day bucket', scheduled_at: '2026-02-02' }),
      makeTask({ id: 'b', title: 'in month bucket', scheduled_at: '2026-02-06' }),
      makeTask({ id: 'c', title: 'too far', scheduled_at: '2026-07-01' }),
    ]

    const { rows, visibleTasks } = buildUpcomingRows({ tasks, today: '2026-01-28', locale: 'en' })

    expect(visibleTasks.map((t) => t.id).sort()).toEqual(['a', 'b'])

    const dayHeaderIndex = rows.findIndex((r) => r.type === 'header' && r.kind === 'day' && r.key === '2026-02-02')
    expect(dayHeaderIndex).toBeGreaterThanOrEqual(0)
    expect(rows[dayHeaderIndex + 1]).toMatchObject({ type: 'task', task: { id: 'a' }, datePrefix: null })

    const monthHeaderIndex = rows.findIndex((r) => r.type === 'header' && r.kind === 'month' && r.key === '2026-02')
    expect(monthHeaderIndex).toBeGreaterThanOrEqual(0)

    const monthTasks = rows
      .slice(monthHeaderIndex + 1)
      .filter((r) => r.type === 'task')
      .map((r) => r.task.id)

    expect(monthTasks).toContain('b')

    const monthTaskRow = rows.find((r) => r.type === 'task' && r.task.id === 'b')
    expect(monthTaskRow && monthTaskRow.type === 'task' ? monthTaskRow.datePrefix : null).toBe('2/6')
  })
})
