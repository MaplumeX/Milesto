import { useMemo, useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { ok } from '../../shared/result'
import type { ViewListItem, ViewListProjectItem } from '../../shared/schemas/view-list'
import type { WindowApi } from '../../shared/window-api'
import { AppEventsProvider } from '../../src/app/AppEventsContext'
import { ContentScrollProvider } from '../../src/app/ContentScrollContext'
import type { TaskSelection } from '../../src/features/tasks/TaskSelectionContext'
import { TaskSelectionProvider } from '../../src/features/tasks/TaskSelectionContext'
import { ViewList } from '../../src/features/view-list/ViewList'

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

function ViewListHarness({
  items,
  onCompleteProject = async () => {},
}: {
  items: ViewListItem[]
  onCompleteProject?: (project: ViewListProjectItem) => Promise<void>
}) {
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
    <MemoryRouter initialEntries={['/today']}>
      <Routes>
        <Route
          path="/today"
          element={
            <AppEventsProvider>
              <TaskSelectionProvider value={selection}>
                <ContentScrollProvider scrollRef={contentScrollRef}>
                  <div ref={contentScrollRef} className="content-scroll">
                    <ViewList
                      title="Today"
                      items={items}
                      listId="today"
                      onToggleTaskDone={async () => {}}
                      onCompleteProject={onCompleteProject}
                    />
                  </div>
                </ContentScrollProvider>
              </TaskSelectionProvider>
            </AppEventsProvider>
          }
        />
        <Route path="/projects/:projectId" element={<div>Project route</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function makeTask(): ViewListItem {
  return {
    kind: 'task',
    id: 'task-1',
    title: 'Task Alpha',
    status: 'open',
    is_inbox: false,
    is_someday: false,
    project_id: null,
    project_title: null,
    section_id: null,
    area_id: null,
    scheduled_at: '2026-04-24',
    due_at: null,
    created_at: '2026-04-24T00:00:00.000Z',
    updated_at: '2026-04-24T00:00:00.000Z',
    completed_at: null,
    deleted_at: null,
    tag_ids: ['tag-task'],
  }
}

function makeProject(): ViewListProjectItem {
  return {
    kind: 'project',
    id: 'project-1',
    title: 'Launch Plan',
    status: 'open',
    area_id: null,
    scheduled_at: '2026-04-24',
    is_someday: false,
    due_at: null,
    created_at: '2026-04-24T00:00:01.000Z',
    updated_at: '2026-04-24T00:00:01.000Z',
    completed_at: null,
    deleted_at: null,
    tag_ids: ['tag-project'],
    total_count: 2,
    done_count: 1,
  }
}

describe('ViewList', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders tasks and projects in one list and focuses projects on click', async () => {
    render(<ViewListHarness items={[makeTask(), makeProject()]} />)

    await screen.findByText('Task Alpha')
    const projectButton = screen.getByRole('button', { name: 'Launch Plan' })
    fireEvent.click(projectButton)

    expect(screen.queryByText('Project route')).not.toBeInTheDocument()
    expect(projectButton.closest('li')).toHaveClass('is-selected')
  })

  it('opens focused projects on double click', async () => {
    render(<ViewListHarness items={[makeTask(), makeProject()]} />)

    await screen.findByText('Task Alpha')
    const projectButton = screen.getByRole('button', { name: 'Launch Plan' })
    fireEvent.doubleClick(projectButton)

    expect(await screen.findByText('Project route')).toBeInTheDocument()
  })

  it('opens selected projects with Enter', async () => {
    render(<ViewListHarness items={[makeTask(), makeProject()]} />)

    await screen.findByText('Task Alpha')
    const listbox = screen.getByRole('listbox', { name: 'aria.tasks' })
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    fireEvent.keyDown(listbox, { key: 'Enter' })

    expect(await screen.findByText('Project route')).toBeInTheDocument()
  })

  it('activates project completion through the project progress control', async () => {
    const onCompleteProject = vi.fn(async () => {})
    render(<ViewListHarness items={[makeProject()]} onCompleteProject={onCompleteProject} />)

    fireEvent.click(await screen.findByRole('button', { name: 'aria.projectProgressOpen' }))

    expect(onCompleteProject).toHaveBeenCalledWith(expect.objectContaining({ id: 'project-1' }))
  })

  it('persists keyboard reordering with task and project item identities', async () => {
    const api = (window as unknown as { api: WindowApi }).api
    api.view.reorderBatch = vi.fn<WindowApi['view']['reorderBatch']>(async () => ok({ reordered: true }))

    render(<ViewListHarness items={[makeTask(), makeProject()]} />)

    await screen.findByRole('button', { name: 'Launch Plan' })
    const listbox = screen.getByRole('listbox', { name: 'aria.tasks' })
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    fireEvent.keyDown(listbox, {
      key: 'ArrowUp',
      ctrlKey: true,
      shiftKey: true,
    })

    await waitFor(() => {
      expect(api.view.reorderBatch).toHaveBeenCalledWith('today', [
        { kind: 'project', id: 'project-1' },
        { kind: 'task', id: 'task-1' },
      ])
    })
  })
})
