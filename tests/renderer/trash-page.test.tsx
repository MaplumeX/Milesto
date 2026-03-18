import { useRef } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { err, ok } from '../../shared/result'
import type { TrashEntry } from '../../shared/schemas/trash'
import type { WindowApi } from '../../shared/window-api'

import { AppEventsProvider } from '../../src/app/AppEventsContext'
import { ContentScrollProvider } from '../../src/app/ContentScrollContext'
import { TrashPage } from '../../src/pages/TrashPage'

function TrashPageHarness() {
  const contentScrollRef = useRef<HTMLDivElement | null>(null)

  return (
    <MemoryRouter>
      <AppEventsProvider>
        <ContentScrollProvider scrollRef={contentScrollRef}>
          <div ref={contentScrollRef} className="content-scroll">
            <TrashPage />
          </div>
        </ContentScrollProvider>
      </AppEventsProvider>
    </MemoryRouter>
  )
}

afterEach(() => {
  cleanup()
})

describe('TrashPage', () => {
  it('renders mixed roots and refreshes after restore, purge, and empty actions', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.fn(() => true)
    Object.defineProperty(window, 'confirm', {
      value: confirmSpy,
      configurable: true,
      writable: true,
    })
    const api = (window as unknown as { api: WindowApi }).api

    let entries: TrashEntry[] = [
      {
        kind: 'task',
        id: 'task-1',
        title: 'Standalone trash task',
        deleted_at: '2026-03-16T12:00:00.000Z',
      },
      {
        kind: 'task',
        id: 'task-2',
        title: 'Trash before empty',
        deleted_at: '2026-03-16T11:30:00.000Z',
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
    api.trash.restoreTask = vi.fn<WindowApi['trash']['restoreTask']>(async (id) => {
      entries = entries.filter((entry) => entry.id !== id)
      return ok({ restored: true })
    })
    api.trash.purgeProject = vi.fn<WindowApi['trash']['purgeProject']>(async (id) => {
      entries = entries.filter((entry) => entry.id !== id)
      return ok({ purged: true })
    })
    api.trash.empty = vi.fn<WindowApi['trash']['empty']>(async () => {
      const purgedCount = entries.length
      entries = []
      return ok({ purged_count: purgedCount })
    })

    render(<TrashPageHarness />)

    const listbox = await screen.findByRole('listbox', { name: 'trash.listAria' })
    expect(within(listbox).getByText('Standalone trash task')).toBeInTheDocument()
    expect(within(listbox).getByText('Deleted project root')).toBeInTheDocument()
    expect(screen.getByText('trash.projectOpenCount')).toBeInTheDocument()

    const taskRow = screen.getByText('Standalone trash task').closest('li')
    if (!taskRow) throw new Error('Missing task trash row')
    await user.click(within(taskRow).getByRole('button', { name: 'task.restore' }))
    expect(api.trash.restoreTask).toHaveBeenCalledWith('task-1')

    await waitFor(() => {
      expect(screen.queryByText('Standalone trash task')).toBeNull()
    })

    const projectRow = screen.getByText('Deleted project root').closest('li')
    if (!projectRow) throw new Error('Missing project trash row')
    await user.click(within(projectRow).getByRole('button', { name: 'trash.purge' }))
    expect(api.trash.purgeProject).toHaveBeenCalledWith('project-1')
    expect(confirmSpy).toHaveBeenCalled()

    await waitFor(() => {
      expect(screen.queryByText('Deleted project root')).toBeNull()
    })

    await user.click(screen.getByRole('button', { name: 'trash.emptyAction' }))
    expect(api.trash.empty).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(screen.getByText('trash.emptyState')).toBeInTheDocument()
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
