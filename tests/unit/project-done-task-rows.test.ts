import { describe, expect, it } from 'vitest'

import type { ProjectSection } from '../../shared/schemas/project'
import type { TaskListItem } from '../../shared/schemas/task-list'
import { buildProjectDoneTaskRows } from '../../src/features/tasks/project-done-task-rows'

function makeTask(overrides: Partial<TaskListItem>): TaskListItem {
  return {
    id: 'task-1',
    title: 'Task',
    status: 'done',
    is_inbox: false,
    is_someday: false,
    project_id: 'project-1',
    project_title: 'Project Alpha',
    section_id: null,
    area_id: null,
    scheduled_at: null,
    due_at: null,
    created_at: '2026-03-18T09:00:00.000Z',
    updated_at: '2026-03-18T10:00:00.000Z',
    completed_at: '2026-03-18T10:30:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

function makeSection(overrides: Partial<ProjectSection>): ProjectSection {
  return {
    id: 'section-1',
    project_id: 'project-1',
    title: 'Section Alpha',
    position: 1000,
    created_at: '2026-03-18T08:00:00.000Z',
    updated_at: '2026-03-18T08:30:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

describe('buildProjectDoneTaskRows', () => {
  it('flattens the old section blocks into one list while preserving section-group order', () => {
    const rows = buildProjectDoneTaskRows({
      doneTasks: [
        makeTask({ id: 'task-section-b', title: 'Grouped done task B', section_id: 'section-2' }),
        makeTask({ id: 'task-none', title: 'Ungrouped done task', section_id: null }),
        makeTask({ id: 'task-section-a', title: 'Grouped done task A', section_id: 'section-1' }),
        makeTask({ id: 'task-missing', title: 'Missing section task', section_id: 'section-missing' }),
      ],
      sections: [
        makeSection({ id: 'section-1', title: 'Section Alpha' }),
        makeSection({ id: 'section-2', title: 'Section Beta' }),
      ],
    })

    expect(rows.map((row) => ({ id: row.task.id, affiliationLabel: row.affiliationLabel }))).toEqual([
      { id: 'task-none', affiliationLabel: null },
      { id: 'task-missing', affiliationLabel: null },
      { id: 'task-section-a', affiliationLabel: 'Section Alpha' },
      { id: 'task-section-b', affiliationLabel: 'Section Beta' },
    ])
  })
})
