import { useMemo, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ok } from '../../shared/result'
import type { WindowApi } from '../../shared/window-api'
import type { TaskSelection } from '../../src/features/tasks/TaskSelectionContext'
import { TaskSelectionProvider } from '../../src/features/tasks/TaskSelectionContext'
import { SearchPage } from '../../src/pages/SearchPage'

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
    <TaskSelectionProvider value={value}>
      <SearchPage />
    </TaskSelectionProvider>
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
            is_inbox: true,
            is_someday: false,
            project_id: null,
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

    const input = screen.getByPlaceholderText('search.placeholder')
    await user.type(input, ' milk ')

    // SearchPage debounces before calling window.api.
    await new Promise((r) => setTimeout(r, 200))

    expect(searchMock).toHaveBeenCalledWith('milk', { includeLogbook: false })
    await screen.findByText('Milk')

    await user.click(screen.getByRole('button', { name: 'Milk' }))
    const row = document.querySelector('[data-task-id="t1"]')
    expect(row?.classList.contains('is-selected')).toBe(true)
  })
})
