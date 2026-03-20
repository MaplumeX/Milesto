import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { ok } from '../../shared/result'
import type { WindowApi } from '../../shared/window-api'
import { AppEventsProvider } from '../../src/app/AppEventsContext'
import { AppShell } from '../../src/app/AppShell'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="bottom-bar-route-probe">{location.pathname}</div>
}

function renderAppShell(initialEntry: string) {
  const api = (window as unknown as { api: WindowApi }).api

  api.sidebar.listModel = vi.fn(async () =>
    ok({
      areas: [],
      openProjects: [],
    })
  )
  api.task.countProjectsProgress = vi.fn(async () => ok([]))

  return render(
    <AppEventsProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/today" element={<LocationProbe />} />
            <Route path="/areas/:id" element={<LocationProbe />} />
            <Route path="/projects/:id" element={<LocationProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppEventsProvider>
  )
}

function expectIconOnlyButton(name: string) {
  const button = screen.getByRole('button', { name })
  expect(button.textContent).toBe('')
  expect(button.querySelector('svg')).not.toBeNull()
}

describe('AppShell bottom bar', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders area-route bottom-bar actions as icon-only buttons with accessible names', async () => {
    renderAppShell('/areas/a1')

    await screen.findByTestId('bottom-bar-route-probe')

    expectIconOnlyButton('shell.task')
    expectIconOnlyButton('common.addProject')
    expectIconOnlyButton('common.schedule')
    expectIconOnlyButton('common.move')
    expectIconOnlyButton('common.search')

    expect(screen.queryByRole('button', { name: 'shell.section' })).not.toBeInTheDocument()
  })

  it('renders project-route bottom-bar actions as icon-only buttons with accessible names', async () => {
    renderAppShell('/projects/p1')

    await screen.findByTestId('bottom-bar-route-probe')

    expectIconOnlyButton('shell.task')
    expectIconOnlyButton('shell.section')
    expectIconOnlyButton('common.schedule')
    expectIconOnlyButton('common.move')
    expectIconOnlyButton('common.search')

    expect(screen.queryByRole('button', { name: 'common.addProject' })).not.toBeInTheDocument()
  })
})
