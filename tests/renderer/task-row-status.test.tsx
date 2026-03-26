import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { TaskRow } from '../../src/features/tasks/TaskRow'

afterEach(() => {
  cleanup()
})

describe('TaskRow status rendering', () => {
  it('renders cancelled tasks as closed rows with an x affordance and restore action', () => {
    const { container } = render(
      <TaskRow
        task={{
          id: 't-cancelled',
          title: 'Cancelled Task',
          status: 'cancelled',
          is_inbox: false,
          is_someday: false,
          project_id: null,
          project_title: null,
          section_id: null,
          area_id: null,
          scheduled_at: null,
          due_at: null,
          created_at: '2026-03-17T00:00:00.000Z',
          updated_at: '2026-03-17T01:00:00.000Z',
          completed_at: '2026-03-17T01:00:00.000Z',
          deleted_at: null,
        }}
        onRestore={() => {}}
      />
    )

    expect(screen.getByRole('checkbox', { name: 'aria.taskDone' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'task.restore' })).toBeInTheDocument()
    expect(container.querySelector('.checkbox-control')).toHaveAttribute('data-mark', 'x')
  })
})
