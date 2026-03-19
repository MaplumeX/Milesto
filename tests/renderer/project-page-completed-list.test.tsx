import { useMemo, useRef, useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
    <MemoryRouter initialEntries={['/projects/project-1']}>
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

describe('ProjectPage completed list', () => {
  it('keeps completed tasks flat and shows the section name in the task affiliation line', async () => {
    const user = userEvent.setup()
    const api = (window as unknown as { api: WindowApi }).api

    api.project.getDetail = vi.fn<WindowApi['project']['getDetail']>(async () =>
      ok({
        project: {
          id: 'project-1',
          title: 'Project Alpha',
          notes: '',
          area_id: null,
          status: 'open',
          scheduled_at: null,
          is_someday: false,
          due_at: null,
          created_at: '2026-03-18T09:00:00.000Z',
          updated_at: '2026-03-18T09:00:00.000Z',
          completed_at: null,
          deleted_at: null,
        },
        tags: [],
      })
    )
    api.area.list = vi.fn<WindowApi['area']['list']>(async () => ok([]))
    api.task.listProject = vi.fn<WindowApi['task']['listProject']>(async () => ok([]))
    api.project.listSections = vi.fn<WindowApi['project']['listSections']>(async () =>
      ok([
        {
          id: 'section-1',
          project_id: 'project-1',
          title: 'Section Alpha',
          position: 1000,
          created_at: '2026-03-18T09:00:00.000Z',
          updated_at: '2026-03-18T09:00:00.000Z',
          deleted_at: null,
        },
      ])
    )
    api.task.countProjectDone = vi.fn<WindowApi['task']['countProjectDone']>(async () => ok({ count: 1 }))
    api.task.listProjectDone = vi.fn<WindowApi['task']['listProjectDone']>(async () =>
      ok([
        {
          id: 'done-1',
          title: 'Completed task in section',
          status: 'done',
          is_inbox: false,
          is_someday: false,
          project_id: 'project-1',
          project_title: 'Project Alpha',
          section_id: 'section-1',
          area_id: null,
          scheduled_at: null,
          due_at: null,
          created_at: '2026-03-18T09:10:00.000Z',
          updated_at: '2026-03-18T09:30:00.000Z',
          completed_at: '2026-03-18T09:40:00.000Z',
          deleted_at: null,
          rank: 1000,
        },
      ])
    )

    const { container } = render(<ProjectPageHarness />)

    await screen.findByText('Project Alpha')
    expect(container.querySelector('.page[data-page="project"]')).not.toBeNull()
    const headerCountBeforeExpand = container.querySelectorAll('.project-group-header').length

    await user.click(screen.getByRole('button', { name: /projectPage\.completed/ }))

    const taskTitle = await screen.findByText('Completed task in section')
    const taskRow = taskTitle.closest('.task-row')

    expect(taskRow).not.toBeNull()
    expect(within(taskRow as HTMLElement).getByText('Section Alpha')).toBeInTheDocument()
    expect(container.querySelectorAll('.project-group-header')).toHaveLength(headerCountBeforeExpand)
  })
})
