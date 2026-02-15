import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS as DndCss } from '@dnd-kit/utilities'

import type { Area } from '../../shared/schemas/area'
import type { Project } from '../../shared/schemas/project'

import { useAppEvents } from './AppEventsContext'
import { ContentScrollProvider } from './ContentScrollContext'
import { type OpenEditorHandle, TaskSelectionProvider } from '../features/tasks/TaskSelectionContext'
import { ProjectProgressControl } from '../features/projects/ProjectProgressControl'
import { SearchPanel } from './SearchPanel'
import { ContentBottomBarActions } from './ContentBottomBarActions'
import { formatLocalDate } from '../lib/dates'
import {
  getTaskDropAnimationConfig,
  getTaskDropAnimationDurationMs,
  usePrefersReducedMotion,
} from '../features/tasks/dnd-drop-animation'

const PROJECT_CREATE_SECTION_EVENT = 'milesto:project.createSection'

type ContainerId = string
const SIDEBAR_UNASSIGNED_CONTAINER_ID: ContainerId = 'sidebar:unassigned'
const SIDEBAR_AREA_CONTAINER_PREFIX = 'sidebar:area:'
const SIDEBAR_TAIL_ID_PREFIX = 'sidebar-tail:'
const AREA_DRAG_ID_PREFIX = 'area:'
const PROJECT_DRAG_ID_PREFIX = 'project:'

function sidebarAreaContainerId(areaId: string): ContainerId {
  return `${SIDEBAR_AREA_CONTAINER_PREFIX}${areaId}`
}

function sidebarTailIdFromContainerId(containerId: ContainerId): string {
  return `${SIDEBAR_TAIL_ID_PREFIX}${containerId}`
}

function isSidebarTailId(id: string): boolean {
  return id.startsWith(SIDEBAR_TAIL_ID_PREFIX)
}

function containerIdFromSidebarTailId(id: string): ContainerId | null {
  if (!isSidebarTailId(id)) return null
  const containerId = id.slice(SIDEBAR_TAIL_ID_PREFIX.length)
  return containerId || null
}

function isSidebarContainerId(id: string): boolean {
  return id === SIDEBAR_UNASSIGNED_CONTAINER_ID || id.startsWith(SIDEBAR_AREA_CONTAINER_PREFIX)
}

function areaIdFromSidebarContainerId(containerId: ContainerId): string | null {
  if (containerId === SIDEBAR_UNASSIGNED_CONTAINER_ID) return null
  if (!containerId.startsWith(SIDEBAR_AREA_CONTAINER_PREFIX)) return null
  const areaId = containerId.slice(SIDEBAR_AREA_CONTAINER_PREFIX.length)
  return areaId || null
}

function areaDragId(areaId: string): string {
  return `${AREA_DRAG_ID_PREFIX}${areaId}`
}

function projectDragId(projectId: string): string {
  return `${PROJECT_DRAG_ID_PREFIX}${projectId}`
}

function isAreaDragId(id: string): boolean {
  return id.startsWith(AREA_DRAG_ID_PREFIX)
}

function isProjectDragId(id: string): boolean {
  return id.startsWith(PROJECT_DRAG_ID_PREFIX)
}

function areaIdFromAreaDragId(id: string): string | null {
  if (!isAreaDragId(id)) return null
  const areaId = id.slice(AREA_DRAG_ID_PREFIX.length)
  return areaId || null
}

function projectIdFromProjectDragId(id: string): string | null {
  if (!isProjectDragId(id)) return null
  const projectId = id.slice(PROJECT_DRAG_ID_PREFIX.length)
  return projectId || null
}

function cloneItemsByContainer(m: Record<ContainerId, string[]>): Record<ContainerId, string[]> {
  const out: Record<ContainerId, string[]> = {}
  for (const [k, v] of Object.entries(m)) out[k] = [...v]
  return out
}

function deriveOpenItemsByContainer({
  areas,
  openProjects,
}: {
  areas: Area[]
  openProjects: Project[]
}): Record<ContainerId, string[]> {
  const out: Record<ContainerId, string[]> = {
    [SIDEBAR_UNASSIGNED_CONTAINER_ID]: [],
  }
  for (const a of areas) out[sidebarAreaContainerId(a.id)] = []

  for (const p of openProjects) {
    const containerId = p.area_id ? sidebarAreaContainerId(p.area_id) : SIDEBAR_UNASSIGNED_CONTAINER_ID
    const list = out[containerId] ?? []
    list.push(projectDragId(p.id))
    out[containerId] = list
  }

  return out
}

