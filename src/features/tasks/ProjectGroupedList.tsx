import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useVirtualizer } from '@tanstack/react-virtual'

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
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { ProjectSection } from '../../../shared/schemas/project'
import type { TaskListItem } from '../../../shared/schemas/task-list'
import { taskListIdProject } from '../../../shared/task-list-ids'

import { useContentScrollRef } from '../../app/ContentScrollContext'
import { TaskInlineEditorRow } from './TaskInlineEditorRow'
import { TaskRow } from './TaskRow'
import { useTaskSelection } from './TaskSelectionContext'
import {
  getTaskDropAnimationConfig,
  getTaskDropAnimationDurationMs,
  usePrefersReducedMotion,
} from './dnd-drop-animation'

type Row =
  | {
      type: 'group'
      key: string
      title: string
      sectionId: string | null
    }
  | { type: 'task'; task: TaskListItem }

type SelectedRow =
  | { type: 'task'; taskId: string }
  | { type: 'group'; sectionId: string }
  | null

function sortByRankThenCreated(a: TaskListItem, b: TaskListItem) {
  const ar = a.rank ?? Number.POSITIVE_INFINITY
  const br = b.rank ?? Number.POSITIVE_INFINITY
  if (ar !== br) return ar - br
  return a.created_at.localeCompare(b.created_at)
}

type ContainerId = string
const projectTailIdPrefix = 'project-tail:'
const projectSectionDragIdPrefix = 'project-section:'

function projectTailIdFromContainerId(containerId: ContainerId): string {
  return `${projectTailIdPrefix}${containerId}`
}

function projectSectionDragId(sectionId: string): string {
  return `${projectSectionDragIdPrefix}${sectionId}`
}

function isProjectSectionDragId(id: string): boolean {
  return id.startsWith(projectSectionDragIdPrefix)
}

function sectionIdFromProjectSectionDragId(id: string): string | null {
  if (!isProjectSectionDragId(id)) return null
  const sectionId = id.slice(projectSectionDragIdPrefix.length)
  return sectionId || null
}

function NoSectionDropZone({
  containerId,
}: {
  containerId: ContainerId
}) {
  // Invisible hit area at the very top of the list content.
  // This enables dropping into no-section without introducing a visible group header.
  const { setNodeRef } = useDroppable({
    id: containerId,
    data: { type: 'container', containerId },
  })

  return (
    <div
      ref={setNodeRef}
      className="project-no-section-dropzone"
      aria-hidden="true"
    />
  )
}

function ProjectSectionTailDropZone({
  containerId,
}: {
  containerId: ContainerId
}) {
  const { setNodeRef } = useDroppable({
    id: projectTailIdFromContainerId(containerId),
    data: { type: 'containerTail', containerId },
  })

  return (
    <div
      ref={setNodeRef}
      className="project-section-tail-dropzone"
      aria-hidden="true"
    />
  )
}

function isProjectContainerId(id: string): boolean {
  return id.startsWith('project:')
}

function isProjectTailId(id: string): boolean {
  return id.startsWith(projectTailIdPrefix)
}

function containerIdFromTailId(id: string): ContainerId | null {
  if (!isProjectTailId(id)) return null
  const containerId = id.slice(projectTailIdPrefix.length)
  return containerId || null
}

function sectionIdFromProjectContainerId(containerId: string): string | null {
  // Format: project:<projectId>:<sectionId|none>
  const parts = containerId.split(':')
  const sectionPart = parts[2]
  if (!sectionPart || sectionPart === 'none') return null
  return sectionPart
}

function sectionIdFromDragOrContainerId(id: string): string | null {
  const fromDragId = sectionIdFromProjectSectionDragId(id)
  if (fromDragId) return fromDragId
  if (isProjectContainerId(id)) return sectionIdFromProjectContainerId(id)
  return null
}

function deriveOpenItemsByContainer({
  projectId,
  sections,
  openTasks,
}: {
  projectId: string
  sections: ProjectSection[]
  openTasks: TaskListItem[]
}): Record<ContainerId, string[]> {
  const knownSectionIds = new Set(sections.map((s) => s.id))
  const openBySection = new Map<string, TaskListItem[]>()
  const openNone: TaskListItem[] = []

  for (const t of openTasks) {
    const sid = t.section_id
    if (!sid || !knownSectionIds.has(sid)) {
      openNone.push(t)
      continue
    }

    const list = openBySection.get(sid) ?? []
    list.push(t)
    openBySection.set(sid, list)
  }

  openNone.sort(sortByRankThenCreated)
  for (const list of openBySection.values()) list.sort(sortByRankThenCreated)

  const out: Record<ContainerId, string[]> = {}
  out[taskListIdProject(projectId, null)] = openNone.map((t) => t.id)
  for (const s of sections) {
    const list = openBySection.get(s.id) ?? []
    out[taskListIdProject(projectId, s.id)] = list.map((t) => t.id)
  }

  return out
}

