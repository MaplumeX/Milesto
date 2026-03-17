import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TaskMovePopoverContent } from '../../src/features/tasks/TaskMovePopoverContent'

describe('TaskMovePopoverContent', () => {
  it('renders areas and projects, then emits the expected task patch', async () => {
    const user = userEvent.setup()
    const onMove = vi.fn(async () => {})

    render(
      <TaskMovePopoverContent
        areas={[
          {
            id: 'a1',
            title: 'Area One',
            notes: '',
            created_at: '2026-03-17T00:00:00.000Z',
            updated_at: '2026-03-17T00:00:00.000Z',
            deleted_at: null,
          },
        ]}
        openProjects={[
          {
            id: 'p1',
            title: 'Project Alpha',
            notes: '',
            area_id: null,
            status: 'open',
            scheduled_at: null,
            is_someday: false,
            due_at: null,
            created_at: '2026-03-17T00:00:00.000Z',
            updated_at: '2026-03-17T00:00:00.000Z',
            completed_at: null,
            deleted_at: null,
          },
        ]}
        actionError={null}
        onMove={onMove}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Area One' }))
    expect(onMove).toHaveBeenCalledWith({
      area_id: 'a1',
      project_id: null,
      section_id: null,
      is_inbox: false,
    })

    await user.click(screen.getByRole('button', { name: 'Project Alpha' }))
    expect(onMove).toHaveBeenCalledWith({
      project_id: 'p1',
      area_id: null,
      section_id: null,
      is_inbox: false,
    })
  })
})
