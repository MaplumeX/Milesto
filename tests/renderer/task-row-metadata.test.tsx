import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'

import { TaskRow } from '../../src/features/tasks/TaskRow'

afterEach(() => {
  cleanup()
})

function makeTask(overrides?: Partial<Parameters<typeof TaskRow>[0]['task']>) {
  return {
    id: 't1',
    title: 'Task A',
    status: 'open' as const,
    is_inbox: false,
    is_someday: false,
    project_id: null,
    project_title: null,
    section_id: null,
    area_id: null,
    scheduled_at: null,
    due_at: null,
    created_at: '2026-03-26T00:00:00.000Z',
    updated_at: '2026-03-26T00:00:00.000Z',
    completed_at: null,
    deleted_at: null,
    tag_preview: [],
    tag_count: 0,
    ...overrides,
  }
}

describe('TaskRow metadata preview', () => {
  it('renders schedule, due, and tags in a stable right-side order with overflow', () => {
    const { container } = render(
      <TaskRow
        task={makeTask({
          scheduled_at: '2026-03-26',
          due_at: '2026-03-28',
          tag_preview: ['Urgent', 'Home'],
          tag_count: 3,
        })}
        showProjectAffiliation={false}
      />
    )

    const cluster = container.querySelector('[data-task-row-meta="cluster"]')
    expect(cluster).not.toBeNull()

    const items = Array.from(cluster?.querySelectorAll<HTMLElement>('[data-task-row-meta-kind]') ?? [])
    expect(items.map((item) => item.dataset.taskRowMetaKind)).toEqual(['schedule', 'due', 'tags'])
    expect(items[0]?.textContent).toContain('taskEditor.scheduledPrefix')
    expect(items[0]?.textContent).toContain('2026-03-26')
    expect(items[1]?.textContent).toContain('taskEditor.duePrefix')
    expect(items[1]?.textContent).toContain('2026-03-28')
    expect(items[2]?.textContent).toContain('Urgent')
    expect(items[2]?.textContent).toContain('Home')
    expect(items[2]?.textContent).toContain('+1')
  })

  it('uses the someday label for schedule previews', () => {
    const { container } = render(
      <TaskRow task={makeTask({ is_someday: true })} showProjectAffiliation={false} />
    )

    const schedule = container.querySelector<HTMLElement>('[data-task-row-meta-kind="schedule"]')
    expect(schedule?.textContent).toContain('nav.someday')
  })

  it('omits the metadata cluster when nothing is visible', () => {
    const { container } = render(
      <TaskRow task={makeTask()} showProjectAffiliation={false} />
    )

    expect(container.querySelector('[data-task-row-meta="cluster"]')).toBeNull()
  })
})
