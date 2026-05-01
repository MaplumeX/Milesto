import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { ok } from '../../shared/result'
import type { WindowApi } from '../../shared/window-api'
import { AppEventsProvider } from '../../src/app/AppEventsContext'
import { TaskEditorPaper } from '../../src/features/tasks/TaskEditorPaper'

function setupApi(status: 'open' | 'done' | 'cancelled') {
  const api = (window as unknown as { api: WindowApi }).api
  const task = {
    id: 't1',
    title: 'Task A',
    notes: '',
    status,
    is_inbox: false,
    is_someday: false,
    project_id: null,
    section_id: null,
    area_id: null,
    scheduled_at: null,
    due_at: null,
    created_at: '2026-03-17T00:00:00.000Z',
    updated_at: '2026-03-17T00:00:00.000Z',
    completed_at: status === 'open' ? null : '2026-03-17T01:00:00.000Z',
    deleted_at: null,
  }

  api.task.getDetail = vi.fn(async () =>
    ok({
      task,
      tag_ids: [],
      checklist_items: [],
    })
  )
  api.project.listOpen = vi.fn(async () => ok([]))
  api.tag.list = vi.fn(async () => ok([]))
  api.area.list = vi.fn(async () => ok([]))
  api.project.listSections = vi.fn(async () => ok([]))
  api.task.countProjectsProgress = vi.fn(async () => ok([]))
  api.task.toggleDone = vi.fn(async (id, done) =>
    ok({
      ...task,
      id,
      status: done ? 'done' : 'open',
      completed_at: done ? '2026-03-17T02:00:00.000Z' : null,
    })
  )
  ;(api.task as typeof api.task & { cancel: (...args: unknown[]) => unknown }).cancel = vi.fn(
    async (id: string) =>
      ok({
        ...task,
        id,
        status: 'cancelled',
        completed_at: '2026-03-17T02:00:00.000Z',
      })
  )
  api.task.restore = vi.fn(async (id: string) =>
    ok({
      ...task,
      id,
      status: 'open',
      completed_at: null,
    })
  ) as WindowApi['task']['restore']

  return { api }
}

describe('TaskEditorPaper status actions', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows an unchecked checkbox for open tasks and marks done on click', async () => {
    const user = userEvent.setup()
    const { api } = setupApi('open')

    render(
      <MemoryRouter>
        <AppEventsProvider>
          <TaskEditorPaper taskId="t1" onRequestClose={() => {}} />
        </AppEventsProvider>
      </MemoryRouter>
    )

    await screen.findByDisplayValue('Task A')
    const checkbox = screen.getByRole('checkbox', { name: 'aria.taskDone' })
    expect(checkbox).not.toBeChecked()

    await user.click(checkbox)

    await waitFor(() => {
      expect(api.task.toggleDone).toHaveBeenCalledWith('t1', true, 'active')
    })
  })

  it('shows a checked checkbox for done tasks and restores on click', async () => {
    const user = userEvent.setup()
    const { api } = setupApi('done')

    render(
      <MemoryRouter>
        <AppEventsProvider>
          <TaskEditorPaper taskId="t1" onRequestClose={() => {}} />
        </AppEventsProvider>
      </MemoryRouter>
    )

    await screen.findByDisplayValue('Task A')
    const checkbox = screen.getByRole('checkbox', { name: 'aria.taskDone' })
    expect(checkbox).toBeChecked()

    await user.click(checkbox)

    await waitFor(() => {
      expect(api.task.restore).toHaveBeenCalledWith('t1', 'active')
    })
  })

  it('shows a checked checkbox for cancelled tasks and restores on click', async () => {
    const user = userEvent.setup()
    const { api } = setupApi('cancelled')

    render(
      <MemoryRouter>
        <AppEventsProvider>
          <TaskEditorPaper taskId="t1" onRequestClose={() => {}} />
        </AppEventsProvider>
      </MemoryRouter>
    )

    await screen.findByDisplayValue('Task A')
    const checkbox = screen.getByRole('checkbox', { name: 'aria.taskDone' })
    expect(checkbox).toBeChecked()

    await user.click(checkbox)

    await waitFor(() => {
      expect(api.task.restore).toHaveBeenCalledWith('t1', 'active')
    })
  })
})