function isReorderChord(e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; key: string }): boolean {
  return (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')
}

type SidebarModel = {
  areas: Area[]
  openProjects: Project[]
}

type CreatePopover = {
  anchorEl: HTMLButtonElement
} | null

export function AppShell() {
  const { t } = useTranslation()
  const { revision, bumpRevision } = useAppEvents()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebar, setSidebar] = useState<SidebarModel>({ areas: [], openProjects: [] })
  const [sidebarError, setSidebarError] = useState<string | null>(null)
  const [sidebarProjectProgress, setSidebarProjectProgress] = useState<
    Record<string, { done_count: number; total_count: number }>
  >({})
  const [collapsedAreaIds, setCollapsedAreaIds] = useState<string[]>([])
  const collapsedAreaIdsRef = useRef<string[]>(collapsedAreaIds)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [createPopover, setCreatePopover] = useState<CreatePopover>(null)
  const createPopoverRef = useRef<CreatePopover>(createPopover)
  useEffect(() => {
    createPopoverRef.current = createPopover
  }, [createPopover])
  const createPopoverNodeRef = useRef<HTMLDivElement | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    collapsedAreaIdsRef.current = collapsedAreaIds
  }, [collapsedAreaIds])

  useEffect(() => {
    const isSelfTest = new URL(window.location.href).searchParams.get('selfTest') === '1'
    if (!isSelfTest) return
    ;(window as unknown as { __milestoSelectedTaskId?: string | null }).__milestoSelectedTaskId = selectedTaskId
  }, [selectedTaskId])

  const projectIdFromRoute = useMemo(() => {
    const match = location.pathname.match(/^\/projects\/([^/]+)$/)
    return match?.[1] ?? null
  }, [location.pathname])

  const areaIdFromRoute = useMemo(() => {
    const match = location.pathname.match(/^\/areas\/([^/]+)$/)
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
        if (handle && handle.taskId === openTaskId) {
          const ok = await handle.flushPendingChanges()
          if (!ok) {
            handle.focusLastErrorTarget()
            return
          }
          bumpRevision()
        }
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

  const closeCreatePopover = useCallback((opts?: { restoreFocus?: boolean }) => {
    const cur = createPopoverRef.current
    if (!cur) return
    setCreatePopover(null)
    if (!opts?.restoreFocus) return
    window.setTimeout(() => {
      if (cur.anchorEl.isConnected) cur.anchorEl.focus()
    }, 0)
  }, [])

  useEffect(() => {
    if (!createPopover) return

    function handlePointerDown(e: PointerEvent) {
      if (!(e.target instanceof Node)) return
      const pop = createPopoverNodeRef.current
      const anchorEl = createPopoverRef.current?.anchorEl ?? null
      if (pop?.contains(e.target) || anchorEl?.contains(e.target)) return
      closeCreatePopover({ restoreFocus: false })
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      closeCreatePopover({ restoreFocus: true })
    }

    function handleClose() {
      closeCreatePopover({ restoreFocus: false })
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('resize', handleClose)
    window.addEventListener('scroll', handleClose, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('resize', handleClose)
      window.removeEventListener('scroll', handleClose, true)
    }
  }, [closeCreatePopover, createPopover])

  const requestCloseTask = useCallback(async (): Promise<boolean> => {
    if (!openTaskId) return true

    const handle = openEditorHandleRef.current
    // If the editor hasn't registered its handle yet, do not close without flush.
    if (!handle || handle.taskId !== openTaskId) return false

    const ok = await handle.flushPendingChanges()
    if (!ok) {
      handle.focusLastErrorTarget()
      return false
    }

    setOpenTaskId(null)
    bumpRevision()
    return true
  }, [bumpRevision, openTaskId])

  useEffect(() => {
    if (openTaskId !== null) return
    const last = lastFocusTargetRef.current
    if (!last) return

    // Wait for overlay unmount.
    const handle = setTimeout(() => {
      // If something else already took focus (e.g. section title edit), don't steal it.
      const active = document.activeElement
      if (active instanceof HTMLElement && active !== document.body && active !== document.documentElement) {
        return
      }

      const selector = `[data-task-focus-target="true"][data-task-id="${last.taskId}"]`
      const fallback = document.querySelector<HTMLElement>(selector)
      if (fallback) {
        fallback.focus()
        return
      }

      if (last.element && last.element.isConnected) {
        last.element.focus()
        return
      }

      // Last-resort focus target to avoid leaving focus on body.
      contentScrollRef.current?.focus()
    }, 0)

    return () => clearTimeout(handle)
  }, [openTaskId])

  const focusActiveTaskListbox = useCallback(() => {
    // Prefer focusing the visible listbox to keep keyboard navigation flowing.
    const listbox = document.querySelector<HTMLElement>('.task-scroll[role="listbox"]')
    if (listbox && listbox.isConnected) {
      listbox.focus()
      return
    }
    contentScrollRef.current?.focus()
  }, [])

  const handleDeleteOpenTask = useCallback(async () => {
    if (!openTaskId) return

    const confirmed = confirm(t('task.deleteConfirm'))
    if (!confirmed) return

    const handle = openEditorHandleRef.current
    if (!handle || handle.taskId !== openTaskId) return

    const ok = await handle.flushPendingChanges()
    if (!ok) {
      handle.focusLastErrorTarget()
      return
    }

    const res = await window.api.task.delete(openTaskId)
    if (!res.ok) {
      setSidebarError(`${res.error.code}: ${res.error.message}`)
      return
    }

    // The currently selected task is now gone; clear selection to avoid enabling actions on a non-existent id.
    setSelectedTaskId(null)
    setOpenTaskId(null)
    bumpRevision()

    // Ensure focus doesn't end up on an arbitrary bottom-bar button after the editor unmounts.
    window.setTimeout(() => {
      focusActiveTaskListbox()
    }, 0)
  }, [bumpRevision, focusActiveTaskListbox, openTaskId, t])

  async function handleAddTask() {
    // Task titles can be empty strings; we want a new task to start blank.
    const emptyTitle = ''
    const today = formatLocalDate(new Date())

    const path = location.pathname

    let input: {
      title: string
      is_inbox?: boolean
      is_someday?: boolean
      scheduled_at?: string | null
      project_id?: string | null
      area_id?: string | null
    } = { title: emptyTitle, is_inbox: true }

    let shouldNavigateTo: string | null = null

    const projectMatch = path.match(/^\/projects\/([^/]+)$/)
    const areaMatch = path.match(/^\/areas\/([^/]+)$/)

    if (path === '/inbox') {
      input = { title: emptyTitle, is_inbox: true }
    } else if (path === '/anytime') {
      input = { title: emptyTitle }
    } else if (path === '/someday') {
      input = { title: emptyTitle, is_someday: true }
    } else if (path === '/today') {
      input = { title: emptyTitle, scheduled_at: today }
    } else if (projectMatch) {
      input = { title: emptyTitle, project_id: projectMatch[1] ?? null }
    } else if (areaMatch) {
      input = { title: emptyTitle, area_id: areaMatch[1] ?? null }
    } else {
      // Non-task-focused pages: create in Inbox and navigate there.
      input = { title: emptyTitle, is_inbox: true }
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
    const res = await window.api.sidebar.listModel()
    if (!res.ok) {
      setSidebarError(`${res.error.code}: ${res.error.message}`)
      return
    }

    setSidebarError(null)
    setSidebar(res.data)

    const projectIds = res.data.openProjects.map((p) => p.id)
    if (projectIds.length === 0) {
      setSidebarProjectProgress({})
      return
    }

    const countsRes = await window.api.task.countProjectsProgress(projectIds)
    if (!countsRes.ok) {
      setSidebarProjectProgress({})
      setSidebarError(`${countsRes.error.code}: ${countsRes.error.message}`)
      return
    }

    const next: Record<string, { done_count: number; total_count: number }> = {}
    for (const row of countsRes.data) {
      next[row.project_id] = { done_count: row.done_count, total_count: row.total_count }
    }
    setSidebarProjectProgress(next)
  }, [])

  useEffect(() => {
    // Trigger sidebar reload after cross-view mutations.
    void revision
    void refreshSidebar()
  }, [refreshSidebar, revision])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const res = await window.api.settings.getSidebarState()
      if (!res.ok) return
      if (cancelled) return

      // Treat persisted state as untrusted; keep it trimmed + unique.
      const unique = Array.from(new Set(res.data.collapsedAreaIds.map((id) => id.trim()).filter(Boolean)))
      setCollapsedAreaIds(unique)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const [orderedAreaDragIds, setOrderedAreaDragIds] = useState<string[]>([])
  const orderedAreaDragIdsRef = useRef<string[]>(orderedAreaDragIds)
  useEffect(() => {
    orderedAreaDragIdsRef.current = orderedAreaDragIds
  }, [orderedAreaDragIds])

  const [openItemsByContainer, setOpenItemsByContainer] = useState<Record<ContainerId, string[]>>(() => ({
    [SIDEBAR_UNASSIGNED_CONTAINER_ID]: [],
  }))
  const openItemsByContainerRef = useRef(openItemsByContainer)
  useEffect(() => {
    openItemsByContainerRef.current = openItemsByContainer
  }, [openItemsByContainer])

  const [activeAreaId, setActiveAreaId] = useState<string | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)

  const prefersReducedMotion = usePrefersReducedMotion()
  const dropAnimation = useMemo(() => getTaskDropAnimationConfig(prefersReducedMotion), [prefersReducedMotion])
  const dropAnimationDurationMs = useMemo(
    () => getTaskDropAnimationDurationMs(prefersReducedMotion),
    [prefersReducedMotion]
  )

  const clearActiveAreaIdTimeoutRef = useRef<number | null>(null)
  const clearActiveProjectIdTimeoutRef = useRef<number | null>(null)
  const enableClicksTimeoutRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)

  function formatSidebarErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message
    return String(err)
  }

  const cancelPendingDropTimers = useCallback(() => {
    if (clearActiveAreaIdTimeoutRef.current !== null) {
      window.clearTimeout(clearActiveAreaIdTimeoutRef.current)
      clearActiveAreaIdTimeoutRef.current = null
    }
    if (clearActiveProjectIdTimeoutRef.current !== null) {
      window.clearTimeout(clearActiveProjectIdTimeoutRef.current)
      clearActiveProjectIdTimeoutRef.current = null
    }
    if (enableClicksTimeoutRef.current !== null) {
      window.clearTimeout(enableClicksTimeoutRef.current)
      enableClicksTimeoutRef.current = null
    }
  }, [])

  useEffect(() => () => cancelPendingDropTimers(), [cancelPendingDropTimers])

  function scheduleClearActiveAreaIdAfterDrop(droppingAreaDragId: string) {
    if (dropAnimationDurationMs <= 0) {
      setActiveAreaId(null)
      return
    }
    if (clearActiveAreaIdTimeoutRef.current !== null) window.clearTimeout(clearActiveAreaIdTimeoutRef.current)
    clearActiveAreaIdTimeoutRef.current = window.setTimeout(() => {
      clearActiveAreaIdTimeoutRef.current = null
      setActiveAreaId((cur) => (cur === droppingAreaDragId ? null : cur))
    }, dropAnimationDurationMs)
  }

  function scheduleClearActiveProjectIdAfterDrop(droppingProjectDragId: string) {
    if (dropAnimationDurationMs <= 0) {
      setActiveProjectId(null)
      return
    }
    if (clearActiveProjectIdTimeoutRef.current !== null) {
      window.clearTimeout(clearActiveProjectIdTimeoutRef.current)
    }
    clearActiveProjectIdTimeoutRef.current = window.setTimeout(() => {
      clearActiveProjectIdTimeoutRef.current = null
      setActiveProjectId((cur) => (cur === droppingProjectDragId ? null : cur))
    }, dropAnimationDurationMs)
  }

  function scheduleEnableClicksAfterDrop() {
    if (dropAnimationDurationMs <= 0) {
      suppressClickRef.current = false
      return
    }
    if (enableClicksTimeoutRef.current !== null) window.clearTimeout(enableClicksTimeoutRef.current)
    enableClicksTimeoutRef.current = window.setTimeout(() => {
      enableClicksTimeoutRef.current = null
      suppressClickRef.current = false
    }, dropAnimationDurationMs)
  }

  function focusSidebarRowByDndId(dndId: string) {
    window.setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`[data-sidebar-dnd-id="${CSS.escape(dndId)}"]`)
      if (!row) return

      // Row roots may not be focusable (e.g., an Area group wrapper). Prefer focusing the
      // explicit activator element to keep focus stable after reorder.
      const activator = row.matches('[data-sidebar-row-activator="true"]')
        ? row
        : row.querySelector<HTMLElement>('[data-sidebar-row-activator="true"]')

      ;(activator ?? row).focus()
    }, 0)
  }

  function handleSidebarKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (activeAreaId || activeProjectId) return
    if (e.repeat) return
    if (!isReorderChord(e)) return

    if (e.target instanceof HTMLElement) {
      const tag = e.target.tagName
      // Don't steal text selection / cursor movement shortcuts from inputs.
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return
    }

    const target = e.target instanceof HTMLElement ? e.target : null
    if (!target) return

    const row = target.closest<HTMLElement>('[data-sidebar-dnd-kind][data-sidebar-dnd-id]')
    if (!row) return

    const kind = row.getAttribute('data-sidebar-dnd-kind')
    const dndId = row.getAttribute('data-sidebar-dnd-id')
    if (!kind || !dndId) return

    const dir = e.key === 'ArrowUp' ? -1 : 1

    if (kind === 'area') {
      const prev = orderedAreaDragIdsRef.current
      const from = prev.indexOf(dndId)
      const to = from + dir
      if (from < 0 || to < 0 || to >= prev.length) return

      e.preventDefault()
      const next = arrayMove(prev, from, to)
      setOrderedAreaDragIds(next)
      orderedAreaDragIdsRef.current = next
      focusSidebarRowByDndId(dndId)

      void (async () => {
        try {
          await persistAreaOrder(next)
          await refreshSidebar()
        } catch (err) {
          setOrderedAreaDragIds(prev)
          orderedAreaDragIdsRef.current = prev
          setSidebarError(formatSidebarErrorMessage(err))
        }
      })()
      return
    }

    if (kind === 'project') {
      const containerId = containerByProjectDragIdRef.current.get(dndId)
      if (!containerId) return
      const prevItems = openItemsByContainerRef.current[containerId] ?? []
      const from = prevItems.indexOf(dndId)
      const to = from + dir
      if (from < 0 || to < 0 || to >= prevItems.length) return

      e.preventDefault()
      const nextItems = arrayMove(prevItems, from, to)
      setOpenItemsByContainer((prevMap) => {
        const nextMap = { ...prevMap, [containerId]: nextItems }
        openItemsByContainerRef.current = nextMap
        return nextMap
      })
      focusSidebarRowByDndId(dndId)

      void (async () => {
        try {
          await persistProjectReorder(containerId, nextItems)
          await refreshSidebar()
        } catch (err) {
          setOpenItemsByContainer((prevMap) => {
            const nextMap = { ...prevMap, [containerId]: prevItems }
            openItemsByContainerRef.current = nextMap
            return nextMap
          })
          setSidebarError(formatSidebarErrorMessage(err))
        }
      })()
    }
  }

  useEffect(() => {
    if (activeAreaId || activeProjectId) return
    setOrderedAreaDragIds(sidebar.areas.map((a) => areaDragId(a.id)))
  }, [activeAreaId, activeProjectId, sidebar.areas])

  useEffect(() => {
    if (activeAreaId || activeProjectId) return
    setOpenItemsByContainer(deriveOpenItemsByContainer({ areas: sidebar.areas, openProjects: sidebar.openProjects }))
  }, [activeAreaId, activeProjectId, sidebar.areas, sidebar.openProjects])

  const areaById = useMemo(() => {
    const m = new Map<string, Area>()
    for (const a of sidebar.areas) m.set(a.id, a)
    return m
  }, [sidebar.areas])

  useEffect(() => {
    // If Areas are deleted/renamed, drop any persisted ids that no longer exist.
    setCollapsedAreaIds((prev) => prev.filter((id) => areaById.has(id)))
  }, [areaById])

  const projectById = useMemo(() => {
    const m = new Map<string, Project>()
    for (const p of sidebar.openProjects) m.set(p.id, p)
    return m
  }, [sidebar.openProjects])

  const orderedAreas = useMemo(() => {
    if (orderedAreaDragIds.length === 0) return sidebar.areas
    const out: Area[] = []
    const seen = new Set<string>()
    for (const dragId of orderedAreaDragIds) {
      const id = areaIdFromAreaDragId(dragId)
      if (!id) continue
      const a = areaById.get(id)
      if (!a) continue
      out.push(a)
      seen.add(id)
    }
    for (const a of sidebar.areas) {
      if (seen.has(a.id)) continue
      out.push(a)
    }
    return out
  }, [areaById, orderedAreaDragIds, sidebar.areas])

  const containerByProjectDragId = useMemo(() => {
    const m = new Map<string, ContainerId>()
    for (const [containerId, ids] of Object.entries(openItemsByContainer)) {
      for (const id of ids) m.set(id, containerId)
    }
    return m
  }, [openItemsByContainer])

  const containerByProjectDragIdRef = useRef(containerByProjectDragId)
  useEffect(() => {
    containerByProjectDragIdRef.current = containerByProjectDragId
  }, [containerByProjectDragId])

  function findContainerForIdInDrag(id: string): ContainerId | null {
    if (isSidebarContainerId(id)) return id
    if (isSidebarTailId(id)) return containerIdFromSidebarTailId(id)
    if (isAreaDragId(id)) {
      const areaId = areaIdFromAreaDragId(id)
      return areaId ? sidebarAreaContainerId(areaId) : null
    }
    if (isProjectDragId(id)) return containerByProjectDragIdRef.current.get(id) ?? null
    return null
  }

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const dragType = args.active.data.current?.type
      const pointerCollisions = pointerWithin(args)

      if (dragType === 'area') {
        const areaHits = pointerCollisions.filter((c) => typeof c.id === 'string' && isAreaDragId(String(c.id)))
        if (areaHits.length > 0) return areaHits

        const closestArea = closestCenter(args).filter((c) => typeof c.id === 'string' && isAreaDragId(String(c.id)))
        if (closestArea.length > 0) return closestArea
      }

      // Prefer item hits over containers so intra-container sorting works.
      const itemHits = pointerCollisions.filter(
        (c) =>
          typeof c.id === 'string' &&
          !isSidebarContainerId(String(c.id)) &&
          !isSidebarTailId(String(c.id))
      )
      if (itemHits.length > 0) return itemHits

      const containerHits = pointerCollisions.filter(
        (c) =>
          typeof c.id === 'string' &&
          (isSidebarContainerId(String(c.id)) || isSidebarTailId(String(c.id)))
      )
      if (containerHits.length > 0) return containerHits

      if (pointerCollisions.length > 0) return pointerCollisions
      return closestCenter(args)
    },
    []
  )

  const areaOrderSnapshotRef = useRef<string[] | null>(null)
  const openItemsSnapshotRef = useRef<Record<ContainerId, string[]> | null>(null)
  const dragStartContainerRef = useRef<ContainerId | null>(null)
  const lastDraftSignatureRef = useRef<string | null>(null)

  async function persistAreaOrder(nextAreaDragIds: string[]) {
    const orderedAreaIds = nextAreaDragIds
      .map((id) => areaIdFromAreaDragId(id))
      .filter((id): id is string => !!id)
    const res = await window.api.sidebar.reorderAreas({ ordered_area_ids: orderedAreaIds })
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`)
  }

  async function persistProjectReorder(containerId: ContainerId, orderedProjectDragIds: string[]) {
    const orderedProjectIds = orderedProjectDragIds
      .map((id) => projectIdFromProjectDragId(id))
      .filter((id): id is string => !!id)
    const res = await window.api.sidebar.reorderProjects({
      area_id: areaIdFromSidebarContainerId(containerId),
      ordered_project_ids: orderedProjectIds,
    })
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`)
  }

  async function persistProjectMove({
    projectDragId,
    fromContainerId,
    toContainerId,
    fromOrderedProjectDragIds,
    toOrderedProjectDragIds,
  }: {
    projectDragId: string
    fromContainerId: ContainerId
    toContainerId: ContainerId
    fromOrderedProjectDragIds: string[]
    toOrderedProjectDragIds: string[]
  }) {
    const projectId = projectIdFromProjectDragId(projectDragId)
    if (!projectId) throw new Error('Invalid project id')

    const fromOrderedIds = fromOrderedProjectDragIds
      .map((id) => projectIdFromProjectDragId(id))
      .filter((id): id is string => !!id)
    const toOrderedIds = toOrderedProjectDragIds
      .map((id) => projectIdFromProjectDragId(id))
      .filter((id): id is string => !!id)

    const res = await window.api.sidebar.moveProject({
      project_id: projectId,
      from_area_id: areaIdFromSidebarContainerId(fromContainerId),
      to_area_id: areaIdFromSidebarContainerId(toContainerId),
      from_ordered_project_ids: fromOrderedIds,
      to_ordered_project_ids: toOrderedIds,
    })
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`)
  }

  function handleDragStart(e: DragStartEvent) {
    const activeId = String(e.active.id)
    const dragType = e.active.data.current?.type
    cancelPendingDropTimers()
    suppressClickRef.current = true
    setSidebarError(null)
    lastDraftSignatureRef.current = null

    if (dragType === 'area') {
      setActiveAreaId(activeId)
      setActiveProjectId(null)
      areaOrderSnapshotRef.current = [...orderedAreaDragIdsRef.current]
      return
    }

    if (dragType === 'project') {
      setActiveProjectId(activeId)
      setActiveAreaId(null)
      openItemsSnapshotRef.current = cloneItemsByContainer(openItemsByContainerRef.current)
      dragStartContainerRef.current = findContainerForIdInDrag(activeId)
    }
  }

  function handleDragOver(e: DragOverEvent) {
    const activeId = String(e.active.id)
    const overId = e.over?.id ? String(e.over.id) : null
    if (!overId) return

    const dragType = e.active.data.current?.type
    if (dragType === 'area') {
      if (!isAreaDragId(overId) || !isAreaDragId(activeId) || activeId === overId) return

      const draft = orderedAreaDragIdsRef.current
      const from = draft.indexOf(activeId)
      const to = draft.indexOf(overId)
      if (from < 0 || to < 0 || from === to) return

      const sig = `${activeId}|${overId}|${from}|${to}`
      if (lastDraftSignatureRef.current === sig) return
      lastDraftSignatureRef.current = sig

      setOrderedAreaDragIds((prev) => {
        const curFrom = prev.indexOf(activeId)
        const curTo = prev.indexOf(overId)
        if (curFrom < 0 || curTo < 0 || curFrom === curTo) return prev
        const next = arrayMove(prev, curFrom, curTo)
        orderedAreaDragIdsRef.current = next
        return next
      })
      return
    }

    if (dragType !== 'project') return

    const src = findContainerForIdInDrag(activeId)
    const dest = findContainerForIdInDrag(overId)
    if (!src || !dest) return

    // Use the current draft map to compute indices, so reflow stays stable.
    const draft = openItemsByContainerRef.current

    if (src === dest) {
      // Avoid jump-to-top when hovering the container itself.
      if (isSidebarContainerId(overId)) return

      const items = draft[src] ?? []
      const from = items.indexOf(activeId)
      if (from < 0) return

      const isTailOver = isSidebarTailId(overId)
      const to = isTailOver ? Math.max(items.length - 1, 0) : items.indexOf(overId)
      if (to < 0 || from === to) return

      const sig = `${src}|${dest}|${activeId}|${overId}|${to}`
      if (lastDraftSignatureRef.current === sig) return
      lastDraftSignatureRef.current = sig

      setOpenItemsByContainer((prev) => {
        const cur = prev[src] ?? []
        const curFrom = cur.indexOf(activeId)
        if (curFrom < 0) return prev

        const curTo = isTailOver ? Math.max(cur.length - 1, 0) : cur.indexOf(overId)
        if (curTo < 0 || curFrom === curTo) return prev

        const nextItems = arrayMove(cur, curFrom, curTo)
        const next = { ...prev, [src]: nextItems }
        openItemsByContainerRef.current = next
        return next
      })
      return
    }

    const destItems = draft[dest] ?? []
    let insertIndex = 0
    if (isSidebarContainerId(overId) || isSidebarTailId(overId)) {
      insertIndex = isSidebarTailId(overId) ? destItems.length : 0
    } else {
      const overIndex = destItems.indexOf(overId)
      if (overIndex < 0) return

      const overMid = e.over!.rect.top + e.over!.rect.height / 2
      const activeRect = e.active.rect.current.translated ?? e.active.rect.current.initial
      const activeMid = activeRect ? activeRect.top + activeRect.height / 2 : 0
      const isAfter = activeMid > overMid
      insertIndex = Math.max(0, Math.min(overIndex + (isAfter ? 1 : 0), destItems.length))
    }

    const sig = `${src}|${dest}|${activeId}|${overId}|${insertIndex}`
    if (lastDraftSignatureRef.current === sig) return
    lastDraftSignatureRef.current = sig

    setOpenItemsByContainer((prev) => {
      const srcItems = prev[src] ?? []
      const destItems2 = prev[dest] ?? []
      const hasActive = srcItems.includes(activeId) || destItems2.includes(activeId)
      if (!hasActive) return prev

      const nextSrc = srcItems.filter((id) => id !== activeId)
      const nextDestBase = destItems2.filter((id) => id !== activeId)
      const idx = Math.max(0, Math.min(insertIndex, nextDestBase.length))
      const nextDest = [...nextDestBase]
      nextDest.splice(idx, 0, activeId)

      const next = { ...prev, [src]: nextSrc, [dest]: nextDest }
      openItemsByContainerRef.current = next
      containerByProjectDragIdRef.current.set(activeId, dest)
      return next
    })
  }

  async function handleDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id)
    const overId = e.over?.id ? String(e.over.id) : null
    const dragType = e.active.data.current?.type

    if (dragType === 'area') {
      scheduleClearActiveAreaIdAfterDrop(activeId)
      scheduleEnableClicksAfterDrop()

      const snapshot = areaOrderSnapshotRef.current
      areaOrderSnapshotRef.current = null
      lastDraftSignatureRef.current = null

      if (!overId) {
        if (snapshot) {
          setOrderedAreaDragIds(snapshot)
          orderedAreaDragIdsRef.current = snapshot
        }
        return
      }

      const nextOrder = orderedAreaDragIdsRef.current
      if (snapshot && snapshot.length === nextOrder.length && snapshot.every((id, i) => id === nextOrder[i])) {
        return
      }

      try {
        await persistAreaOrder(nextOrder)
        await refreshSidebar()
      } catch (err) {
        if (snapshot) {
          setOrderedAreaDragIds(snapshot)
          orderedAreaDragIdsRef.current = snapshot
        }
        setSidebarError(formatSidebarErrorMessage(err))
      }
      return
    }

    if (dragType !== 'project') return

    scheduleClearActiveProjectIdAfterDrop(activeId)
    scheduleEnableClicksAfterDrop()

    const snapshot = openItemsSnapshotRef.current
    openItemsSnapshotRef.current = null
    const fromContainer = dragStartContainerRef.current
    dragStartContainerRef.current = null
    lastDraftSignatureRef.current = null

    if (!overId || !fromContainer) {
      if (snapshot) {
        setOpenItemsByContainer(snapshot)
        openItemsByContainerRef.current = snapshot
      }
      return
    }

    const toContainer = findContainerForIdInDrag(activeId)
    if (!toContainer) {
      if (snapshot) {
        setOpenItemsByContainer(snapshot)
        openItemsByContainerRef.current = snapshot
      }
      return
    }

    const draft = openItemsByContainerRef.current
    const nextFrom = draft[fromContainer] ?? []
    const nextTo = draft[toContainer] ?? []

    try {
      if (fromContainer === toContainer) {
        await persistProjectReorder(fromContainer, nextFrom)
        await refreshSidebar()
        return
      }

      await persistProjectMove({
        projectDragId: activeId,
        fromContainerId: fromContainer,
        toContainerId: toContainer,
        fromOrderedProjectDragIds: nextFrom,
        toOrderedProjectDragIds: nextTo,
      })
      await refreshSidebar()
    } catch (err) {
      if (snapshot) {
        setOpenItemsByContainer(snapshot)
        openItemsByContainerRef.current = snapshot
      }
      setSidebarError(formatSidebarErrorMessage(err))
    }
  }

  function handleDragCancel(_e: DragCancelEvent) {
    cancelPendingDropTimers()
    suppressClickRef.current = false
    setActiveAreaId(null)
    setActiveProjectId(null)
    lastDraftSignatureRef.current = null
    dragStartContainerRef.current = null

    const areaSnapshot = areaOrderSnapshotRef.current
    areaOrderSnapshotRef.current = null
    if (areaSnapshot) {
      setOrderedAreaDragIds(areaSnapshot)
      orderedAreaDragIdsRef.current = areaSnapshot
    }

    if (openItemsSnapshotRef.current) {
      setOpenItemsByContainer(openItemsSnapshotRef.current)
      openItemsByContainerRef.current = openItemsSnapshotRef.current
    }
    openItemsSnapshotRef.current = null
  }

  async function handleCreate(kind: 'project' | 'area') {
    if (isCreating) return

    setIsCreating(true)
    try {
      setSidebarError(null)

      if (kind === 'project') {
        const res = await window.api.project.create({ title: '' })
        if (!res.ok) {
          setSidebarError(`${res.error.code}: ${res.error.message}`)
          return
        }

        closeCreatePopover({ restoreFocus: false })
        bumpRevision()
        navigate(`/projects/${res.data.id}?editTitle=1`)
        return
      }

      const res = await window.api.area.create({ title: '' })
      if (!res.ok) {
        setSidebarError(`${res.error.code}: ${res.error.message}`)
        return
      }

      closeCreatePopover({ restoreFocus: false })
      bumpRevision()
      navigate(`/areas/${res.data.id}?editTitle=1`)
    } finally {
      setIsCreating(false)
    }
  }

  const handleAddProjectForArea = useCallback(async () => {
    const areaId = areaIdFromRoute
    if (!areaId) return
    if (isCreating) return

    setIsCreating(true)
    try {
      setSidebarError(null)
      const res = await window.api.project.create({ title: '', area_id: areaId })
      if (!res.ok) {
        setSidebarError(`${res.error.code}: ${res.error.message}`)
        return
      }

      bumpRevision()
      navigate(`/projects/${res.data.id}?editTitle=1`)
    } finally {
      setIsCreating(false)
    }
  }, [areaIdFromRoute, bumpRevision, isCreating, navigate])

  const renderCreatePopover = () => {
    if (!createPopover) return null

    const rect = createPopover.anchorEl.getBoundingClientRect()
    const viewportPadding = 12
    const gap = 8
    const width = 240

    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - width - viewportPadding
    )

    const estimatedHeight = 64
    const preferredTop = rect.bottom + gap
    const spaceBelow = window.innerHeight - viewportPadding - preferredTop
    const spaceAbove = rect.top - gap - viewportPadding
    const openAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow

    const top = openAbove ? rect.top - gap : preferredTop

    return createPortal(
      <div
        ref={createPopoverNodeRef}
        className="sidebar-create"
        role="dialog"
        style={{
          position: 'fixed',
          top,
          left,
          width,
          transform: openAbove ? 'translateY(-100%)' : undefined,
          zIndex: 60,
        }}
      >
        <div className="create-toggle">
          <button
            type="button"
            className="create-toggle-item"
            onClick={() => void handleCreate('project')}
            disabled={isCreating}
          >
            {t('shell.project')}
          </button>
          <button
            type="button"
            className="create-toggle-item"
            onClick={() => void handleCreate('area')}
            disabled={isCreating}
          >
            {t('shell.area')}
          </button>
        </div>
      </div>,
      document.body
    )
  }

  return (
    <TaskSelectionProvider
      value={{
        selectedTaskId,
        selectTask: setSelectedTaskId,
        openTaskId,
        openTask,
        closeTask,
        requestCloseTask,
        registerOpenEditor,
      }}
    >
      <ContentScrollProvider scrollRef={contentScrollRef}>
      <div className="app-shell">
        <aside className="sidebar" aria-label={t('aria.sidebar')}>
        <div className="sidebar-top">
          <div className="app-title">Milesto</div>
        </div>

        <nav className="nav" aria-label={t('aria.mainNavigation')} onKeyDown={handleSidebarKeyDown}>
          <NavItem to="/inbox" label={t('nav.inbox')} />
          <NavItem to="/today" label={t('nav.today')} />
          <NavItem to="/upcoming" label={t('nav.upcoming')} />
          <NavItem to="/anytime" label={t('nav.anytime')} />
          <NavItem to="/someday" label={t('nav.someday')} />

          <div className="nav-sep" />
          <NavItem to="/logbook" label={t('nav.logbook')} />

          <div className="nav-sep" />
          <div className="nav-section-title">{t('nav.projects')}</div>

          {sidebarError ? <div className="sidebar-error">{sidebarError}</div> : null}

          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SidebarUnassignedGroup
              containerId={SIDEBAR_UNASSIGNED_CONTAINER_ID}
              projectDragIds={openItemsByContainer[SIDEBAR_UNASSIGNED_CONTAINER_ID] ?? []}
              projectById={projectById}
              activeProjectDragId={activeProjectId}
              suppressClickRef={suppressClickRef}
              projectProgressById={sidebarProjectProgress}
              onBumpRevision={bumpRevision}
              onSetSidebarError={setSidebarError}
            />

            <SortableContext items={orderedAreaDragIds} strategy={verticalListSortingStrategy}>
              {orderedAreas.map((area) => (
                <SortableSidebarAreaGroup
                  key={area.id}
                  area={area}
                  containerId={sidebarAreaContainerId(area.id)}
                  projectDragIds={openItemsByContainer[sidebarAreaContainerId(area.id)] ?? []}
                  projectById={projectById}
                  activeAreaDragId={activeAreaId}
                  activeProjectDragId={activeProjectId}
                  suppressClickRef={suppressClickRef}
                  projectProgressById={sidebarProjectProgress}
                  onBumpRevision={bumpRevision}
                  onSetSidebarError={setSidebarError}
                  isCollapsed={collapsedAreaIds.includes(area.id)}
                  onToggleCollapsed={() => {
                    const prev = collapsedAreaIdsRef.current
                    const nextSet = new Set(prev)
                    if (nextSet.has(area.id)) nextSet.delete(area.id)
                    else nextSet.add(area.id)
                    const next = Array.from(nextSet)
                    setCollapsedAreaIds(next)

                    void (async () => {
                      const res = await window.api.settings.setSidebarState({ collapsedAreaIds: next })
                      if (res.ok) return

                      // If persistence fails, revert UI state and surface an error.
                      setCollapsedAreaIds(prev)
                      setSidebarError(`${res.error.code}: ${res.error.message}`)
                    })()
                  }}
                />
              ))}
            </SortableContext>

            {createPortal(
              <DragOverlay dropAnimation={dropAnimation}>
                <SidebarDragOverlay
                  activeAreaDragId={activeAreaId}
                  activeProjectDragId={activeProjectId}
                  areaById={areaById}
                  projectById={projectById}
                />
              </DragOverlay>,
              document.body
            )}
          </DndContext>
        </nav>

        {createPopover ? renderCreatePopover() : null}

        <div className="sidebar-bottom">
          <button
            type="button"
            className="button button-ghost"
            aria-haspopup="dialog"
            aria-expanded={createPopover ? true : false}
            onClick={(e) => {
              const anchorEl = e.currentTarget
              setCreatePopover((cur) => (cur ? null : { anchorEl }))
            }}
          >
            {t('shell.new')}
          </button>

          <NavItem to="/settings" label={t('nav.settings')} />
        </div>
      </aside>

        <main className="content" aria-label={t('aria.content')}>
          <div className="content-grid">
            <div className="content-main">
              <div ref={contentScrollRef} className="content-scroll" tabIndex={-1}>
                <Outlet />
              </div>

                <div
                  className="content-bottom-bar"
                  data-content-bottom-actions={openTaskId === null ? 'true' : undefined}
                  data-content-bottom-actions-edit={openTaskId !== null ? 'true' : undefined}
                >
                  {openTaskId === null ? (
                    <>
                      <button type="button" className="button button-ghost" onClick={() => void handleAddTask()}>
                        {t('shell.task')}
                      </button>
                      {areaIdFromRoute ? (
                        <button
                          type="button"
                          className="button button-ghost"
                          onClick={() => void handleAddProjectForArea()}
                          disabled={isCreating}
                        >
                          {t('common.addProject')}
                        </button>
                      ) : null}
                      {projectIdFromRoute ? (
                        <button type="button" className="button button-ghost" onClick={handleAddSection}>
                          {t('shell.section')}
                        </button>
                      ) : null}

                      <ContentBottomBarActions
                        variant="list"
                        taskId={selectedTaskId}
                        areas={sidebar.areas}
                        openProjects={sidebar.openProjects}
                        bumpRevision={bumpRevision}
                      />
                    </>
                  ) : (
                    <>
                      <ContentBottomBarActions
                        variant="edit"
                        taskId={openTaskId}
                        areas={sidebar.areas}
                        openProjects={sidebar.openProjects}
                        bumpRevision={bumpRevision}
                        onEditModeActionComplete={() => {
                          void requestCloseTask()
                        }}
                      />
                      <button
                        type="button"
                        className="button button-ghost"
                        onClick={() => void handleDeleteOpenTask()}
                        data-content-bottom-edit-action="delete"
                      >
                        {t('common.delete')}
                      </button>
                      <button
                        type="button"
                        className="button button-ghost"
                        onClick={() => {
                          // Placeholder: reserved for future menu.
                        }}
                        data-content-bottom-edit-action="more"
                      >
                        {t('common.more')}
                      </button>
                    </>
                  )}
                </div>
            </div>
          </div>
        </main>

        <SearchPanel />
      </div>
      </ContentScrollProvider>
    </TaskSelectionProvider>
  )
}

function SidebarContainerTailDropZone({
  containerId,
}: {
  containerId: ContainerId
}) {
  const { setNodeRef } = useDroppable({
    id: sidebarTailIdFromContainerId(containerId),
    data: { type: 'containerTail', containerId },
  })

  return <div ref={setNodeRef} className="sidebar-tail-dropzone" aria-hidden="true" />
}

function SidebarFolderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7.5c0-1.1.9-2 2-2h5l2 2h7c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2v-11z" />
    </svg>
  )
}

function SidebarChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 8l5 5 5-5" />
    </svg>
  )
}

function SortableSidebarProjectNavItem({
  project,
  indent,
  activeProjectDragId,
  suppressClickRef,
  progress,
  onBumpRevision,
  onSetSidebarError,
}: {
  project: Project
  indent?: boolean
  activeProjectDragId: string | null
  suppressClickRef: React.MutableRefObject<boolean>
  progress: { done_count: number; total_count: number } | null
  onBumpRevision: () => void
  onSetSidebarError: (msg: string | null) => void
}) {
  const { t } = useTranslation()
  const [isMutating, setIsMutating] = useState(false)
  const hasProjectTitle = project.title.trim().length > 0
  const displayProjectTitle = hasProjectTitle ? project.title : t('project.untitled')
  const dragId = projectDragId(project.id)
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition } = useSortable({
    id: dragId,
    data: { type: 'project', projectId: project.id },
  })

  const isHiddenForOverlay = activeProjectDragId === dragId

  return (
    <div
      ref={setNodeRef}
      className={`nav-project-header${indent ? ' is-indent' : ''}`}
      data-sidebar-dnd-kind="project"
      data-sidebar-dnd-id={dragId}
      style={{
        transform: DndCss.Transform.toString(transform),
        transition,
        visibility: isHiddenForOverlay ? 'hidden' : undefined,
      }}
    >
      <NavLink
        ref={setActivatorNodeRef}
        className={({ isActive }) =>
          `nav-item nav-project-row${isActive ? ' is-active' : ''}${hasProjectTitle ? '' : ' is-placeholder'}`
        }
        to={`/projects/${project.id}`}
        data-sidebar-row-activator="true"
        {...attributes}
        {...(listeners ?? {})}
        onPointerDown={(e) => {
          listeners?.onPointerDown?.(e)
        }}
        onClick={(e) => {
          if (suppressClickRef.current) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        {displayProjectTitle}
      </NavLink>

      <div className="nav-project-progress">
        <ProjectProgressControl
          status={project.status}
          doneCount={progress?.done_count ?? 0}
          totalCount={progress?.total_count ?? 0}
          size="list"
          disabled={!progress || isMutating}
          onActivate={async () => {
            if (suppressClickRef.current) return
            if (!progress) return
            if (isMutating) return

            const openCount = Math.max(0, progress.total_count - progress.done_count)

            onSetSidebarError(null)
            if (project.status === 'done') {
              setIsMutating(true)
              try {
                const res = await window.api.project.update({ id: project.id, status: 'open' })
                if (!res.ok) {
                  onSetSidebarError(`${res.error.code}: ${res.error.message}`)
                  return
                }
                onBumpRevision()
              } finally {
                setIsMutating(false)
              }
              return
            }

            const confirmed = confirm(t('project.completeConfirm', { count: openCount }))
            if (!confirmed) return

            setIsMutating(true)
            try {
              const res = await window.api.project.complete(project.id)
              if (!res.ok) {
                onSetSidebarError(`${res.error.code}: ${res.error.message}`)
                return
              }
              onBumpRevision()
            } finally {
              setIsMutating(false)
            }
          }}
        />
      </div>
    </div>
  )
}

function SidebarUnassignedGroup({
  containerId,
  projectDragIds,
  projectById,
  activeProjectDragId,
  suppressClickRef,
  projectProgressById,
  onBumpRevision,
  onSetSidebarError,
}: {
  containerId: ContainerId
  projectDragIds: string[]
  projectById: Map<string, Project>
  activeProjectDragId: string | null
  suppressClickRef: React.MutableRefObject<boolean>
  projectProgressById: Record<string, { done_count: number; total_count: number }>
  onBumpRevision: () => void
  onSetSidebarError: (msg: string | null) => void
}) {
  const { setNodeRef } = useDroppable({
    id: containerId,
    data: { type: 'container', containerId },
  })

  return (
    <div ref={setNodeRef} className="sidebar-project-group">
      <SortableContext items={projectDragIds} strategy={verticalListSortingStrategy}>
        {projectDragIds.map((dragId) => {
          const projectId = projectIdFromProjectDragId(dragId)
          if (!projectId) return null
          const project = projectById.get(projectId)
          if (!project) return null
          const progress = projectProgressById[projectId] ?? null
          return (
            <SortableSidebarProjectNavItem
              key={project.id}
              project={project}
              activeProjectDragId={activeProjectDragId}
              suppressClickRef={suppressClickRef}
              progress={progress}
              onBumpRevision={onBumpRevision}
              onSetSidebarError={onSetSidebarError}
            />
          )
        })}
      </SortableContext>

      <SidebarContainerTailDropZone containerId={containerId} />
    </div>
  )
}

function SortableSidebarAreaGroup({
  area,
  containerId,
  projectDragIds,
  projectById,
  activeAreaDragId,
  activeProjectDragId,
  suppressClickRef,
  projectProgressById,
  onBumpRevision,
  onSetSidebarError,
  isCollapsed,
  onToggleCollapsed,
}: {
  area: Area
  containerId: ContainerId
  projectDragIds: string[]
  projectById: Map<string, Project>
  activeAreaDragId: string | null
  activeProjectDragId: string | null
  suppressClickRef: React.MutableRefObject<boolean>
  projectProgressById: Record<string, { done_count: number; total_count: number }>
  onBumpRevision: () => void
  onSetSidebarError: (msg: string | null) => void
  isCollapsed: boolean
  onToggleCollapsed: () => void
}) {
  const { t } = useTranslation()
  const { setNodeRef: setDroppableNodeRef } = useDroppable({
    id: containerId,
    data: { type: 'container', containerId },
  })

  const dragId = areaDragId(area.id)
  const { attributes, listeners, setActivatorNodeRef, setNodeRef: setSortableNodeRef, transform, transition } =
    useSortable({
      id: dragId,
      data: { type: 'area', areaId: area.id },
    })

  const setGroupNodeRef = useCallback(
    (el: HTMLDivElement | null) => {
      setDroppableNodeRef(el)
      setSortableNodeRef(el)
    },
    [setDroppableNodeRef, setSortableNodeRef]
  )

  const isHiddenForOverlay = activeAreaDragId === dragId
  const hasAreaTitle = area.title.trim().length > 0
  const displayAreaTitle = hasAreaTitle ? area.title : t('area.untitled')

  return (
    <div
      ref={setGroupNodeRef}
      className={`nav-area${isCollapsed ? ' is-collapsed' : ''}`}
      data-sidebar-dnd-kind="area"
      data-sidebar-dnd-id={dragId}
      style={{
        transform: DndCss.Transform.toString(transform),
        transition,
        visibility: isHiddenForOverlay ? 'hidden' : undefined,
      }}
    >
      <div className="nav-area-header">
        <NavLink
          ref={setActivatorNodeRef}
          className={({ isActive }) =>
            `nav-item nav-area-row${isActive ? ' is-active' : ''}${hasAreaTitle ? '' : ' is-placeholder'}`
          }
          to={`/areas/${area.id}`}
          data-sidebar-row-activator="true"
          {...attributes}
          {...(listeners ?? {})}
          onPointerDown={(e) => {
            listeners?.onPointerDown?.(e)
          }}
          onClick={(e) => {
            if (suppressClickRef.current) {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
        >
          <SidebarFolderIcon className="nav-area-icon" />
          <span className="nav-area-label">{displayAreaTitle}</span>
        </NavLink>

        <button
          type="button"
          className="nav-area-collapse"
          aria-expanded={!isCollapsed}
          aria-label={
            isCollapsed
              ? t('aria.expandArea', { title: displayAreaTitle })
              : t('aria.collapseArea', { title: displayAreaTitle })
          }
          data-sidebar-area-collapse="true"
          onPointerDown={(e) => {
            // Avoid accidental drag activation / click suppression interactions.
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (suppressClickRef.current) return
            onToggleCollapsed()
          }}
        >
          <SidebarChevronIcon className="nav-area-collapse-icon" />
        </button>
      </div>

      {!isCollapsed ? (
        <>
          <SortableContext items={projectDragIds} strategy={verticalListSortingStrategy}>
            {projectDragIds.map((pDragId) => {
              const projectId = projectIdFromProjectDragId(pDragId)
              if (!projectId) return null
              const project = projectById.get(projectId)
              if (!project) return null
              const progress = projectProgressById[projectId] ?? null
              return (
                <SortableSidebarProjectNavItem
                  key={project.id}
                  project={project}
                  indent
                  activeProjectDragId={activeProjectDragId}
                  suppressClickRef={suppressClickRef}
                  progress={progress}
                  onBumpRevision={onBumpRevision}
                  onSetSidebarError={onSetSidebarError}
                />
              )
            })}
          </SortableContext>

        </>
      ) : null}

      <SidebarContainerTailDropZone containerId={containerId} />
    </div>
  )
}

function SidebarDragOverlay({
  activeAreaDragId,
  activeProjectDragId,
  areaById,
  projectById,
}: {
  activeAreaDragId: string | null
  activeProjectDragId: string | null
  areaById: Map<string, Area>
  projectById: Map<string, Project>
}) {
  const { t } = useTranslation()
  if (activeAreaDragId) {
    const areaId = areaIdFromAreaDragId(activeAreaDragId)
    const area = areaId ? areaById.get(areaId) : null
    if (!area) return null
    return (
      <div className="sidebar-dnd-overlay" aria-hidden="true">
        {area.title.trim() ? area.title : t('area.untitled')}
      </div>
    )
  }

  if (activeProjectDragId) {
    const projectId = projectIdFromProjectDragId(activeProjectDragId)
    const project = projectId ? projectById.get(projectId) : null
    if (!project) return null
    return (
      <div className="sidebar-dnd-overlay" aria-hidden="true">
        {project.title.trim() ? project.title : t('project.untitled')}
      </div>
    )
  }

  return null
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
