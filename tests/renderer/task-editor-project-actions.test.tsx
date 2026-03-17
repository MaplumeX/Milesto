import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TaskEditorProjectActions } from '../../src/features/tasks/TaskEditorProjectActions'

describe('TaskEditorProjectActions', () => {
  it('renders nothing in trigger mode when the task has no project', () => {
    const { container } = render(
      <TaskEditorProjectActions
        mode="trigger"
        projectTitle={null}
        projectStatus="open"
        doneCount={0}
        totalCount={0}
        onToggleMenu={() => {}}
      />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the trigger button when the task belongs to a project', async () => {
    const user = userEvent.setup()
    const onToggleMenu = vi.fn()

    render(
      <TaskEditorProjectActions
        mode="trigger"
        projectTitle="Project Alpha"
        projectStatus="open"
        doneCount={2}
        totalCount={5}
        onToggleMenu={onToggleMenu}
      />
    )

    const trigger = screen.getByRole('button', { name: 'Project Alpha' })
    expect(trigger.querySelector('.project-progress-control')).not.toBeNull()

    await user.click(trigger)
    expect(onToggleMenu).toHaveBeenCalledTimes(1)
  })

  it('renders open and change actions in menu mode', () => {
    render(
      <TaskEditorProjectActions
        mode="menu"
        onOpenProject={() => {}}
        onOpenMove={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: 'taskEditor.openProject' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'taskEditor.changeProject' })).toBeInTheDocument()
  })
})
