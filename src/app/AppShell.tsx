import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import type { Area } from '../../shared/schemas/area'
import type { Project } from '../../shared/schemas/project'

import { useAppEvents } from './AppEventsContext'
import { ContentScrollProvider } from './ContentScrollContext'
import { type OpenEditorHandle, TaskSelectionProvider } from '../features/tasks/TaskSelectionContext'
import { CommandPalette } from './CommandPalette'
import { formatLocalDate } from '../lib/dates'

const PROJECT_CREATE_SECTION_EVENT = 'milesto:project.createSection'

type SidebarModel = {
  areas: Area[]
  openProjects: Project[]
}

export function AppShell() {
  const { revision, bumpRevision } = useAppEvents()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebar, setSidebar] = useState<SidebarModel>({ areas: [], openProjects: [] })
  const [sidebarError, setSidebarError] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [createMode, setCreateMode] = useState<'project' | 'area' | null>(null)
  const [createTitle, setCreateTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const projectIdFromRoute = useMemo(() => {
    const match = location.pathname.match(/^\/projects\/([^/]+)$/)
    return match?.[1] ?? null
  }, [location.pathname])

  const contentScrollRef = useRef<HTMLDivElement | null>(null)

  const lastFocusTargetRef = useRef<{ element: HTMLElement | null; taskId: string } | null>(null)
  const openEditorHandleRef = useRef<OpenEditorHandle | null>(null)

  const registerOpenEditor = useCallback((handle: OpenEditorHandle | null) => {
    openEditorHandleRef.current = handle
  }, [])

  const openTask = useCallback(
    async (taskId: string) => {
      // When switching between tasks, flush current draft first to avoid data loss.
      if (openTaskId && openTaskId !== taskId) {
        const handle = openEditorHandleRef.current
        if (!handle || handle.taskId !== openTaskId) return
        const ok = await handle.flushPendingChanges()
        if (!ok) {
          handle.focusLastErrorTarget()
          return
        }
        bumpRevision()
      }

      lastFocusTargetRef.current = {
        element: document.activeElement instanceof HTMLElement ? document.activeElement : null,
        taskId,
      }
      setSelectedTaskId(taskId)
      setOpenTaskId(taskId)
    },
    [bumpRevision, openTaskId]
  )

  const closeTask = useCallback(() => {
    if (!openTaskId) return
    setOpenTaskId(null)
    bumpRevision()
  }, [bumpRevision, openTaskId])

  useEffect(() => {
    if (openTaskId !== null) return
    const last = lastFocusTargetRef.current
    if (!last) return

    // Wait for overlay unmount.
    const handle = setTimeout(() => {
      const selector = `[data-task-focus-target="true"][data-task-id="${last.taskId}"]`
      const fallback = document.querySelector<HTMLElement>(selector)
      if (fallback) {
        fallback.focus()
        return
      }

      if (last.element && last.element.isConnected) {
        last.element.focus()
      }
    }, 0)

    return () => clearTimeout(handle)
  }, [openTaskId])

  async function handleAddTask() {
    // Task titles can be empty strings; we want a new task to start blank.
    const emptyTitle = ''
    const today = formatLocalDate(new Date())

    const path = location.pathname

    let input:
      | { title: string; base_list: 'inbox' | 'anytime' | 'someday'; scheduled_at?: string | null; project_id?: string | null; area_id?: string | null }
      | { title: string; base_list: 'inbox' | 'anytime' | 'someday' } = {
      title: emptyTitle,
      base_list: 'inbox',
    }

    let shouldNavigateTo: string | null = null

    const projectMatch = path.match(/^\/projects\/([^/]+)$/)
    const areaMatch = path.match(/^\/areas\/([^/]+)$/)

    if (path === '/inbox') {
      input = { title: emptyTitle, base_list: 'inbox' }
    } else if (path === '/anytime') {
      input = { title: emptyTitle, base_list: 'anytime' }
    } else if (path === '/someday') {
      input = { title: emptyTitle, base_list: 'someday' }
    } else if (path === '/today') {
      input = { title: emptyTitle, base_list: 'anytime', scheduled_at: today }
    } else if (projectMatch) {
      input = { title: emptyTitle, base_list: 'anytime', project_id: projectMatch[1] ?? null }
    } else if (areaMatch) {
      input = { title: emptyTitle, base_list: 'anytime', area_id: areaMatch[1] ?? null }
    } else {
      // Non-task-focused pages: create in Inbox and navigate there.
      input = { title: emptyTitle, base_list: 'inbox' }
      shouldNavigateTo = '/inbox'
    }

    const res = await window.api.task.create(input)
    if (!res.ok) {
      setSidebarError(`${res.error.code}: ${res.error.message}`)
      return
    }

    bumpRevision()
    await openTask(res.data.id)
    if (shouldNavigateTo) navigate(shouldNavigateTo)
  }

  function handleAddSection() {
    const projectId = projectIdFromRoute
    if (!projectId) return
    window.dispatchEvent(new CustomEvent(PROJECT_CREATE_SECTION_EVENT, { detail: { projectId } }))
  }

  const refreshSidebar = useCallback(async () => {
    const [areasRes, projectsRes] = await Promise.all([
      window.api.area.list(),
      window.api.project.listOpen(),
    ])

    if (!areasRes.ok) {
      setSidebarError(`${areasRes.error.code}: ${areasRes.error.message}`)
      return
    }
    if (!projectsRes.ok) {
      setSidebarError(`${projectsRes.error.code}: ${projectsRes.error.message}`)
      return
    }

    setSidebarError(null)
    setSidebar({ areas: areasRes.data, openProjects: projectsRes.data })
  }, [])

  useEffect(() => {
    // Trigger sidebar reload after cross-view mutations.
    void revision
    void refreshSidebar()
  }, [refreshSidebar, revision])

  const unassignedProjects = useMemo(
    () => sidebar.openProjects.filter((p) => !p.area_id),
    [sidebar.openProjects]
  )

  const projectsByArea = useMemo(() => {
    const map = new Map<string, Project[]>()
    for (const project of sidebar.openProjects) {
      if (!project.area_id) continue
      const list = map.get(project.area_id) ?? []
      list.push(project)
      map.set(project.area_id, list)
    }
    return map
  }, [sidebar.openProjects])

  async function handleCreate() {
    const title = createTitle.trim()
    if (!title || !createMode) return

    setIsCreating(true)
    try {
      if (createMode === 'project') {
        const res = await window.api.project.create({ title })
        if (!res.ok) {
          setSidebarError(`${res.error.code}: ${res.error.message}`)
          return
        }
      }

      if (createMode === 'area') {
        const res = await window.api.area.create({ title })
        if (!res.ok) {
          setSidebarError(`${res.error.code}: ${res.error.message}`)
          return
        }
      }

      setCreateMode(null)
      setCreateTitle('')
      bumpRevision()
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <TaskSelectionProvider
      value={{
        selectedTaskId,
        selectTask: setSelectedTaskId,
        openTaskId,
        openTask,
        closeTask,
        registerOpenEditor,
      }}
    >
      <ContentScrollProvider scrollRef={contentScrollRef}>
      <div className="app-shell">
        <aside className="sidebar" aria-label="Sidebar">
        <div className="sidebar-top">
          <div className="app-title">Milesto</div>
        </div>

        <nav className="nav" aria-label="Main navigation">
          <NavItem to="/inbox" label="Inbox" />
          <NavItem to="/today" label="Today" />
          <NavItem to="/upcoming" label="Upcoming" />
          <NavItem to="/anytime" label="Anytime" />
          <NavItem to="/someday" label="Someday" />

          <div className="nav-sep" />
          <NavItem to="/logbook" label="Logbook" />

          <div className="nav-sep" />
          <div className="nav-section-title">Projects</div>

          {sidebarError ? <div className="sidebar-error">{sidebarError}</div> : null}

          {unassignedProjects.map((p) => (
            <NavItem key={p.id} to={`/projects/${p.id}`} label={p.title} />
          ))}

          {sidebar.areas.map((area) => (
            <div key={area.id} className="nav-area">
              <NavLink className="nav-area-title" to={`/areas/${area.id}`}>
                {area.title}
              </NavLink>
              {(projectsByArea.get(area.id) ?? []).map((p) => (
                <NavItem key={p.id} to={`/projects/${p.id}`} label={p.title} indent />
              ))}
              {(projectsByArea.get(area.id) ?? []).length === 0 ? (
                <div className="nav-muted" aria-hidden="true">
                  (empty)
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        {createMode ? (
          <div className="sidebar-create">
            <div className="create-toggle">
              <button
                type="button"
                className={`create-toggle-item${createMode === 'project' ? ' is-active' : ''}`}
                onClick={() => setCreateMode('project')}
              >
                Project
              </button>
              <button
                type="button"
                className={`create-toggle-item${createMode === 'area' ? ' is-active' : ''}`}
                onClick={() => setCreateMode('area')}
              >
                Area
              </button>
            </div>

            <input
              className="input"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder={createMode === 'project' ? 'Project title…' : 'Area title…'}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setCreateMode(null)
                  setCreateTitle('')
                }
                if (e.key === 'Enter') {
                  void handleCreate()
                }
              }}
              disabled={isCreating}
            />

            <div className="row" style={{ justifyContent: 'flex-start' }}>
              <button
                type="button"
                className="button"
                onClick={() => void handleCreate()}
                disabled={isCreating}
              >
                Create
              </button>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  setCreateMode(null)
                  setCreateTitle('')
                }}
                disabled={isCreating}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="sidebar-bottom">
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              setCreateMode((m) => (m ? null : 'project'))
              setCreateTitle('')
            }}
          >
            + New
          </button>

          <NavItem to="/settings" label="Settings" />
        </div>
      </aside>

        <main className="content" aria-label="Content">
          <div className="content-grid">
            <div className="content-main">
              <div ref={contentScrollRef} className="content-scroll">
                <Outlet />
              </div>

                <div className="content-bottom-bar">
                  <div className="content-bottom-left">
                    <button type="button" className="button button-ghost" onClick={() => void handleAddTask()}>
                      + Task
                    </button>
                    {projectIdFromRoute ? (
                      <button type="button" className="button button-ghost" onClick={handleAddSection}>
                        + Section
                      </button>
                    ) : null}
                    <span className="content-bottom-hint">Cmd/Ctrl + K</span>
                  </div>
                  <div className="content-bottom-right">Local, offline</div>
                </div>
            </div>
          </div>
        </main>

        <CommandPalette />
      </div>
      </ContentScrollProvider>
    </TaskSelectionProvider>
  )
}

function NavItem({
  to,
  label,
  indent,
}: {
  to: string
  label: string
  indent?: boolean
}) {
  return (
    <NavLink
      className={({ isActive }) =>
        `nav-item${isActive ? ' is-active' : ''}${indent ? ' is-indent' : ''}`
      }
      to={to}
    >
      {label}
    </NavLink>
  )
}
