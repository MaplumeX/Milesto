import { useMemo, useRef, useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ok } from '../../shared/result'
import type { WindowApi } from '../../shared/window-api'
import type { Project } from '../../shared/schemas/project'
import type { Task } from '../../shared/schemas/task'
import type { TaskListItem } from '../../shared/schemas/task-list'

import { AppEventsProvider, useAppEvents } from '../../src/app/AppEventsContext'
import { ContentScrollProvider } from '../../src/app/ContentScrollContext'
import type { TaskSelection } from '../../src/features/tasks/TaskSelectionContext'
import { TaskSelectionProvider } from '../../src/features/tasks/TaskSelectionContext'
import { LogbookPage } from '../../src/pages/LogbookPage'

vi.mock('@tanstack/react-virtual', () => {
  return {
    useVirtualizer: (opts: { count: number; scrollMargin?: number }) => {
      const scrollMargin = opts.scrollMargin ?? 0
      return {
        options: { scrollMargin },
        getTotalSize: () => opts.count * 44,
        getVirtualItems: () => Array.from({ length: opts.count }, (_, index) => ({ index, start: index * 44 })),
        measureElement: () => {},
        scrollToIndex: () => {},
      }
    },
  }
})

function RevisionProbe() {
  const { revision } = useAppEvents()
  return <div data-testid="revision">{revision}</div>
}

function LogbookPageHarness() {
  const contentScrollRef = useRef<HTMLDivElement | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  const selection: TaskSelection = useMemo(
    () => ({
      selectedTaskId,
      selectTask: (id) => setSelectedTaskId(id),
      openTaskId,
      openTask: async (id) => setOpenTaskId(id),
      closeTask: () => setOpenTaskId(null),
      requestCloseTask: async () => true,
      registerOpenEditor: () => {},
    }),
    [openTaskId, selectedTaskId]
  )

  return (
    <MemoryRouter>
      <AppEventsProvider>
        <TaskSelectionProvider value={selection}>
          <ContentScrollProvider scrollRef={contentScrollRef}>
            <RevisionProbe />
            <div ref={contentScrollRef} className="content-scroll">
              <LogbookPage />
            </div>
          </ContentScrollProvider>
        </TaskSelectionProvider>
      </AppEventsProvider>
    </MemoryRouter>
  )
}

function makeDoneTask(params: {
  id: string
  title: string
  completed_at: string
}): TaskListItem {
  const now = params.completed_at
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
    created_at: now,
    updated_at: now,
    completed_at: params.completed_at,
    deleted_at: null,
  }
}

function makeDoneProject(params: {
  id: string
  title: string
  completed_at: string
}): Project {
  const now = params.completed_at
  return {
    id: params.id,
    title: params.title,
    notes: '',
    area_id: null,
    status: 'done',
    scheduled_at: null,
    is_someday: false,
    due_at: null,
    created_at: now,
    updated_at: now,
    completed_at: params.completed_at,
    deleted_at: null,
  }
}

function makeRestoredTask(params: { id: string; title: string; updated_at: string }): Task {
  return {
    id: params.id,
    title: params.title,
    notes: '',
    status: 'open',
    is_inbox: false,
    is_someday: false,
    project_id: null,
    section_id: null,
    area_id: null,
    scheduled_at: null,
    due_at: null,
    created_at: params.updated_at,
    updated_at: params.updated_at,
    completed_at: null,
    deleted_at: null,
  }
}

function makeReopenedProject(params: { id: string; title: string; updated_at: string }): Project {
  return {
    id: params.id,
    title: params.title,
    notes: '',
    area_id: null,
    status: 'open',
    scheduled_at: null,
    is_someday: false,
    due_at: null,
    created_at: params.updated_at,
    updated_at: params.updated_at,
    completed_at: null,
    deleted_at: null,
  }
}

describe('LogbookPage (renderer smoke via mocks)', () => {
  it('renders mixed rows and supports restore/uncheck + project reopen', async () => {
    const user = userEvent.setup()
    const api = (window as unknown as { api: WindowApi }).api

    let tasks: TaskListItem[] = [
      makeDoneTask({ id: 't1', title: 'Done Task', completed_at: '2026-02-17T12:00:00.000Z' }),
    ]
    let projects: Project[] = [
      makeDoneProject({ id: 'p1', title: 'Done Project', completed_at: '2026-02-16T12:00:00.000Z' }),
    ]

    api.task.listLogbook = vi.fn<WindowApi['task']['listLogbook']>(async () => ok(tasks))
    api.project.listDone = vi.fn<WindowApi['project']['listDone']>(async () => ok(projects))

    api.task.toggleDone = vi.fn<WindowApi['task']['toggleDone']>(async (id, done) => {
      if (done) throw new Error('unexpected toggleDone(true) in logbook test')
      tasks = tasks.filter((t) => t.id !== id)
      return ok(makeRestoredTask({ id, title: 'Done Task', updated_at: '2026-02-17T12:01:00.000Z' }))
    })

    api.project.update = vi.fn<WindowApi['project']['update']>(async ({ id, status }) => {
      if (status !== 'open') throw new Error('unexpected project.update status in logbook test')
      projects = projects.filter((p) => p.id !== id)
      return ok(makeReopenedProject({ id, title: 'Done Project', updated_at: '2026-02-17T12:02:00.000Z' }))
    })

    render(<LogbookPageHarness />)

    await screen.findByText('Done Task')
    const projectButton = await screen.findByRole('button', { name: 'Done Project' })

    const revisionEl = screen.getByTestId('revision')
    expect(revisionEl.textContent).toBe('0')

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)
    expect(api.task.toggleDone).toHaveBeenCalledWith('t1', false)
    await waitFor(() => {
      expect(screen.queryByText('Done Task')).toBeNull()
    })

    const projectRow = projectButton.closest<HTMLElement>('li.task-row')
    if (!projectRow) throw new Error('Missing project row')
    const progressBtn = projectRow.querySelector<HTMLButtonElement>('button.project-progress-control')
    if (!progressBtn) throw new Error('Missing project progress control')
    expect(projectButton.contains(progressBtn)).toBe(false)

    await user.click(progressBtn)
    expect(api.project.update).toHaveBeenCalledWith({ id: 'p1', status: 'open' })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Done Project' })).toBeNull()
    })

    await waitFor(() => {
      expect(revisionEl.textContent).toBe('1')
    })
  })
})
