import { useMemo, useRef, useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ok } from '../../shared/result'
import type { Tag } from '../../shared/schemas/tag'
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

function makeProjectTags(): Tag[] {
  return [
    {
      id: 'tag-1',
      title: 'Design',
      color: null,
      created_at: '2026-03-20T09:00:00.000Z',
      updated_at: '2026-03-20T09:00:00.000Z',
      deleted_at: null,
    },
    {
      id: 'tag-2',
      title: 'Marketing',
      color: null,
      created_at: '2026-03-20T09:00:00.000Z',
      updated_at: '2026-03-20T09:00:00.000Z',
      deleted_at: null,
    },
    {
      id: 'tag-3',
      title: 'Q2',
      color: null,
      created_at: '2026-03-20T09:00:00.000Z',
      updated_at: '2026-03-20T09:00:00.000Z',
      deleted_at: null,
    },
    {
      id: 'tag-4',
      title: 'Launch',
      color: null,
      created_at: '2026-03-20T09:00:00.000Z',
      updated_at: '2026-03-20T09:00:00.000Z',
      deleted_at: null,
    },
    {
      id: 'tag-5',
      title: 'Hidden Five',
      color: null,
      created_at: '2026-03-20T09:00:00.000Z',
      updated_at: '2026-03-20T09:00:00.000Z',
      deleted_at: null,
    },
    {
      id: 'tag-6',
      title: 'Hidden Six',
      color: null,
      created_at: '2026-03-20T09:00:00.000Z',
      updated_at: '2026-03-20T09:00:00.000Z',
      deleted_at: null,
    },
  ]
}

function setupProjectPageApi(tags: Tag[]) {
  const api = (window as unknown as { api: WindowApi }).api

  api.project.getDetail = vi.fn<WindowApi['project']['getDetail']>(async () =>
    ok({
      project: {
        id: 'project-1',
        title: 'Project Alpha',
        notes: '',
        area_id: 'area-1',
        status: 'open',
        scheduled_at: '2026-03-27',
        is_someday: false,
        due_at: '2026-03-31',
        created_at: '2026-03-18T09:00:00.000Z',
        updated_at: '2026-03-18T09:00:00.000Z',
        completed_at: null,
        deleted_at: null,
      },
      tags,
    })
  )
  api.area.list = vi.fn<WindowApi['area']['list']>(async () =>
    ok([
      {
        id: 'area-1',
        title: 'Design Ops',
        notes: '',
        created_at: '2026-03-18T09:00:00.000Z',
        updated_at: '2026-03-18T09:00:00.000Z',
        deleted_at: null,
      },
    ])
  )
  api.task.listProject = vi.fn<WindowApi['task']['listProject']>(async () => ok([]))
  api.project.listSections = vi.fn<WindowApi['project']['listSections']>(async () => ok([]))
  api.task.countProjectDone = vi.fn<WindowApi['task']['countProjectDone']>(async () => ok({ count: 0 }))
  api.tag.list = vi.fn<WindowApi['tag']['list']>(async () => ok(tags))
  api.project.setTags = vi.fn<WindowApi['project']['setTags']>(async (_projectId, tagIds) =>
    ok({ updated: tagIds.length >= 0 })
  )
}

describe('ProjectPage metadata row', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders tags on a dedicated second row while keeping +N overflow behavior', async () => {
    setupProjectPageApi(makeProjectTags())

    const { container } = render(<ProjectPageHarness />)

    await screen.findByText('Project Alpha')

    const primaryRow = container.querySelector('[data-project-meta-line="primary"]')
    const tagsRow = container.querySelector('[data-project-meta-line="tags"]')
    const planChip = screen.getByText(/taskEditor\.scheduledPrefix/).closest('.task-inline-chip')
    const firstTagChip = screen.getByText('Design').closest('.task-inline-chip')

    expect(screen.getByText('Design')).toBeInTheDocument()
    expect(screen.getByText('Marketing')).toBeInTheDocument()
    expect(screen.getByText('Q2')).toBeInTheDocument()
    expect(screen.getByText('Launch')).toBeInTheDocument()
    expect(screen.queryByText('Hidden Five')).toBeNull()
    expect(screen.queryByText('Hidden Six')).toBeNull()

    const overflowChip = screen.getByText('+2')
    expect(primaryRow).not.toBeNull()
    expect(tagsRow).not.toBeNull()
    expect(primaryRow).toContainElement(planChip)
    expect(tagsRow).toContainElement(firstTagChip)
    expect(tagsRow).toContainElement(overflowChip.closest('button'))
    expect(overflowChip.closest('button')).not.toBeNull()
  })

  it('opens tag management directly from the +N overflow trigger and restores focus on close', async () => {
    const user = userEvent.setup()
    const tags = makeProjectTags()
    const api = (window as unknown as { api: WindowApi }).api

    setupProjectPageApi(tags)

    render(<ProjectPageHarness />)

    await screen.findByText('Project Alpha')

    const overflowChip = screen.getByText('+2').closest('button')
    expect(overflowChip).not.toBeNull()

    await user.click(overflowChip as HTMLButtonElement)

    expect(api.tag.list).toHaveBeenCalledTimes(1)
    expect(await screen.findByPlaceholderText('taskEditor.newTagPlaceholder')).toBeInTheDocument()
    expect(screen.getByText('Hidden Five')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common.move' })).toBeNull()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'aria.projectActions' })).toBeNull()
    })
    expect(overflowChip).toHaveFocus()
  })
})
