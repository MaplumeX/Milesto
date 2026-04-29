import { useMemo, useRef, useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import { ok, type Result } from '../../shared/result'
import type { Area } from '../../shared/schemas/area'
import type { Project } from '../../shared/schemas/project'
import type { WindowApi } from '../../shared/window-api'
import { AppEventsProvider } from '../../src/app/AppEventsContext'
import { ContentScrollProvider } from '../../src/app/ContentScrollContext'
import type { TaskSelection } from '../../src/features/tasks/TaskSelectionContext'
import { TaskSelectionProvider } from '../../src/features/tasks/TaskSelectionContext'
import { AreaPage } from '../../src/pages/AreaPage'
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

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="route-probe">{`${location.pathname}${location.search}`}</div>
}

function PageHarness({ initialEntry, children }: { initialEntry: string; children: React.ReactNode }) {
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
    <>
      <button type="button">External focus owner</button>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppEventsProvider>
          <TaskSelectionProvider value={selection}>
            <ContentScrollProvider scrollRef={contentScrollRef}>
              <div ref={contentScrollRef} className="content-scroll">
                {children}
              </div>
            </ContentScrollProvider>
          </TaskSelectionProvider>
        </AppEventsProvider>
      </MemoryRouter>
    </>
  )
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    title: '',
    notes: '',
    area_id: null,
    status: 'open',
    position: 1000,
    scheduled_at: null,
    is_someday: false,
    due_at: null,
    created_at: '2026-04-29T00:00:00.000Z',
    updated_at: '2026-04-29T00:00:00.000Z',
    completed_at: null,
    deleted_at: null,
    ...overrides,
  }
}

function makeArea(overrides: Partial<Area> = {}): Area {
  return {
    id: 'area-1',
    title: '',
    notes: '',
    position: 1000,
    created_at: '2026-04-29T00:00:00.000Z',
    updated_at: '2026-04-29T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

function ProjectSwitchControls() {
  const navigate = useNavigate()
  return (
    <>
      <button type="button" onClick={() => navigate('/projects/project-1')}>
        Go project 1
      </button>
      <button type="button" onClick={() => navigate('/projects/project-2')}>
        Go project 2
      </button>
    </>
  )
}

function AreaSwitchControls() {
  const navigate = useNavigate()
  return (
    <>
      <button type="button" onClick={() => navigate('/areas/area-1')}>
        Go area 1
      </button>
      <button type="button" onClick={() => navigate('/areas/area-2')}>
        Go area 2
      </button>
    </>
  )
}

function ProjectEditIntentControls() {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate('/projects/project-1?editTitle=1')}>
      Edit current project title
    </button>
  )
}

