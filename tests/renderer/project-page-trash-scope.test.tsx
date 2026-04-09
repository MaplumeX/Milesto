import { useMemo, useRef, useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ok } from '../../shared/result'
import type { WindowApi } from '../../shared/window-api'

import { AppEventsProvider } from '../../src/app/AppEventsContext'
import { ContentScrollProvider } from '../../src/app/ContentScrollContext'
import type { TaskSelection } from '../../src/features/tasks/TaskSelectionContext'
import { TaskSelectionProvider } from '../../src/features/tasks/TaskSelectionContext'
import { ProjectPage } from '../../src/pages/ProjectPage'

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

function ProjectPageHarness() {
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
    <MemoryRouter initialEntries={['/projects/project-1?scope=trash']}>
      <AppEventsProvider>
        <TaskSelectionProvider value={selection}>
          <ContentScrollProvider scrollRef={contentScrollRef}>
            <div ref={contentScrollRef} className="content-scroll">
              <Routes>
                <Route path="/projects/:projectId" element={<ProjectPage />} />
              </Routes>
            </div>
          </ContentScrollProvider>
        </TaskSelectionProvider>
      </AppEventsProvider>
    </MemoryRouter>
  )
}

describe('ProjectPage trash scope', () => {
  it('loads deleted project data through trash-scoped APIs and hides move/delete project actions', async () => {
    const user = userEvent.setup()
    const api = (window as unknown as { api: WindowApi }).api

    api.project.getDetail = vi.fn<WindowApi['project']['getDetail']>(async () =>
      ok({
        project: {
          id: 'project-1',
          title: 'Deleted project root',
          notes: 'Still editable',
          area_id: null,
          status: 'open',
          scheduled_at: null,
          is_someday: false,
          due_at: null,
          created_at: '2026-03-16T09:00:00.000Z',
          updated_at: '2026-03-16T11:00:00.000Z',
          completed_at: null,
          deleted_at: '2026-03-16T11:00:00.000Z',
        },
        tags: [],
      })
    )
    api.area.list = vi.fn<WindowApi['area']['list']>(async () => ok([]))
    api.task.listProject = vi.fn<WindowApi['task']['listProject']>(async () =>
      ok([
        {
          id: 'task-1',
          title: 'Deleted open task',
          status: 'open',
          is_inbox: false,
          is_someday: false,
          project_id: 'project-1',
          project_title: 'Deleted project root',
          section_id: 'section-1',
          area_id: null,
          scheduled_at: null,
          due_at: null,
          created_at: '2026-03-16T09:30:00.000Z',
          updated_at: '2026-03-16T11:00:00.000Z',
          completed_at: null,
          deleted_at: '2026-03-16T11:00:00.000Z',
          rank: 1000,
        },
      ])
    )
    api.project.listSections = vi.fn<WindowApi['project']['listSections']>(async () =>
      ok([
        {
          id: 'section-1',
          project_id: 'project-1',
          title: 'Deleted section',
          position: 1000,
          created_at: '2026-03-16T09:10:00.000Z',
          updated_at: '2026-03-16T11:00:00.000Z',
          deleted_at: '2026-03-16T11:00:00.000Z',
        },
      ])
    )
    api.task.countProjectDone = vi.fn<WindowApi['task']['countProjectDone']>(async () => ok({ count: 1 }))

    render(<ProjectPageHarness />)

    await screen.findByText('Deleted project root')
    expect(api.project.getDetail).toHaveBeenCalledWith('project-1', 'trash')
    expect(api.task.listProject).toHaveBeenCalledWith('project-1', 'trash')
    expect(api.project.listSections).toHaveBeenCalledWith('project-1', 'trash')
    expect(api.task.countProjectDone).toHaveBeenCalledWith('project-1', 'trash')
    expect(await screen.findByText('Deleted open task')).toBeInTheDocument()
    expect(await screen.findByText('Deleted section')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '...' }))
    expect(screen.queryByRole('button', { name: 'common.move' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'common.delete' })).toBeNull()
  })
})
