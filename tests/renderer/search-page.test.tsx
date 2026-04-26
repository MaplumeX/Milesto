import { useMemo, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'

import { ok } from '../../shared/result'
import type { WindowApi } from '../../shared/window-api'
import { AppEventsProvider } from '../../src/app/AppEventsContext'
import { SearchPanel } from '../../src/app/SearchPanel'
import type { TaskSelection } from '../../src/features/tasks/TaskSelectionContext'
import { TaskSelectionProvider } from '../../src/features/tasks/TaskSelectionContext'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="search-route-probe">{location.pathname}</div>
}

function SearchPageHarness() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const value: TaskSelection = useMemo(
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
    <AppEventsProvider>
      <MemoryRouter initialEntries={['/today']}>
        <TaskSelectionProvider value={value}>
          <SearchPanel />
          <LocationProbe />
        </TaskSelectionProvider>
      </MemoryRouter>
    </AppEventsProvider>
  )
}

describe('SearchPage (harness)', () => {
  it('searches and allows selecting a result', async () => {
    const user = userEvent.setup()

    const api = (window as unknown as { api: WindowApi }).api
    const searchMock = vi.fn<WindowApi['task']['search']>(
      async () =>
        ok([
          {
            id: 't1',
            title: 'Milk',
            status: 'open',
            is_inbox: false,
            is_someday: false,
            project_id: 'p1',
            project_title: 'Project Alpha',
            section_id: null,
            area_id: null,
            scheduled_at: null,
            due_at: null,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            completed_at: null,
            deleted_at: null,
            snippet: null,
          },
        ])
    )
    api.task.search = searchMock

    render(<SearchPageHarness />)
    act(() => {
      window.dispatchEvent(new Event('milesto:ui.openSearchPanel'))
    })

    const input = await screen.findByPlaceholderText('search.placeholder')
    await user.type(input, ' milk ')

    // SearchPanel debounces before calling window.api.
    await new Promise((r) => setTimeout(r, 200))

    expect(searchMock).toHaveBeenCalledWith('milk', { includeLogbook: false })
    await screen.findByText('Milk')
    expect(screen.getByText('shell.project')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Milk shell.project' }))
    expect(screen.getByTestId('search-route-probe')).toHaveTextContent('/projects/p1')
  })
})