function ProjectGroupHeaderRow({
  containerId,
  sectionId,
  title,
  isSelected,
  isDragging,
  isEditing,
  editTitleDraft,
  setEditTitleDraft,
  editTitleInputRef,
  onSelectRow,
  onEnterEdit,
  onCancelEdit,
  onCommitTitle,
  measureElement,
  index,
  translateY,
}: {
  containerId: ContainerId
  sectionId: string
  title: string
  isSelected: boolean
  isDragging: boolean
  isEditing: boolean
  editTitleDraft: string
  setEditTitleDraft: (next: string) => void
  editTitleInputRef: React.RefCallback<HTMLInputElement>
  onSelectRow: () => void
  onEnterEdit: () => void
  onCancelEdit: () => void
  onCommitTitle: (nextTitle: string) => void
  measureElement: (el: HTMLLIElement | null) => void
  index: number
  translateY: number
}) {
  const { setNodeRef: setDroppableNodeRef } = useDroppable({
    id: containerId,
    data: { type: 'container', containerId },
  })

  const {
    attributes: sectionAttributes,
    listeners: sectionListeners,
    setActivatorNodeRef: setSectionActivatorNodeRef,
    setNodeRef: setSectionSortableNodeRef,
  } = useSortable({
    id: projectSectionDragId(sectionId),
    data: { type: 'section', sectionId },
    disabled: isEditing,
  })

  const setHeaderNodeRef = useCallback(
    (el: HTMLDivElement | null) => {
      setDroppableNodeRef(el)
      setSectionSortableNodeRef(el)
    },
    [setDroppableNodeRef, setSectionSortableNodeRef]
  )

  return (
    <li
      ref={measureElement}
      data-index={index}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        ref={setHeaderNodeRef}
        className={`project-group-header${isSelected ? ' is-selected' : ''}${isDragging ? ' is-dragging' : ''}`}
        data-section-id={sectionId}
      >
        {isEditing ? (
          <div className="project-group-left">
            <input
              ref={editTitleInputRef}
              className="project-group-title project-group-title-input"
              value={editTitleDraft}
              placeholder="(untitled)"
              aria-label="Section title"
              onChange={(e) => setEditTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                // Prevent listbox navigation and allow inline editing.
                e.stopPropagation()

                if (e.key === 'Enter') {
                  e.preventDefault()
                  const next = editTitleDraft.trim()
                  if (next === title) {
                    onCancelEdit()
                    return
                  }
                  onCommitTitle(next)
                  return
                }

                if (e.key === 'Escape') {
                  e.preventDefault()
                  onCancelEdit()
                }
              }}
              onBlur={() => {
                const next = editTitleDraft.trim()
                if (next === title) {
                  onCancelEdit()
                  return
                }
                onCommitTitle(next)
              }}
            />
          </div>
        ) : (
          <button
            ref={setSectionActivatorNodeRef}
            type="button"
            className="project-group-left project-group-left-button"
            {...sectionAttributes}
            {...(sectionListeners ?? {})}
            onPointerDown={(e) => {
              onSelectRow()
              sectionListeners?.onPointerDown?.(e)
            }}
            onClick={onSelectRow}
            onDoubleClick={() => {
              onSelectRow()
              onEnterEdit()
            }}
          >
            <div className={`project-group-title${title.trim() ? '' : ' is-placeholder'}`}>
              {title.trim() ? title : '(untitled)'}
            </div>
          </button>
        )}

        {/* Intentionally no per-section action buttons; keep header visually minimal. */}
      </div>
    </li>
  )
}

function SortableProjectTaskRow({
  task,
  onSelect,
  onOpen,
  onToggleDone,
  onSelectForDrag,
}: {
  task: TaskListItem
  onSelect: (taskId: string) => void
  onOpen: (taskId: string) => void
  onToggleDone: (taskId: string, done: boolean) => void
  onSelectForDrag: (taskId: string) => void
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition } = useSortable({
    id: task.id,
    data: { type: 'task' },
  })

  return (
    <TaskRow
      task={task}
      innerRef={setNodeRef}
      innerStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      titleActivatorRef={setActivatorNodeRef}
      titleActivatorProps={{
        ...attributes,
        ...(listeners ?? {}),
        onPointerDown: (e) => {
          // Preserve “select on drag start” even if click doesn't fire.
          onSelectForDrag(task.id)
          listeners?.onPointerDown?.(e)
        },
      }}
      onSelect={onSelect}
      onOpen={onOpen}
      onToggleDone={onToggleDone}
    />
  )
}

function ProjectSectionDragOverlay({
  title,
}: {
  title: string
}) {
  const hasTitle = title.trim().length > 0

  return (
    <div className="project-section-dnd-overlay" aria-hidden="true">
      <div className="project-section-dnd-overlay-edge project-section-dnd-overlay-edge-1" />
      <div className="project-section-dnd-overlay-edge project-section-dnd-overlay-edge-2" />
      <div className="project-section-dnd-overlay-card">
        <div className={`project-group-title${hasTitle ? '' : ' is-placeholder'}`}>{hasTitle ? title : '(untitled)'}</div>
      </div>
    </div>
  )
}

