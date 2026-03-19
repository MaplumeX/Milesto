import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { ok } from '../../shared/result'
import type { WindowApi } from '../../shared/window-api'
import { AppEventsProvider } from '../../src/app/AppEventsContext'
import { AppShell } from '../../src/app/AppShell'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="settings-route-probe">{location.pathname}</div>
}

function renderAppShell(initialEntry = '/today') {
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
            <Route
              path="/today"
              element={
                <>
                  <button type="button">outside-focus-target</button>
                  <LocationProbe />
                </>
              }
            />
            <Route path="/inbox" element={<LocationProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppEventsProvider>
  )
}

describe('Settings dialog', () => {
  afterEach(() => {
    cleanup()
  })

  it('opens from the sidebar without changing route and closes with Escape while restoring focus', async () => {
    const user = userEvent.setup()

    renderAppShell('/today')

    const trigger = await screen.findByRole('button', { name: 'nav.settings' })
    trigger.focus()

    await user.click(trigger)

    expect(await screen.findByRole('dialog', { name: 'settings.title' })).toBeInTheDocument()
    expect(screen.getByTestId('settings-route-probe')).toHaveTextContent('/today')

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'settings.title' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(screen.getByTestId('settings-route-probe')).toHaveTextContent('/today')
  })

  it('switches between General and Sync tabs inside the dialog', async () => {
    const user = userEvent.setup()

    renderAppShell('/today')

    await user.click(await screen.findByRole('button', { name: 'nav.settings' }))

    expect(await screen.findByRole('tab', { name: 'settings.generalTab' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('settings.language')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'settings.syncTab' }))

    expect(screen.getByRole('tab', { name: 'settings.syncTab' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('settings-sync-panel')).toBeInTheDocument()
    expect(screen.queryByText('settings.language')).not.toBeInTheDocument()
  })
})
