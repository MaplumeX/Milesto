import { useMemo, useRef, useState } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { err, ok } from '../../shared/result'
import type { WindowApi } from '../../shared/window-api'
import type { TrashEntry } from '../../shared/schemas/trash'

import { AppEventsProvider } from '../../src/app/AppEventsContext'
import { ContentScrollProvider } from '../../src/app/ContentScrollContext'
import type { TaskSelection } from '../../src/features/tasks/TaskSelectionContext'
import { TaskSelectionProvider } from '../../src/features/tasks/TaskSelectionContext'
import { TrashPage } from '../../src/pages/TrashPage'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

function TrashPageHarness() {
  const contentScrollRef = useRef<HTMLDivElement | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  const selection: TaskSelection = useMemo(
    () => ({
      selectedTaskId,
      selectTask: (id) => setSelectedTaskId(id),
      openTaskId,
      openTask: async (id) => {
        setSelectedTaskId(id)
        setOpenTaskId(id)
      },
      closeTask: () => setOpenTaskId(null),
      requestCloseTask: async () => true,
      registerOpenEditor: () => {},
    }),
    [openTaskId, selectedTaskId]
  )

  return (
    <MemoryRouter initialEntries={['/trash']}>
      <AppEventsProvider>
        <TaskSelectionProvider value={selection}>
          <ContentScrollProvider scrollRef={contentScrollRef}>
            <div ref={contentScrollRef} className="content-scroll">
              <Routes>
                <Route
                  path="/trash"
                  element={
                    <>
                      <LocationProbe />
                      <TrashPage />
                    </>
                  }
                />
                <Route path="/projects/:projectId" element={<LocationProbe />} />
              </Routes>
            </div>
          </ContentScrollProvider>
        </TaskSelectionProvider>
      </AppEventsProvider>
    </MemoryRouter>
  )
}

afterEach(() => {
  cleanup()
})

describe('TrashPage', () => {
  it('renders an open-first list, opens deleted tasks inline, and navigates deleted projects with trash scope', async () => {
    const user = userEvent.setup()
    const api = (window as unknown as { api: WindowApi }).api

    const entries: TrashEntry[] = [
      {
        kind: 'task',
        id: 'task-1',
        title: 'Standalone trash task',
        deleted_at: '2026-03-16T12:00:00.000Z',
      },
      {
        kind: 'project',
        id: 'project-1',
        title: 'Deleted project root',
        deleted_at: '2026-03-16T11:00:00.000Z',
        open_task_count: 2,
      },
    ]

    api.trash.list = vi.fn<WindowApi['trash']['list']>(async () => ok(entries))
    api.task.getDetail = vi.fn<WindowApi['task']['getDetail']>(async () =>
      ok({
        task: {
          id: 'task-1',
          title: 'Standalone trash task',
          notes: '',
          status: 'open',
          is_inbox: true,
          is_someday: false,
          project_id: null,
          section_id: null,
          area_id: null,
          scheduled_at: null,
          due_at: null,
          created_at: '2026-03-16T10:00:00.000Z',
          updated_at: '2026-03-16T12:00:00.000Z',
          completed_at: null,
          deleted_at: '2026-03-16T12:00:00.000Z',
        },
        tag_ids: [],
        checklist_items: [],
      })
    )
    api.project.listOpen = vi.fn<WindowApi['project']['listOpen']>(async () => ok([]))
    api.tag.list = vi.fn<WindowApi['tag']['list']>(async () => ok([]))
    api.area.list = vi.fn<WindowApi['area']['list']>(async () => ok([]))
    api.task.countProjectsProgress = vi.fn<WindowApi['task']['countProjectsProgress']>(async () => ok([]))

    render(<TrashPageHarness />)

    const listbox = await screen.findByRole('listbox', { name: 'trash.listAria' })
    expect(within(listbox).getByText('Standalone trash task')).toBeInTheDocument()
    expect(within(listbox).getByText('Deleted project root')).toBeInTheDocument()
    expect(screen.queryByText('trash.projectOpenCount')).toBeNull()
    expect(screen.queryByText('trash.taskLabel')).toBeNull()
    expect(screen.queryByText('trash.rootCount')).toBeNull()
    expect(screen.queryByRole('button', { name: 'task.restore' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'trash.purge' })).toBeNull()

    const taskRow = screen.getByText('Standalone trash task').closest('li')
    if (!taskRow) throw new Error('Missing task trash row')

    await user.click(within(taskRow).getByRole('button', { name: 'Standalone trash task' }))
    expect(taskRow.classList.contains('is-selected')).toBe(true)
    expect(screen.queryByLabelText('aria.taskEditor')).toBeNull()

    await user.keyboard('[Enter]')
    expect(api.task.getDetail).toHaveBeenCalledWith('task-1', 'trash')
    await screen.findByLabelText('aria.taskEditor')

    const projectRow = screen.getByText('Deleted project root').closest('li')
    if (!projectRow) throw new Error('Missing project trash row')
    await user.dblClick(within(projectRow).getByRole('button', { name: 'Deleted project root' }))

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/projects/project-1?scope=trash')
    })
  })

  it('shows error and empty states from the trash API', async () => {
    const api = (window as unknown as { api: WindowApi }).api

    api.trash.list = vi.fn<WindowApi['trash']['list']>(async () =>
      err({
        code: 'TRASH_LIST_FAILED',
        message: 'Unable to load trash.',
      })
    )

    render(<TrashPageHarness />)

    await screen.findByText('TRASH_LIST_FAILED')
    expect(screen.getByText('Unable to load trash.')).toBeInTheDocument()
    expect(screen.queryByRole('listbox', { name: 'trash.listAria' })).toBeNull()
  })
})