export function ProjectGroupedList({
  projectId,
  sections,
  openTasks,
  doneTasks,
  editingSectionId,
  onStartSectionTitleEdit,
  onCancelSectionTitleEdit,
  onCommitSectionTitle,
  onToggleDone,
  onAfterReorder,
}: {
  projectId: string
  sections: ProjectSection[]
  openTasks: TaskListItem[]
  doneTasks: TaskListItem[] | null
  editingSectionId: string | null
  onStartSectionTitleEdit: (sectionId: string) => void
  onCancelSectionTitleEdit: () => void
  onCommitSectionTitle: (sectionId: string, title: string) => Promise<void>
  onToggleDone: (taskId: string, done: boolean) => Promise<void>
  onAfterReorder?: () => Promise<void>
}) {
  const { selectedTaskId, selectTask, openTask, openTaskId, requestCloseTask } = useTaskSelection()
  const contentScrollRef = useContentScrollRef()

  const [orderedSectionIds, setOrderedSectionIds] = useState<string[]>(() => sections.map((s) => s.id))
  const orderedSectionIdsRef = useRef(orderedSectionIds)
  useEffect(() => {
    orderedSectionIdsRef.current = orderedSectionIds
  }, [orderedSectionIds])

  const orderedSections = useMemo(() => {
    const byId = new Map<string, ProjectSection>()
    for (const section of sections) byId.set(section.id, section)

    const out: ProjectSection[] = []
    const seen = new Set<string>()

    for (const sectionId of orderedSectionIds) {
      const section = byId.get(sectionId)
      if (!section) continue
      out.push(section)
      seen.add(sectionId)
    }

    for (const section of sections) {
      if (seen.has(section.id)) continue
      out.push(section)
    }

    return out
  }, [orderedSectionIds, sections])

  const [openItemsByContainer, setOpenItemsByContainer] = useState<Record<ContainerId, string[]>>(() =>
    deriveOpenItemsByContainer({ projectId, sections, openTasks })
  )

  const noSectionContainerId = useMemo(() => taskListIdProject(projectId, null), [projectId])

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const dropAnimation = useMemo(() => getTaskDropAnimationConfig(prefersReducedMotion), [prefersReducedMotion])
  const dropAnimationDurationMs = useMemo(
    () => getTaskDropAnimationDurationMs(prefersReducedMotion),
    [prefersReducedMotion]
  )

  const clearActiveTaskIdTimeoutRef = useRef<number | null>(null)
  const clearActiveSectionIdTimeoutRef = useRef<number | null>(null)
  const cancelPendingDropTimers = useCallback(() => {
    if (clearActiveTaskIdTimeoutRef.current !== null) {
      window.clearTimeout(clearActiveTaskIdTimeoutRef.current)
      clearActiveTaskIdTimeoutRef.current = null
    }

    if (clearActiveSectionIdTimeoutRef.current !== null) {
      window.clearTimeout(clearActiveSectionIdTimeoutRef.current)
      clearActiveSectionIdTimeoutRef.current = null
    }
  }, [])

  useEffect(() => () => cancelPendingDropTimers(), [cancelPendingDropTimers])

  function scheduleClearActiveTaskIdAfterDrop(droppingTaskId: string) {
    if (dropAnimationDurationMs <= 0) {
      setActiveTaskId(null)
      return
    }

    if (clearActiveTaskIdTimeoutRef.current !== null) window.clearTimeout(clearActiveTaskIdTimeoutRef.current)

    clearActiveTaskIdTimeoutRef.current = window.setTimeout(() => {
      clearActiveTaskIdTimeoutRef.current = null
      setActiveTaskId((cur) => (cur === droppingTaskId ? null : cur))
    }, dropAnimationDurationMs)
  }

  function scheduleClearActiveSectionIdAfterDrop(droppingSectionId: string) {
    if (dropAnimationDurationMs <= 0) {
      setActiveSectionId(null)
      return
    }

    if (clearActiveSectionIdTimeoutRef.current !== null) {
      window.clearTimeout(clearActiveSectionIdTimeoutRef.current)
    }

    clearActiveSectionIdTimeoutRef.current = window.setTimeout(() => {
      clearActiveSectionIdTimeoutRef.current = null
      setActiveSectionId((cur) => (cur === droppingSectionId ? null : cur))
    }, dropAnimationDurationMs)
  }

  const dragSnapshotRef = useRef<Record<ContainerId, string[]> | null>(null)
  const dragStartContainerRef = useRef<ContainerId | null>(null)
  const lastDraftSignatureRef = useRef<string | null>(null)
  const sectionOrderSnapshotRef = useRef<string[] | null>(null)
  const lastSectionDraftSignatureRef = useRef<string | null>(null)

  const openItemsByContainerRef = useRef(openItemsByContainer)
  useEffect(() => {
    openItemsByContainerRef.current = openItemsByContainer
  }, [openItemsByContainer])

  useEffect(() => {
    if (activeSectionId) return
    const nextOrder = sections.map((s) => s.id)
    setOrderedSectionIds((prev) => {
      if (prev.length === nextOrder.length && prev.every((id, index) => id === nextOrder[index])) {
        return prev
      }
      return nextOrder
    })
  }, [activeSectionId, sections])

  useEffect(() => {
    if (activeTaskId || activeSectionId) return
    setOpenItemsByContainer(deriveOpenItemsByContainer({ projectId, sections: orderedSections, openTasks }))
  }, [activeSectionId, activeTaskId, openTasks, orderedSections, projectId])

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const activeType = args.active.data.current?.type
      // Prefer dropping onto section headers (container ids) when the pointer is within.
      const pointerCollisions = pointerWithin(args)

      if (activeType === 'section') {
        const sectionHits = pointerCollisions.filter(
          (c) => typeof c.id === 'string' && isProjectSectionDragId(String(c.id))
        )
        if (sectionHits.length > 0) return sectionHits

        const closestSectionHits = closestCenter(args).filter(
          (c) => typeof c.id === 'string' && isProjectSectionDragId(String(c.id))
        )
        if (closestSectionHits.length > 0) return closestSectionHits
      }

      const headerHits = pointerCollisions.filter((c) => typeof c.id === 'string' && c.id.startsWith('project:'))
      if (headerHits.length > 0) return headerHits

      if (pointerCollisions.length > 0) return pointerCollisions

      return closestCenter(args)
    },
    []
  )

  const containerByTaskId = useMemo(() => {
    const m = new Map<string, ContainerId>()
    for (const [containerId, ids] of Object.entries(openItemsByContainer)) {
      for (const id of ids) m.set(id, containerId)
    }
    return m
  }, [openItemsByContainer])

  const containerByTaskIdRef = useRef(containerByTaskId)
  useEffect(() => {
    containerByTaskIdRef.current = containerByTaskId
  }, [containerByTaskId])

  function findContainerForIdInDrag(id: string): ContainerId | null {
    if (isProjectContainerId(id)) return id
    if (isProjectTailId(id)) return containerIdFromTailId(id)
    return containerByTaskIdRef.current.get(id) ?? null
  }

  function cloneItemsByContainer(m: Record<ContainerId, string[]>): Record<ContainerId, string[]> {
    const out: Record<ContainerId, string[]> = {}
    for (const [k, v] of Object.entries(m)) out[k] = [...v]
    return out
  }

  async function persistReorder(containerId: ContainerId, orderedTaskIds: string[]) {
    const res = await window.api.task.reorderBatch(containerId, orderedTaskIds)
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`)
  }

  async function persistSectionReorder(nextOrderedSectionIds: string[]) {
    const res = await window.api.project.reorderSections(projectId, nextOrderedSectionIds)
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`)
  }

  function handleDragStart(e: DragStartEvent) {
    const activeId = String(e.active.id)
    const dragType = e.active.data.current?.type
    cancelPendingDropTimers()

    if (dragType === 'section') {
      const sectionId = sectionIdFromDragOrContainerId(activeId)
      if (!sectionId) return

      setActiveSectionId(sectionId)
      setActiveTaskId(null)
      sectionOrderSnapshotRef.current = [...orderedSectionIdsRef.current]
      lastSectionDraftSignatureRef.current = null
      setSelectedRow({ type: 'group', sectionId })
      selectTask(null)
      return
    }

    setActiveTaskId(activeId)
    setActiveSectionId(null)
    dragSnapshotRef.current = cloneItemsByContainer(openItemsByContainerRef.current)
    dragStartContainerRef.current = findContainerForIdInDrag(activeId)
    lastDraftSignatureRef.current = null
    selectTask(activeId)
  }

  function handleDragOver(e: DragOverEvent) {
    const activeId = String(e.active.id)
    const overId = e.over?.id ? String(e.over.id) : null
    if (!overId) return

    const dragType = e.active.data.current?.type
    if (dragType === 'section') {
      const activeSectionIdFromDrag = sectionIdFromDragOrContainerId(activeId)
      const overSectionId = sectionIdFromDragOrContainerId(overId)
      if (!activeSectionIdFromDrag || !overSectionId || activeSectionIdFromDrag === overSectionId) return

      const draft = orderedSectionIdsRef.current
      const from = draft.indexOf(activeSectionIdFromDrag)
      const to = draft.indexOf(overSectionId)
      if (from < 0 || to < 0 || from === to) return

      const sig = `${activeSectionIdFromDrag}|${overSectionId}|${from}|${to}`
      if (lastSectionDraftSignatureRef.current === sig) return
      lastSectionDraftSignatureRef.current = sig

      setOrderedSectionIds((prev) => {
        const curFrom = prev.indexOf(activeSectionIdFromDrag)
        const curTo = prev.indexOf(overSectionId)
        if (curFrom < 0 || curTo < 0 || curFrom === curTo) return prev

        const next = arrayMove(prev, curFrom, curTo)
        orderedSectionIdsRef.current = next
        return next
      })
      return
    }

    const src = findContainerForIdInDrag(activeId)
    const dest = findContainerForIdInDrag(overId)
    if (!src || !dest) return

    // If the pointer is on the current container header, don't force a jump-to-top.
    if (src === dest && isProjectContainerId(overId)) return

    // Use the current draft map to compute indices, so reflow stays stable.
    const draft = openItemsByContainerRef.current

    if (src === dest) {
      if (isProjectContainerId(overId)) return

      const items = draft[src] ?? []
      const from = items.indexOf(activeId)
      if (from < 0) return

      const isTailOver = isProjectTailId(overId)
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
    if (isProjectContainerId(overId)) {
      insertIndex = 0
    } else if (isProjectTailId(overId)) {
      insertIndex = destItems.length
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
      containerByTaskIdRef.current.set(activeId, dest)
      return next
    })
  }

  async function handleDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id)
    const overId = e.over?.id ? String(e.over.id) : null
    const dragType = e.active.data.current?.type

    if (dragType === 'section') {
      const activeSectionIdFromDrag = sectionIdFromDragOrContainerId(activeId)
      if (!activeSectionIdFromDrag) return

      scheduleClearActiveSectionIdAfterDrop(activeSectionIdFromDrag)
      const snapshot = sectionOrderSnapshotRef.current
      sectionOrderSnapshotRef.current = null
      lastSectionDraftSignatureRef.current = null

      if (!overId) {
        if (snapshot) {
          setOrderedSectionIds(snapshot)
          orderedSectionIdsRef.current = snapshot
        }
        return
      }

      const nextOrder = orderedSectionIdsRef.current
      if (snapshot && snapshot.length === nextOrder.length && snapshot.every((id, i) => id === nextOrder[i])) {
        return
      }

      try {
        await persistSectionReorder(nextOrder)
        await onAfterReorder?.()
      } catch (err) {
        if (snapshot) {
          setOrderedSectionIds(snapshot)
          orderedSectionIdsRef.current = snapshot
        }
        throw err
      }
      return
    }

    scheduleClearActiveTaskIdAfterDrop(activeId)

    const snapshot = dragSnapshotRef.current
    dragSnapshotRef.current = null
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
        await persistReorder(fromContainer, nextFrom)
        await onAfterReorder?.()
        return
      }

      const destSectionId = sectionIdFromProjectContainerId(toContainer)
      const updated = await window.api.task.update({ id: activeId, section_id: destSectionId })
      if (!updated.ok) throw new Error(`${updated.error.code}: ${updated.error.message}`)

      await Promise.all([persistReorder(fromContainer, nextFrom), persistReorder(toContainer, nextTo)])
      await onAfterReorder?.()
    } catch (err) {
      if (snapshot) {
        setOpenItemsByContainer(snapshot)
        openItemsByContainerRef.current = snapshot
      }
      throw err
    }
  }

  function handleDragCancel(_e: DragCancelEvent) {
    cancelPendingDropTimers()

    if (activeSectionId) {
      setActiveSectionId(null)
      lastSectionDraftSignatureRef.current = null

      const sectionSnapshot = sectionOrderSnapshotRef.current
      sectionOrderSnapshotRef.current = null
      if (sectionSnapshot) {
        setOrderedSectionIds(sectionSnapshot)
        orderedSectionIdsRef.current = sectionSnapshot
      }
    }

    setActiveTaskId(null)
    lastDraftSignatureRef.current = null
    dragStartContainerRef.current = null
    if (dragSnapshotRef.current) {
      setOpenItemsByContainer(dragSnapshotRef.current)
      openItemsByContainerRef.current = dragSnapshotRef.current
    }
    dragSnapshotRef.current = null
  }

  const activeTask = useMemo(() => {
    if (!activeTaskId) return null
    return openTasks.find((t) => t.id === activeTaskId) ?? null
  }, [activeTaskId, openTasks])

  const activeSection = useMemo(() => {
    if (!activeSectionId) return null
    const section = sections.find((s) => s.id === activeSectionId)
    if (!section) return null

    return { section }
  }, [activeSectionId, sections])

  const listboxRef = useRef<HTMLDivElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  const editTitleInputRef = useRef<HTMLInputElement | null>(null)
  const [editTitleDraft, setEditTitleDraft] = useState('')
  const lastEditingSectionIdRef = useRef<string | null>(null)

  const [selectedRow, setSelectedRow] = useState<SelectedRow>(null)
  const pendingScrollTaskIdRef = useRef<string | null>(null)

  useLayoutEffect(() => {
    let cancelled = false

    const compute = () => {
      if (cancelled) return
      const se = contentScrollRef.current
      const le = listboxRef.current
      if (!se || !le) {
        window.setTimeout(compute, 0)
        return
      }

      const scrollRect = se.getBoundingClientRect()
      const listRect = le.getBoundingClientRect()
      setScrollMargin(listRect.top - scrollRect.top + se.scrollTop)
    }

    compute()
    window.addEventListener('resize', compute)
    return () => {
      cancelled = true
      window.removeEventListener('resize', compute)
    }
  }, [contentScrollRef])

  const { rows, taskRowIndexById, groupRowIndexBySectionId } = useMemo(() => {
    const rows: Row[] = []
    const taskRowIndexById = new Map<string, number>()
    const groupRowIndexBySectionId = new Map<string, number>()

    const openById = new Map<string, TaskListItem>()
    for (const t of openTasks) openById.set(t.id, t)

    const doneBySection = new Map<string, TaskListItem[]>()
    const doneNone: TaskListItem[] = []
    if (doneTasks) {
      for (const t of doneTasks) {
        if (!t.section_id) doneNone.push(t)
        else {
          const list = doneBySection.get(t.section_id) ?? []
          list.push(t)
          doneBySection.set(t.section_id, list)
        }
      }
      doneNone.sort(sortByRankThenCreated)
      for (const list of doneBySection.values()) list.sort(sortByRankThenCreated)
    }

    function pushOpenTasks(openIds: string[]) {
      for (let i = 0; i <= openIds.length; i++) {
        if (i === openIds.length) break

        const id = openIds[i]
        if (!id) continue
        const task = openById.get(id)
        if (!task) continue
        taskRowIndexById.set(task.id, rows.length)
        rows.push({ type: 'task', task })
      }
    }

    const noneContainerId = taskListIdProject(projectId, null)
    const openNoneIds = openItemsByContainer[noneContainerId] ?? []
    pushOpenTasks(openNoneIds)
    if (doneTasks) {
      for (const task of doneNone) {
        taskRowIndexById.set(task.id, rows.length)
        rows.push({ type: 'task', task })
      }
    }

    // Sections (including empty).
    for (const s of orderedSections) {
      const containerId = taskListIdProject(projectId, s.id)
      const openIds = openItemsByContainer[containerId] ?? []
      const done = doneTasks ? doneBySection.get(s.id) ?? [] : null
      const isActiveDraggedSection = activeSectionId === s.id

      const groupIndex = rows.length
      rows.push({
        type: 'group',
        key: `g:${s.id}`,
        title: s.title,
        sectionId: s.id,
      })
      groupRowIndexBySectionId.set(s.id, groupIndex)

      // While dragging a section header, hide that section's task rows so only the
      // section-level overlay represents the dragged group.
      if (!isActiveDraggedSection) {
        pushOpenTasks(openIds)
        if (doneTasks && done) {
          for (const task of done) {
            taskRowIndexById.set(task.id, rows.length)
            rows.push({ type: 'task', task })
          }
        }
      }
    }

    return { rows, taskRowIndexById, groupRowIndexBySectionId }
  }, [activeSectionId, doneTasks, openItemsByContainer, openTasks, orderedSections, projectId])

  const selectedRowIndex = useMemo(() => {
    if (!selectedRow) return null
    if (selectedRow.type === 'task') return taskRowIndexById.get(selectedRow.taskId) ?? null
    return groupRowIndexBySectionId.get(selectedRow.sectionId) ?? null
  }, [groupRowIndexBySectionId, selectedRow, taskRowIndexById])

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedRow(null)
    }
  }, [rows.length])

  useEffect(() => {
    if (!selectedTaskId) return
    setSelectedRow({ type: 'task', taskId: selectedTaskId })
  }, [selectedTaskId])

  useEffect(() => {
    if (!selectedRow || selectedRow.type !== 'group') return
    if (groupRowIndexBySectionId.get(selectedRow.sectionId) !== undefined) return
    setSelectedRow(null)
  }, [groupRowIndexBySectionId, selectedRow])

  useLayoutEffect(() => {
    if (!editingSectionId) {
      lastEditingSectionIdRef.current = null
      return
    }
    if (lastEditingSectionIdRef.current === editingSectionId) return
    lastEditingSectionIdRef.current = editingSectionId

    const current = sections.find((s) => s.id === editingSectionId)?.title ?? ''
    setEditTitleDraft(current)
  }, [editingSectionId, sections])

  const lastSelectedIndexRef = useRef(0)
  useLayoutEffect(() => {
    if (!selectedTaskId) return

    const idx = taskRowIndexById.get(selectedTaskId) ?? -1
    if (idx >= 0) {
      lastSelectedIndexRef.current = idx
      return
    }

    const visibleTasks = rows.filter((r) => r.type === 'task')
    if (visibleTasks.length === 0) {
      selectTask(null)
      return
    }

    const fallbackIdx = Math.min(lastSelectedIndexRef.current, rows.length - 1)
    // Find the nearest task row at/after fallbackIdx.
    for (let i = fallbackIdx; i < rows.length; i++) {
      const r = rows[i]
      if (r?.type !== 'task') continue
      selectTask(r.task.id)
      return
    }
    // Otherwise pick the last task row.
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i]
      if (r?.type !== 'task') continue
      selectTask(r.task.id)
      return
    }
  }, [rows, selectedTaskId, selectTask, taskRowIndexById])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => contentScrollRef.current,
    estimateSize: (index) => {
      const row = rows[index]
      if (!row) return 44
      if (row.type === 'group') return 34
      return openTaskId && row.task.id === openTaskId ? 400 : 44
    },
    scrollMargin,
    overscan: 12,
    getItemKey: (index) => {
      const row = rows[index]
      if (!row) return index
      if (row.type === 'group') return row.key
      return `t:${row.task.id}`
    },
  })

  useLayoutEffect(() => {
    const taskId = pendingScrollTaskIdRef.current
    if (!taskId) return
    const idx = taskRowIndexById.get(taskId)
    if (idx !== undefined) rowVirtualizer.scrollToIndex(idx)
    pendingScrollTaskIdRef.current = null
  }, [rowVirtualizer, taskRowIndexById])

  useLayoutEffect(() => {
    if (!editingSectionId) return
    const idx = groupRowIndexBySectionId.get(editingSectionId)
    if (idx === undefined) return

    rowVirtualizer.scrollToIndex(idx)
    const raf = window.requestAnimationFrame(() => {
      const input = editTitleInputRef.current
      if (!input) return
      input.focus()
      const caretPos = input.value.length
      input.setSelectionRange(caretPos, caretPos)
    })
    return () => window.cancelAnimationFrame(raf)
  }, [editingSectionId, groupRowIndexBySectionId, rowVirtualizer])

  const selectRowByIndex = useCallback(
    (index: number) => {
      const row = rows[index]
      if (!row) return

      if (row.type === 'task') {
        setSelectedRow({ type: 'task', taskId: row.task.id })
        selectTask(row.task.id)
        rowVirtualizer.scrollToIndex(index)
        return
      }

      const sectionId = row.type === 'group' ? row.sectionId : null
      if (!sectionId) return
      setSelectedRow({ type: 'group', sectionId })
      selectTask(null)
      rowVirtualizer.scrollToIndex(index)
    },
    [rowVirtualizer, rows, selectTask]
  )

  function moveSelection(dir: -1 | 1) {
    if (rows.length === 0) return
    const currentIndex = selectedRowIndex ?? -1
    const start = currentIndex < 0 ? (dir === 1 ? -1 : rows.length) : currentIndex
    const next = start + dir
    if (next < 0 || next >= rows.length) return
    selectRowByIndex(next)
  }

  async function enterSectionTitleEdit(sectionId: string) {
    const ok = await requestCloseTask()
    if (!ok) return
    onStartSectionTitleEdit(sectionId)
  }

  const setEditTitleInputEl = useCallback((el: HTMLInputElement | null) => {
    editTitleInputRef.current = el
  }, [])

  const selectTaskRow = useCallback(
    (taskId: string) => {
      setSelectedRow({ type: 'task', taskId })
      selectTask(taskId)
    },
    [selectTask]
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        ref={listboxRef}
        className="task-scroll"
        tabIndex={0}
        role="listbox"
        aria-label="Project tasks"
        onKeyDown={(e) => {
          const isReorderChord =
            (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')

          if (isReorderChord) {
            if (activeTaskId || activeSectionId) return
            if (e.target instanceof HTMLElement) {
              if (e.target.isContentEditable) return
              const tag = e.target.tagName
              if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
              if (e.target.closest('[role="textbox"], [contenteditable="true"]')) return
            }

            if (!selectedRow) return

            if (selectedRow.type === 'group') {
              const sectionId = selectedRow.sectionId
              const prev = orderedSectionIds
              const from = prev.indexOf(sectionId)
              if (from < 0) return

              const dir = e.key === 'ArrowUp' ? -1 : 1
              const to = from + dir
              if (to < 0 || to >= prev.length) return

              e.preventDefault()

              const next = arrayMove(prev, from, to)
              setOrderedSectionIds(next)
              orderedSectionIdsRef.current = next
              void (async () => {
                try {
                  await persistSectionReorder(next)
                  await onAfterReorder?.()
                } catch (err) {
                  setOrderedSectionIds(prev)
                  orderedSectionIdsRef.current = prev
                  throw err
                }
              })()
              return
            }

            const taskId = selectedRow.taskId
            const containerId = containerByTaskId.get(taskId)
            if (!containerId) return

            const prev = openItemsByContainer[containerId] ?? []
            const from = prev.indexOf(taskId)
            if (from < 0) return

            const dir = e.key === 'ArrowUp' ? -1 : 1
            const to = from + dir
            if (to < 0 || to >= prev.length) return

            e.preventDefault()

            const next = [...prev]
            next.splice(from, 1)
            next.splice(to, 0, taskId)
            pendingScrollTaskIdRef.current = taskId
            setOpenItemsByContainer((m) => ({ ...m, [containerId]: next }))
            void (async () => {
              try {
                await persistReorder(containerId, next)
                await onAfterReorder?.()
              } catch (err) {
                setOpenItemsByContainer((m) => ({ ...m, [containerId]: prev }))
                throw err
              }
            })()
            return
          }

          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter' && e.key !== ' ') return

          if (e.key === 'ArrowDown') {
            e.preventDefault()
            moveSelection(1)
            return
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault()
            moveSelection(-1)
            return
          }

          if (e.key === ' ') {
            e.preventDefault()
            if (!selectedRow || selectedRow.type !== 'task') return
            const idx = taskRowIndexById.get(selectedRow.taskId)
            const row = idx !== undefined ? rows[idx] : null
            if (!row || row.type !== 'task') return
            void onToggleDone(row.task.id, row.task.status !== 'done')
            return
          }

          if (e.key === 'Enter') {
            e.preventDefault()
            if (!selectedRow) return

            if (selectedRow.type === 'task') {
              void openTask(selectedRow.taskId)
              return
            }

            void enterSectionTitleEdit(selectedRow.sectionId)
          }
        }}
      >
        <ul className="task-list" style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          <NoSectionDropZone containerId={noSectionContainerId} />
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            if (!row) return null

            const translateY = virtualRow.start - rowVirtualizer.options.scrollMargin

            if (row.type === 'group') {
              const sectionId = row.sectionId
              if (!sectionId) return null

              const containerId = taskListIdProject(projectId, sectionId)
              const isEditing = sectionId === editingSectionId
              const isSelected = selectedRowIndex === virtualRow.index

              return (
                <ProjectGroupHeaderRow
                  key={row.key}
                  containerId={containerId}
                  sectionId={sectionId}
                  title={row.title}
                  isSelected={isSelected}
                  isDragging={activeSectionId === sectionId}
                  isEditing={isEditing}
                  editTitleDraft={editTitleDraft}
                  setEditTitleDraft={setEditTitleDraft}
                  editTitleInputRef={setEditTitleInputEl}
                  onSelectRow={() => selectRowByIndex(virtualRow.index)}
                  onEnterEdit={() => void enterSectionTitleEdit(sectionId)}
                  onCancelEdit={onCancelSectionTitleEdit}
                  onCommitTitle={(nextTitle) => void onCommitSectionTitle(sectionId, nextTitle)}
                  measureElement={(el) => {
                    if (!el) return
                    rowVirtualizer.measureElement(el)
                  }}
                  index={virtualRow.index}
                  translateY={translateY}
                />
              )
            }

            if (row.type !== 'task') return null

            const t = row.task
            if (openTaskId && t.id === openTaskId) {
              return (
                <li
                  key={t.id}
                  className={`task-row is-open${t.status === 'done' ? ' is-done' : ''}${
                    selectedTaskId === t.id ? ' is-selected' : ''
                  }`}
                  data-task-id={t.id}
                  ref={(el) => {
                    if (!el) return
                    rowVirtualizer.measureElement(el)
                  }}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    visibility: activeTaskId === t.id ? 'hidden' : undefined,
                    transform: `translateY(${translateY}px)`,
                  }}
                >
                  <TaskInlineEditorRow taskId={t.id} />
                </li>
              )
            }

            const isSelected = selectedTaskId === t.id
            const isDragging = activeTaskId === t.id
            const containerId = containerByTaskId.get(t.id) ?? taskListIdProject(projectId, t.section_id)
            const containerItems = openItemsByContainer[containerId] ?? []
            const isOpenTask = t.status === 'open'
            const isLastOpenInContainer =
              isOpenTask && containerItems.length > 0 && containerItems[containerItems.length - 1] === t.id

            return (
              <li
                key={t.id}
                className={`task-row task-row-virtual${t.status === 'done' ? ' is-done' : ''}${
                  isSelected ? ' is-selected' : ''
                }${isDragging ? ' is-dragging' : ''}`}
                data-task-id={t.id}
                ref={(el) => {
                  if (!el) return
                  rowVirtualizer.measureElement(el)
                }}
                data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                visibility: isDragging ? 'hidden' : undefined,
                transform: `translateY(${translateY}px)`,
              }}
            >
                {isOpenTask ? (
                  <SortableContext id={containerId} items={containerItems} strategy={verticalListSortingStrategy}>
                    <SortableProjectTaskRow
                      task={t}
                      onSelect={selectTaskRow}
                      onOpen={(taskId) => void openTask(taskId)}
                      onToggleDone={(taskId, done) => void onToggleDone(taskId, done)}
                      onSelectForDrag={selectTaskRow}
                    />
                    {isLastOpenInContainer ? <ProjectSectionTailDropZone containerId={containerId} /> : null}
                  </SortableContext>
                ) : (
                  <TaskRow
                    task={t}
                    onSelect={selectTaskRow}
                    onOpen={(taskId) => void openTask(taskId)}
                    onToggleDone={(taskId, done) => void onToggleDone(taskId, done)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {activeTaskId || activeSectionId
        ? createPortal(
            <DragOverlay dropAnimation={dropAnimation}>
              {activeSection ? (
                <ProjectSectionDragOverlay title={activeSection.section.title} />
              ) : activeTask ? (
                <div className="task-dnd-overlay">
                  <TaskRow
                    task={activeTask}
                    isOverlay
                  />
                </div>
              ) : null}
            </DragOverlay>,
            document.body
          )
        : null}
    </DndContext>
  )
}