describe('page title edit trigger', () => {
  afterEach(() => {
    cleanup()
  })

  it('focuses the new project title input even when another element is focused while data loads', async () => {
    const api = (window as unknown as { api: WindowApi }).api
    const detail = createDeferred<Result<{ project: Project; tags: [] }>>()

    api.project.getDetail = vi.fn<WindowApi['project']['getDetail']>(async () => detail.promise)
    api.area.list = vi.fn<WindowApi['area']['list']>(async () => ok([]))
    api.task.listProject = vi.fn<WindowApi['task']['listProject']>(async () => ok([]))
    api.project.listSections = vi.fn<WindowApi['project']['listSections']>(async () => ok([]))
    api.task.countProjectDone = vi.fn<WindowApi['task']['countProjectDone']>(async () => ok({ count: 0 }))
    api.project.update = vi.fn<WindowApi['project']['update']>(async (patch) => ok({ ...makeProject(), ...patch }))

    render(
      <PageHarness initialEntry="/projects/project-1?editTitle=1">
        <Routes>
          <Route
            path="/projects/:projectId"
            element={
              <>
                <LocationProbe />
                <ProjectPage />
              </>
            }
          />
        </Routes>
      </PageHarness>
    )

    const external = screen.getByRole('button', { name: 'External focus owner' })
    external.focus()
    fireEvent.pointerDown(external)

    detail.resolve(ok({ project: makeProject(), tags: [] }))

    const input = await screen.findByRole('textbox', { name: 'aria.projectTitle' })
    await waitFor(() => expect(input).toHaveFocus())
    expect(screen.getByTestId('route-probe')).toHaveTextContent('/projects/project-1')
  })

  it('does not steal project focus when the destination page receives interaction before data loads', async () => {
    const api = (window as unknown as { api: WindowApi }).api
    const detail = createDeferred<Result<{ project: Project; tags: [] }>>()

    api.project.getDetail = vi.fn<WindowApi['project']['getDetail']>(async () => detail.promise)
    api.area.list = vi.fn<WindowApi['area']['list']>(async () => ok([]))
    api.task.listProject = vi.fn<WindowApi['task']['listProject']>(async () => ok([]))
    api.project.listSections = vi.fn<WindowApi['project']['listSections']>(async () => ok([]))
    api.task.countProjectDone = vi.fn<WindowApi['task']['countProjectDone']>(async () => ok({ count: 0 }))
    api.project.update = vi.fn<WindowApi['project']['update']>(async (patch) => ok({ ...makeProject(), ...patch }))

    render(
      <PageHarness initialEntry="/projects/project-1?editTitle=1">
        <Routes>
          <Route
            path="/projects/:projectId"
            element={
              <>
                <LocationProbe />
                <ProjectPage />
              </>
            }
          />
        </Routes>
      </PageHarness>
    )

    const pageAction = screen.getByRole('button', { name: '...' })
    pageAction.focus()
    fireEvent.pointerDown(pageAction)

    detail.resolve(ok({ project: makeProject(), tags: [] }))

    expect(await screen.findByRole('button', { name: 'project.untitled' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'aria.projectTitle' })).not.toBeInTheDocument()
    expect(screen.getByTestId('route-probe')).toHaveTextContent('/projects/project-1')
  })

  it('focuses the new area title input even when another element is focused while data loads', async () => {
    const api = (window as unknown as { api: WindowApi }).api
    const detail = createDeferred<Result<{ area: Area; tags: [] }>>()

    api.area.getDetail = vi.fn<WindowApi['area']['getDetail']>(async () => detail.promise)
    api.project.listOpenByArea = vi.fn<WindowApi['project']['listOpenByArea']>(async () => ok([]))
    api.task.listArea = vi.fn<WindowApi['task']['listArea']>(async () => ok([]))
    api.area.update = vi.fn<WindowApi['area']['update']>(async (patch) => ok({ ...makeArea(), ...patch }))

    render(
      <PageHarness initialEntry="/areas/area-1?editTitle=1">
        <Routes>
          <Route
            path="/areas/:areaId"
            element={
              <>
                <LocationProbe />
                <AreaPage />
              </>
            }
          />
        </Routes>
      </PageHarness>
    )

    const external = screen.getByRole('button', { name: 'External focus owner' })
    external.focus()
    fireEvent.pointerDown(external)

    detail.resolve(ok({ area: makeArea(), tags: [] }))

    const input = await screen.findByRole('textbox', { name: 'shell.areaTitlePlaceholder' })
    await waitFor(() => expect(input).toHaveFocus())
    expect(screen.getByTestId('route-probe')).toHaveTextContent('/areas/area-1')
  })

  it('does not steal area focus when the destination page receives interaction before data loads', async () => {
    const api = (window as unknown as { api: WindowApi }).api
    const detail = createDeferred<Result<{ area: Area; tags: [] }>>()

    api.area.getDetail = vi.fn<WindowApi['area']['getDetail']>(async () => detail.promise)
    api.project.listOpenByArea = vi.fn<WindowApi['project']['listOpenByArea']>(async () => ok([]))
    api.task.listArea = vi.fn<WindowApi['task']['listArea']>(async () => ok([]))
    api.area.update = vi.fn<WindowApi['area']['update']>(async (patch) => ok({ ...makeArea(), ...patch }))

    render(
      <PageHarness initialEntry="/areas/area-1?editTitle=1">
        <Routes>
          <Route
            path="/areas/:areaId"
            element={
              <>
                <LocationProbe />
                <AreaPage />
              </>
            }
          />
        </Routes>
      </PageHarness>
    )

    const pageAction = screen.getByRole('button', { name: 'aria.areaActions' })
    pageAction.focus()
    fireEvent.pointerDown(pageAction)

    detail.resolve(ok({ area: makeArea(), tags: [] }))

    expect(await screen.findByRole('button', { name: 'area.untitled' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'shell.areaTitlePlaceholder' })).not.toBeInTheDocument()
    expect(screen.getByTestId('route-probe')).toHaveTextContent('/areas/area-1')
  })

  it('treats repeated project editTitle navigation on the same route as a new intent', async () => {
    const api = (window as unknown as { api: WindowApi }).api

    api.project.getDetail = vi.fn<WindowApi['project']['getDetail']>(async () =>
      ok({
        project: makeProject({ title: 'Project One' }),
        tags: [],
      })
    )
    api.area.list = vi.fn<WindowApi['area']['list']>(async () => ok([]))
    api.task.listProject = vi.fn<WindowApi['task']['listProject']>(async () => ok([]))
    api.project.listSections = vi.fn<WindowApi['project']['listSections']>(async () => ok([]))
    api.task.countProjectDone = vi.fn<WindowApi['task']['countProjectDone']>(async () => ok({ count: 0 }))
    api.project.update = vi.fn<WindowApi['project']['update']>(async (patch) => ok({ ...makeProject(), ...patch }))

    render(
      <PageHarness initialEntry="/projects/project-1?editTitle=1">
        <ProjectEditIntentControls />
        <Routes>
          <Route
            path="/projects/:projectId"
            element={
              <>
                <LocationProbe />
                <ProjectPage />
              </>
            }
          />
        </Routes>
      </PageHarness>
    )

    const firstInput = await screen.findByRole('textbox', { name: 'aria.projectTitle' })
    fireEvent.keyDown(firstInput, { key: 'Escape' })
    expect(await screen.findByRole('button', { name: 'Project One' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit current project title' }))

    const secondInput = await screen.findByRole('textbox', { name: 'aria.projectTitle' })
    expect(secondInput).toHaveValue('Project One')
    await waitFor(() => expect(secondInput).toHaveFocus())
    expect(screen.getByTestId('route-probe')).toHaveTextContent('/projects/project-1')
  })

  it('enters project title editing after switching between project routes', async () => {
    const api = (window as unknown as { api: WindowApi }).api

    api.project.getDetail = vi.fn<WindowApi['project']['getDetail']>(async (projectId) =>
      ok({
        project: makeProject({
          id: projectId,
          title: projectId === 'project-1' ? 'Project One' : 'Project Two',
        }),
        tags: [],
      })
    )
    api.area.list = vi.fn<WindowApi['area']['list']>(async () => ok([]))
    api.task.listProject = vi.fn<WindowApi['task']['listProject']>(async () => ok([]))
    api.project.listSections = vi.fn<WindowApi['project']['listSections']>(async () => ok([]))
    api.task.countProjectDone = vi.fn<WindowApi['task']['countProjectDone']>(async () => ok({ count: 0 }))
    api.project.update = vi.fn<WindowApi['project']['update']>(async (patch) => ok({ ...makeProject(), ...patch }))

    render(
      <PageHarness initialEntry="/projects/project-1">
        <ProjectSwitchControls />
        <Routes>
          <Route
            path="/projects/:projectId"
            element={
              <>
                <LocationProbe />
                <ProjectPage />
              </>
            }
          />
        </Routes>
      </PageHarness>
    )

    expect(await screen.findByRole('button', { name: 'Project One' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go project 2' }))

    const titleButton = await screen.findByRole('button', { name: 'Project Two' })
    fireEvent.click(titleButton)

    const input = await screen.findByRole('textbox', { name: 'aria.projectTitle' })
    expect(input).toHaveValue('Project Two')
    await waitFor(() => expect(input).toHaveFocus())
    expect(screen.getByTestId('route-probe')).toHaveTextContent('/projects/project-2')
  })

  it('enters area title editing after switching between area routes', async () => {
    const api = (window as unknown as { api: WindowApi }).api

    api.area.getDetail = vi.fn<WindowApi['area']['getDetail']>(async (areaId) =>
      ok({
        area: makeArea({
          id: areaId,
          title: areaId === 'area-1' ? 'Area One' : 'Area Two',
        }),
        tags: [],
      })
    )
    api.project.listOpenByArea = vi.fn<WindowApi['project']['listOpenByArea']>(async () => ok([]))
    api.task.listArea = vi.fn<WindowApi['task']['listArea']>(async () => ok([]))
    api.area.update = vi.fn<WindowApi['area']['update']>(async (patch) => ok({ ...makeArea(), ...patch }))

    render(
      <PageHarness initialEntry="/areas/area-1">
        <AreaSwitchControls />
        <Routes>
          <Route
            path="/areas/:areaId"
            element={
              <>
                <LocationProbe />
                <AreaPage />
              </>
            }
          />
        </Routes>
      </PageHarness>
    )

    expect(await screen.findByRole('button', { name: 'Area One' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go area 2' }))

    const titleButton = await screen.findByRole('button', { name: 'Area Two' })
    fireEvent.click(titleButton)

    const input = await screen.findByRole('textbox', { name: 'shell.areaTitlePlaceholder' })
    expect(input).toHaveValue('Area Two')
    await waitFor(() => expect(input).toHaveFocus())
    expect(screen.getByTestId('route-probe')).toHaveTextContent('/areas/area-2')
  })
})
