import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import type { Area } from '../../shared/schemas/area'
import type { Project } from '../../shared/schemas/project'

import { useAppEvents } from './AppEventsContext'
import { TaskSelectionProvider } from '../features/tasks/TaskSelectionContext'
import { TaskDetailPanel } from '../features/tasks/TaskDetailPanel'
import { CommandPalette } from './CommandPalette'

type SidebarModel = {
  areas: Area[]
  openProjects: Project[]
}

export function AppShell() {
  const { revision, bumpRevision } = useAppEvents()
  const [sidebar, setSidebar] = useState<SidebarModel>({ areas: [], openProjects: [] })
  const [sidebarError, setSidebarError] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

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

  return (
    <TaskSelectionProvider value={{ selectedTaskId, selectTask: setSelectedTaskId }}>
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

          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                const title = prompt('New project title')
                if (!title) return
                void (async () => {
                  const res = await window.api.project.create({ title })
                  if (!res.ok) {
                    alert(`${res.error.code}: ${res.error.message}`)
                    return
                  }
                  bumpRevision()
                })()
              }}
            >
              + Project
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                const title = prompt('New area title')
                if (!title) return
                void (async () => {
                  const res = await window.api.area.create({ title })
                  if (!res.ok) {
                    alert(`${res.error.code}: ${res.error.message}`)
                    return
                  }
                  bumpRevision()
                })()
              }}
            >
              + Area
            </button>
          </div>

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

        <div className="sidebar-bottom">
          <NavItem to="/settings" label="Settings" />
        </div>
        </aside>

        <main className="content" aria-label="Content">
          <div className="content-grid">
            <div className="content-main">
              <Outlet />
            </div>
            <TaskDetailPanel />
          </div>
        </main>

        <CommandPalette />
      </div>
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
