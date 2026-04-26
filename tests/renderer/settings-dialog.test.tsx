import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

function installPointerCapturePolyfill() {
  const prototype = HTMLElement.prototype as HTMLElement['__proto__'] & {
    hasPointerCapture?: (pointerId: number) => boolean
    setPointerCapture?: (pointerId: number) => void
    releasePointerCapture?: (pointerId: number) => void
  }

  prototype.hasPointerCapture ??= () => false
  prototype.setPointerCapture ??= () => {}
  prototype.releasePointerCapture ??= () => {}
}

describe('Settings dialog', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style')
    delete document.documentElement.dataset.fontSizeStep
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

  it('renders the general settings content with tabs', async () => {
    const user = userEvent.setup()

    renderAppShell('/today')

    await user.click(await screen.findByRole('button', { name: 'nav.settings' }))

    expect(await screen.findByRole('dialog', { name: 'settings.title' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'settings.generalTab' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'settings.syncTab' })).toBeInTheDocument()
    expect(screen.getByLabelText('settings.language')).toBeInTheDocument()
    expect(screen.getByLabelText('settings.fontSize')).toBeInTheDocument()
    expect(screen.getByTestId('settings-font-size-slider')).toHaveValue('0')
    expect(screen.getByText('settings.fontSizeEndpointSmall')).toBeInTheDocument()
    expect(screen.getByText('settings.fontSizeEndpointLarge')).toBeInTheDocument()
    expect(screen.getByText('settings.fontSizeDefaultMarker')).toBeInTheDocument()
    expect(screen.queryByText('100%')).not.toBeInTheDocument()

    const fontSizeRow = screen.getByTestId('settings-font-size-slider').closest('.settings-row')
    expect(fontSizeRow?.querySelector('.settings-row-label .settings-row-description')).toBeNull()
  })

  it('persists font size changes and applies them to the root element immediately', async () => {
    installPointerCapturePolyfill()

    const user = userEvent.setup()
    const api = (window as unknown as { api: WindowApi }).api

    renderAppShell('/today')

    await user.click(await screen.findByRole('button', { name: 'nav.settings' }))

    fireEvent.change(await screen.findByTestId('settings-font-size-slider'), { target: { value: '3' } })

    await waitFor(() => {
      expect(api.settings.setFontSizeStep).toHaveBeenCalledWith(3)
      expect(document.documentElement).toHaveStyle({ fontSize: '15.12px' })
      expect(document.documentElement.dataset.fontSizeStep).toBe('3')
    })
  })
})
