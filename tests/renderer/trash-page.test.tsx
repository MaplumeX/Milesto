import { useMemo, useRef, useState } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { err, ok } from '../../shared/result'
import type { WindowApi } from '../../shared/window-api'
import type { ViewListItem } from '../../shared/schemas/view-list'

import { AppEventsProvider } from '../../src/app/AppEventsContext'
import { ContentScrollProvider } from '../../src/app/ContentScrollContext'
import type { TaskSelection } from '../../src/features/tasks/TaskSelectionContext'
import { TaskSelectionProvider } from '../../src/features/tasks/TaskSelectionContext'
import { TrashPage } from '../../src/pages/TrashPage'

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

function makeTrashTaskItem(overrides: Partial<ViewListItem> & { id: string }): ViewListItem {
  return {
    kind: 'task',
    id: overrides.id,
    title: overrides.title ?? 'Untitled task',
    notes: overrides.notes ?? '',
    status: overrides.status ?? 'open',
    is_inbox: (overrides as Record<string, unknown>).is_inbox as boolean ?? false,
    is_someday: (overrides as Record<string, unknown>).is_someday as boolean ?? false,
    project_id: (overrides as Record<string, unknown>).project_id as string | null ?? null,
    project_title: (overrides as Record<string, unknown>).project_title as string | null | undefined ?? null,
    section_id: (overrides as Record<string, unknown>).section_id as string | null ?? null,
    area_id: (overrides as Record<string, unknown>).area_id as string | null ?? null,
    scheduled_at: (overrides as Record<string, unknown>).scheduled_at as string | null ?? null,
    due_at: (overrides as Record<string, unknown>).due_at as string | null ?? null,
    created_at: (overrides as Record<string, unknown>).created_at as string ?? '2026-03-16T10:00:00.000Z',
    updated_at: (overrides as Record<string, unknown>).updated_at as string ?? '2026-03-16T12:00:00.000Z',
    completed_at: (overrides as Record<string, unknown>).completed_at as string | null ?? null,
    deleted_at: (overrides as Record<string, unknown>).deleted_at as string | null ?? '2026-03-16T12:00:00.000Z',
    tag_preview: (overrides as Record<string, unknown>).tag_preview as string[] | undefined ?? [],
    tag_count: (overrides as Record<string, unknown>).tag_count as number | undefined ?? 0,
    tag_ids: (overrides as Record<string, unknown>).tag_ids as string[] | undefined ?? [],
    rank: (overrides as Record<string, unknown>).rank as number | null | undefined ?? null,
  }
}

function makeTrashProjectItem(overrides: Partial<ViewListItem> & { id: string }): ViewListItem {
  return {
    kind: 'project',
    id: overrides.id,
    title: overrides.title ?? 'Untitled project',
    notes: overrides.notes ?? '',
    status: (overrides as Record<string, unknown>).status as 'open' | 'done' | 'cancelled' ?? 'open',
    area_id: (overrides as Record<string, unknown>).area_id as string | null ?? null,
    scheduled_at: (overrides as Record<string, unknown>).scheduled_at as string | null ?? null,
    is_someday: (overrides as Record<string, unknown>).is_someday as boolean ?? false,
    due_at: (overrides as Record<string, unknown>).due_at as string | null ?? null,
    created_at: (overrides as Record<string, unknown>).created_at as string ?? '2026-03-16T10:00:00.000Z',
    updated_at: (overrides as Record<string, unknown>).updated_at as string ?? '2026-03-16T11:00:00.000Z',
    completed_at: (overrides as Record<string, unknown>).completed_at as string | null ?? null,
    deleted_at: (overrides as Record<string, unknown>).deleted_at as string | null ?? '2026-03-16T11:00:00.000Z',
    tag_preview: (overrides as Record<string, unknown>).tag_preview as string[] | undefined ?? [],
    tag_count: (overrides as Record<string, unknown>).tag_count as number | undefined ?? 0,
    tag_ids: (overrides as Record<string, unknown>).tag_ids as string[] | undefined ?? [],
    rank: (overrides as Record<string, unknown>).rank as number | null | undefined ?? null,
    total_count: (overrides as Record<string, unknown>).total_count as number ?? 2,
    done_count: (overrides as Record<string, unknown>).done_count as number ?? 0,
  }
}

describe('TrashPage', () => {
  it('renders a mixed list with ViewList, opens deleted tasks inline, and navigates deleted projects with trash scope', async () => {
    const user = userEvent.setup()
    const api = (window as unknown as { api: WindowApi }).api

    const items: ViewListItem[] = [
      makeTrashTaskItem({ id: 'task-1', title: 'Standalone trash task' }),
      makeTrashProjectItem({ id: 'project-1', title: 'Deleted project root', total_count: 2, done_count: 0 }),
    ]

    api.trash.list = vi.fn<WindowApi['trash']['list']>(async () => ok(items))
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

    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).getByText('Standalone trash task')).toBeInTheDocument()
    expect(within(listbox).getByText('Deleted project root')).toBeInTheDocument()

    const taskRow = screen.getByText('Standalone trash task').closest('li')
    if (!taskRow) throw new Error('Missing task trash row')

    await user.click(within(taskRow).getByRole('button', { name: 'Standalone trash task' }))
    expect(taskRow.classList.contains('is-selected')).toBe(true)

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

  it('shows error state from the trash API', async () => {
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
  })
})