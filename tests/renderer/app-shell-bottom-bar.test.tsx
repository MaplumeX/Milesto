import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

function renderAppShell(
  initialEntry: string,
  model: {
    areas: Array<{
      id: string
      title: string
      notes: string
      position: number | null
      created_at: string
      updated_at: string
      deleted_at: string | null
    }>
    openProjects: Array<{
      id: string
      title: string
      notes: string
      area_id: string | null
      status: 'open'
      position: number | null
      scheduled_at: string | null
      is_someday: boolean
      due_at: string | null
      created_at: string
      updated_at: string
      completed_at: string | null
      deleted_at: string | null
    }>
  } = {
    areas: [],
    openProjects: [],
  }
) {
  const api = (window as unknown as { api: WindowApi }).api

  api.sidebar.listModel = vi.fn(async () =>
    ok({
      areas: model.areas.map((area) => ({ ...area })),
      openProjects: model.openProjects.map((project) => ({ ...project })),
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

  it('opens the sidebar area context menu on right click without navigating', async () => {
    renderAppShell('/today', {
      areas: [
        {
          id: 'a1',
          title: 'Area One',
          notes: '',
          position: 1000,
          created_at: '2026-03-17T00:00:00.000Z',
          updated_at: '2026-03-17T00:00:00.000Z',
          deleted_at: null,
        },
      ],
      openProjects: [],
    })

    const areaLabel = await screen.findByText('Area One')
    const areaLink = areaLabel.closest('a')
    expect(areaLink).not.toBeNull()
    if (!areaLink) return
    areaLink.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 80 }))

    expect(await screen.findByRole('button', { name: 'common.rename' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'taskEditor.tagsLabel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.delete' })).toBeInTheDocument()
    expect(screen.getByTestId('bottom-bar-route-probe')).toHaveTextContent('/today')
  })

  it('renames an area inline from the sidebar context menu', async () => {
    const model = {
      areas: [
        {
          id: 'a1',
          title: 'Area One',
          notes: '',
          position: 1000,
          created_at: '2026-03-17T00:00:00.000Z',
          updated_at: '2026-03-17T00:00:00.000Z',
          deleted_at: null,
        },
      ],
      openProjects: [],
    } as const

    const api = (window as unknown as { api: WindowApi }).api
    api.area.update = vi.fn(async ({ id, title }) => {
      const updated = {
        ...model.areas[0],
        id,
        title: title ?? model.areas[0].title,
        updated_at: '2026-03-18T00:00:00.000Z',
      }
      model.areas.splice(0, 1, updated)
      return ok(updated)
    })

    renderAppShell('/today', model)

    const areaLabel = await screen.findByText('Area One')
    const areaLink = areaLabel.closest('a')
    expect(areaLink).not.toBeNull()
    if (!areaLink) return

    areaLink.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 80 }))
    fireEvent.click(await screen.findByRole('button', { name: 'common.rename' }))

    const input = await screen.findByDisplayValue('Area One')
    expect(input).toHaveFocus()
    expect(input).toHaveProperty('selectionStart', 'Area One'.length)
    expect(input).toHaveProperty('selectionEnd', 'Area One'.length)
    expect(screen.getByTestId('bottom-bar-route-probe')).toHaveTextContent('/today')

    fireEvent.change(input, { target: { value: 'Area Renamed' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(api.area.update).toHaveBeenCalledWith({ id: 'a1', title: 'Area Renamed' })
    expect(await screen.findByText('Area Renamed')).toBeInTheDocument()
    expect(screen.getByTestId('bottom-bar-route-probe')).toHaveTextContent('/today')
  })

  it('opens the sidebar project context menu on right click without navigating', async () => {
    renderAppShell('/today', {
      areas: [],
      openProjects: [
        {
          id: 'p1',
          title: 'Project One',
          notes: '',
          area_id: null,
          status: 'open',
          position: 1000,
          scheduled_at: null,
          is_someday: false,
          due_at: null,
          created_at: '2026-03-17T00:00:00.000Z',
          updated_at: '2026-03-17T00:00:00.000Z',
          completed_at: null,
          deleted_at: null,
        },
      ],
    })

    const projectLabel = await screen.findByText('Project One')
    const projectLink = projectLabel.closest('a')
    expect(projectLink).not.toBeNull()
    if (!projectLink) return
    projectLink.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 80 }))

    const menu = await screen.findByRole('dialog', { name: 'aria.projectActions' })
    expect(within(menu).getByRole('button', { name: 'common.plan' })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: 'common.move' })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: 'taskEditor.tagsLabel' })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: 'taskEditor.dueLabel' })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: 'projectPage.markDone' })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: 'project.cancel' })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: 'common.rename' })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: 'common.delete' })).toBeInTheDocument()
    expect(screen.getByTestId('bottom-bar-route-probe')).toHaveTextContent('/today')
  })

  it('renames a project inline from the sidebar context menu', async () => {
    const model = {
      areas: [],
      openProjects: [
        {
          id: 'p1',
          title: 'Project One',
          notes: '',
          area_id: null,
          status: 'open' as const,
          position: 1000,
          scheduled_at: null,
          is_someday: false,
          due_at: null,
          created_at: '2026-03-17T00:00:00.000Z',
          updated_at: '2026-03-17T00:00:00.000Z',
          completed_at: null,
          deleted_at: null,
        },
      ],
    } as const

    const api = (window as unknown as { api: WindowApi }).api
    api.project.update = vi.fn(async ({ id, title }) => {
      const updated = {
        ...model.openProjects[0],
        id,
        title: title ?? model.openProjects[0].title,
        updated_at: '2026-03-18T00:00:00.000Z',
      }
      model.openProjects.splice(0, 1, updated)
      return ok(updated)
    })

    renderAppShell('/today', model)

    const projectLabel = await screen.findByText('Project One')
    const projectLink = projectLabel.closest('a')
    expect(projectLink).not.toBeNull()
    if (!projectLink) return

    projectLink.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 80 })
    )
    fireEvent.click(await screen.findByRole('button', { name: 'common.rename' }))

    const input = await screen.findByDisplayValue('Project One')
    expect(input).toHaveFocus()
    expect(screen.getByTestId('bottom-bar-route-probe')).toHaveTextContent('/today')

    fireEvent.change(input, { target: { value: 'Project Renamed' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(api.project.update).toHaveBeenCalledWith({ id: 'p1', title: 'Project Renamed' })
    expect(await screen.findByText('Project Renamed')).toBeInTheDocument()
    expect(screen.getByTestId('bottom-bar-route-probe')).toHaveTextContent('/today')
  })
})
