import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { err, ok } from '../../shared/result'
import type { WindowApi } from '../../shared/window-api'
import { AppEventsProvider } from '../../src/app/AppEventsContext'
import { TaskEditorPaper } from '../../src/features/tasks/TaskEditorPaper'

const navigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

function makeTaskDetail(projectId: string | null, projectTitle = 'Project Alpha') {
  return {
    task: {
      id: 't1',
      title: 'Task A',
      notes: '',
      status: 'open' as const,
      is_inbox: false,
      is_someday: false,
      project_id: projectId,
      section_id: null,
      area_id: null,
      scheduled_at: null,
      due_at: null,
      created_at: '2026-03-17T00:00:00.000Z',
      updated_at: '2026-03-17T00:00:00.000Z',
      completed_at: null,
      deleted_at: null,
    },
    tag_ids: [],
    checklist_items: [],
    __projectTitle: projectTitle,
  }
}

function setupApi(
  detailProjectId: string | null,
  options?: {
    updateFails?: boolean
    countProjectsProgress?: WindowApi['task']['countProjectsProgress']
  }
) {
  const api = (window as unknown as { api: WindowApi }).api
  const detail = makeTaskDetail(detailProjectId)
  const events: string[] = []

  api.task.getDetail = vi.fn(async () =>
    ok({
      task: detail.task,
      tag_ids: detail.tag_ids,
      checklist_items: detail.checklist_items,
    })
  )
  api.project.listOpen = vi.fn(async () =>
    ok(
      detailProjectId
        ? [
            {
              id: detailProjectId,
              title: detail.__projectTitle,
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
          ]
        : []
    )
  )
  api.tag.list = vi.fn(async () => ok([]))
  api.area.list = vi.fn(async () => ok([]))
  api.project.listSections = vi.fn(async () => ok([]))
  api.project.get = vi.fn(async () =>
    ok({
      id: 'p1',
      title: detail.__projectTitle,
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
    })
  )
  api.task.countProjectsProgress = vi.fn<WindowApi['task']['countProjectsProgress']>(
    options?.countProjectsProgress ??
      (async () =>
        ok(
          detailProjectId
            ? [
                {
                  project_id: detailProjectId,
                  done_count: 2,
                  total_count: 5,
                },
              ]
            : []
        ))
  )
  api.task.update = vi.fn(async (input) => {
    if (options?.updateFails) {
      events.push('save-failed')
      return err({ code: 'SAVE_FAILED', message: 'Save failed.' })
    }

    events.push('save')
    return ok({
      ...detail.task,
      title: input.title ?? detail.task.title,
      notes: input.notes ?? detail.task.notes,
      project_id: input.project_id !== undefined ? input.project_id : detail.task.project_id,
      section_id: input.section_id !== undefined ? input.section_id : detail.task.section_id,
      area_id: input.area_id !== undefined ? input.area_id : detail.task.area_id,
      is_inbox: input.is_inbox !== undefined ? input.is_inbox : detail.task.is_inbox,
      is_someday: input.is_someday !== undefined ? input.is_someday : detail.task.is_someday,
      scheduled_at: input.scheduled_at !== undefined ? input.scheduled_at : detail.task.scheduled_at,
      due_at: input.due_at !== undefined ? input.due_at : detail.task.due_at,
      updated_at: '2026-03-17T00:00:01.000Z',
    })
  })

  navigate.mockImplementation((path: string) => {
    events.push(`navigate:${path}`)
  })

  return { api, events }
}

describe('TaskEditorPaper project actions', () => {
  beforeEach(() => {
    navigate.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the project trigger only when the task belongs to a project', async () => {
    setupApi(null)
    const { rerender } = render(
      <MemoryRouter>
        <AppEventsProvider>
          <TaskEditorPaper
            taskId="t1"
            variant="inline"
            onRequestClose={() => {}}
          />
        </AppEventsProvider>
      </MemoryRouter>
    )

    await screen.findByDisplayValue('Task A')
    expect(screen.queryByRole('button', { name: 'Project Alpha' })).toBeNull()

    setupApi('p1')
    rerender(
      <MemoryRouter>
        <AppEventsProvider>
          <TaskEditorPaper
            taskId="t2"
            variant="inline"
            onRequestClose={() => {}}
          />
        </AppEventsProvider>
      </MemoryRouter>
    )

    await screen.findByRole('button', { name: 'Project Alpha' })
  })

  it('renders the project trigger in the editor footer instead of the action bar', async () => {
    setupApi('p1')

    render(
      <MemoryRouter>
        <AppEventsProvider>
          <TaskEditorPaper
            taskId="t1"
            variant="inline"
            onRequestClose={() => {}}
          />
        </AppEventsProvider>
      </MemoryRouter>
    )

    const projectButton = await screen.findByRole('button', { name: 'Project Alpha' })
    expect(projectButton.closest('.task-inline-footer')).not.toBeNull()
    expect(projectButton.closest('.task-inline-action-bar-right')).toBeNull()
  })

  it('renders the real project progress indicator inside the project trigger', async () => {
    const { api } = setupApi('p1')

    render(
      <MemoryRouter>
        <AppEventsProvider>
          <TaskEditorPaper
            taskId="t1"
            variant="inline"
            onRequestClose={() => {}}
          />
        </AppEventsProvider>
      </MemoryRouter>
    )

    const projectButton = await screen.findByRole('button', { name: 'Project Alpha' })
    expect(api.task.countProjectsProgress).toHaveBeenCalledWith(['p1'])
    const indicator = projectButton.querySelector('.project-progress-control')
    expect(indicator).not.toBeNull()
    expect(indicator).toHaveAttribute('data-progress', 'partial')
  })

  it('waits for project progress before rendering the project trigger', async () => {
    let resolveProgress!: (value: Awaited<ReturnType<WindowApi['task']['countProjectsProgress']>>) => void
    const progressPromise = new Promise<Awaited<ReturnType<WindowApi['task']['countProjectsProgress']>>>((resolve) => {
      resolveProgress = resolve
    })
    const countProjectsProgress = vi.fn<WindowApi['task']['countProjectsProgress']>(() => progressPromise)

    setupApi('p1', { countProjectsProgress })

    render(
      <MemoryRouter>
        <AppEventsProvider>
          <TaskEditorPaper
            taskId="t1"
            variant="inline"
            onRequestClose={() => {}}
          />
        </AppEventsProvider>
      </MemoryRouter>
    )

    await screen.findByDisplayValue('Task A')
    await waitFor(() => {
      expect(countProjectsProgress).toHaveBeenCalledWith(['p1'])
    })
    expect(screen.queryByRole('button', { name: 'Project Alpha' })).toBeNull()

    resolveProgress(
      ok([
        {
          project_id: 'p1',
          done_count: 2,
          total_count: 5,
        },
      ])
    )

    await screen.findByRole('button', { name: 'Project Alpha' })
  })

  it('does not show the project trigger when the parent page disables project actions', async () => {
    setupApi('p1')

    render(
      <MemoryRouter>
        <AppEventsProvider>
          <TaskEditorPaper
            taskId="t1"
            variant="inline"
            showProjectActions={false}
            onRequestClose={() => {}}
          />
        </AppEventsProvider>
      </MemoryRouter>
    )

    await screen.findByDisplayValue('Task A')
    expect(screen.queryByRole('button', { name: 'Project Alpha' })).toBeNull()
  })

  it('flushes pending changes before navigating into the project', async () => {
    const user = userEvent.setup()
    const { api, events } = setupApi('p1')

    render(
      <MemoryRouter>
        <AppEventsProvider>
          <TaskEditorPaper
            taskId="t1"
            variant="inline"
            onRequestClose={() => {}}
          />
        </AppEventsProvider>
      </MemoryRouter>
    )

    const titleInput = await screen.findByDisplayValue('Task A')
    await user.clear(titleInput)
    await user.type(titleInput, 'Task A updated')

    await user.click(screen.getByRole('button', { name: 'Project Alpha' }))
    await user.click(await screen.findByRole('button', { name: 'taskEditor.openProject' }))

    await waitFor(() => {
      expect(api.task.update).toHaveBeenCalledWith({ id: 't1', title: 'Task A updated' })
    })
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/projects/p1')
    })
    expect(events).toEqual(['save', 'navigate:/projects/p1'])
  })

  it('does not navigate when flush fails', async () => {
    const user = userEvent.setup()
    const { api } = setupApi('p1', { updateFails: true })

    render(
      <MemoryRouter>
        <AppEventsProvider>
          <TaskEditorPaper
            taskId="t1"
            variant="inline"
            onRequestClose={() => {}}
          />
        </AppEventsProvider>
      </MemoryRouter>
    )

    const titleInput = await screen.findByDisplayValue('Task A')
    await user.clear(titleInput)
    await user.type(titleInput, 'Task A updated')

    await user.click(screen.getByRole('button', { name: 'Project Alpha' }))
    await user.click(await screen.findByRole('button', { name: 'taskEditor.openProject' }))

    await waitFor(() => {
      expect(api.task.update).toHaveBeenCalled()
    })
    expect(navigate).not.toHaveBeenCalled()
  })
})
