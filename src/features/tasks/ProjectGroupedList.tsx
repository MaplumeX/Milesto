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

type Row =
  | {
      type: 'group'
      key: string
      title: string
      sectionId: string | null
      openCount: number
      doneCount: number | null
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
type ProjectedDrop = {
  overId: string
  src: ContainerId
  dest: ContainerId
  index: number
  placement: 'before' | 'after'
} | null

function NoSectionDropZone({
  containerId,
}: {
  containerId: ContainerId
}) {
  // Invisible hit area at the very top of the list content.
  // This enables dropping into no-section without introducing a visible group header.
  const { setNodeRef, isOver } = useDroppable({
    id: containerId,
    data: { type: 'container', containerId },
  })

  return (
    <div
      ref={setNodeRef}
      className="project-no-section-dropzone"
      data-drop-over={isOver ? 'true' : 'false'}
      aria-hidden="true"
    />
  )
}

function isProjectContainerId(id: string): boolean {
  return id.startsWith('project:')
}

function sectionIdFromProjectContainerId(containerId: string): string | null {
  // Format: project:<projectId>:<sectionId|none>
  const parts = containerId.split(':')
  const sectionPart = parts[2]
  if (!sectionPart || sectionPart === 'none') return null
  return sectionPart
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
  openCount,
  doneCount,
  isSelected,
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
  openCount: number
  doneCount: number | null
  isSelected: boolean
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
  const { setNodeRef, isOver } = useDroppable({
    id: containerId,
    data: { type: 'container', containerId },
  })

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
        ref={setNodeRef}
        className={`project-group-header${isSelected ? ' is-selected' : ''}${isOver ? ' is-drop-over' : ''}`}
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
            <div className="project-group-meta">
              {openCount} open
              {doneCount !== null ? ` · ${doneCount} done` : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="project-group-left project-group-left-button"
            onClick={onSelectRow}
            onDoubleClick={() => {
              onSelectRow()
              onEnterEdit()
            }}
          >
            <div className={`project-group-title${title.trim() ? '' : ' is-placeholder'}`}>
              {title.trim() ? title : '(untitled)'}
            </div>
            <div className="project-group-meta">
              {openCount} open
              {doneCount !== null ? ` · ${doneCount} done` : null}
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
  dropIndicator,
  onSelect,
  onOpen,
  onToggleDone,
  onSelectForDrag,
}: {
  task: TaskListItem
  dropIndicator?: 'before' | 'after'
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
      dropIndicator={dropIndicator}
      innerRef={setNodeRef}
      innerStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      dragHandle={
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="task-dnd-handle"
          aria-label="Reorder"
          {...attributes}
          {...(listeners ?? {})}
          tabIndex={-1}
          onPointerDown={() => onSelectForDrag(task.id)}
        >
          <span className="task-dnd-grip" aria-hidden="true" />
        </button>
      }
      onSelect={onSelect}
      onOpen={onOpen}
      onToggleDone={onToggleDone}
    />
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

  const [openItemsByContainer, setOpenItemsByContainer] = useState<Record<ContainerId, string[]>>(() =>
    deriveOpenItemsByContainer({ projectId, sections, openTasks })
  )

  const noSectionContainerId = useMemo(() => taskListIdProject(projectId, null), [projectId])

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [projectedDrop, setProjectedDrop] = useState<ProjectedDrop>(null)
  const projectedDropRef = useRef<ProjectedDrop>(null)
  const dragSnapshotRef = useRef<Record<ContainerId, string[]> | null>(null)

  useEffect(() => {
    if (activeTaskId) return
    setOpenItemsByContainer(deriveOpenItemsByContainer({ projectId, sections, openTasks }))
  }, [activeTaskId, openTasks, projectId, sections])

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      // Prefer dropping onto section headers (container ids) when the pointer is within.
      const pointerCollisions = pointerWithin(args)
      const headerHits = pointerCollisions.filter((c) => typeof c.id === 'string' && c.id.startsWith('project:'))
      if (headerHits.length > 0) return headerHits
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

  const findContainerForId = useCallback(
    (id: string): ContainerId | null => {
      if (isProjectContainerId(id)) return id
      return containerByTaskId.get(id) ?? null
    },
    [containerByTaskId]
  )

  async function persistReorder(containerId: ContainerId, orderedTaskIds: string[]) {
    const res = await window.api.task.reorderBatch(containerId, orderedTaskIds)
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`)
  }

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id)
    setActiveTaskId(id)
    dragSnapshotRef.current = openItemsByContainer
    projectedDropRef.current = null
    setProjectedDrop(null)
    selectTask(id)
  }

  function handleDragOver(e: DragOverEvent) {
    const activeId = String(e.active.id)
    const overId = e.over?.id ? String(e.over.id) : null
    if (!overId) {
      projectedDropRef.current = null
      setProjectedDrop(null)
      return
    }

    const src = findContainerForId(activeId)
    const dest = findContainerForId(overId)
    if (!src || !dest) {
      projectedDropRef.current = null
      setProjectedDrop(null)
      return
    }

    if (isProjectContainerId(overId)) {
      const proj: ProjectedDrop = { overId, src, dest, index: 0, placement: 'before' }
      projectedDropRef.current = proj
      setProjectedDrop(proj)
      return
    }

    const destItems = openItemsByContainer[dest] ?? []
    const overIndex = destItems.indexOf(overId)
    if (overIndex < 0) {
      projectedDropRef.current = null
      setProjectedDrop(null)
      return
    }

    // Keep same-container reordering semantics aligned with dnd-kit sortable transforms.
    // dnd-kit effectively uses `arrayMove(items, activeIndex, overIndex)` for same-container sorting,
    // which implicitly handles before/after based on move direction.
    if (src === dest) {
      const srcItems = openItemsByContainer[src] ?? []
      const activeIndex = srcItems.indexOf(activeId)
      const placement: 'before' | 'after' = activeIndex >= 0 && activeIndex < overIndex ? 'after' : 'before'
      const proj: ProjectedDrop = { overId, src, dest, index: overIndex, placement }
      projectedDropRef.current = proj
      setProjectedDrop(proj)
      return
    }

    const overMid = e.over!.rect.top + e.over!.rect.height / 2
    const activeTop = e.active.rect.current.translated?.top ?? e.active.rect.current.initial?.top ?? 0
    const isAfter = activeTop > overMid

    const index = Math.max(0, Math.min(overIndex + (isAfter ? 1 : 0), destItems.length))
    const proj: ProjectedDrop = { overId, src, dest, index, placement: isAfter ? 'after' : 'before' }
    projectedDropRef.current = proj
    setProjectedDrop(proj)
  }

  async function handleDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id)
    const overId = e.over?.id ? String(e.over.id) : null

    const proj = projectedDropRef.current

    setActiveTaskId(null)
    setProjectedDrop(null)
    projectedDropRef.current = null

    if (!overId) {
      if (dragSnapshotRef.current) setOpenItemsByContainer(dragSnapshotRef.current)
      return
    }

    const src = findContainerForId(activeId)
    const dest = findContainerForId(overId)
    if (!src || !dest) {
      if (dragSnapshotRef.current) setOpenItemsByContainer(dragSnapshotRef.current)
      return
    }

    const srcItems = openItemsByContainer[src] ?? []
    const destItems = openItemsByContainer[dest] ?? []
    const fromIndex = srcItems.indexOf(activeId)
    if (fromIndex < 0) return

    // Determine the insertion index in the destination list.
    let rawIndex = 0
    if (proj && proj.src === src && proj.dest === dest) rawIndex = proj.index
    else if (!isProjectContainerId(overId)) {
      const fallback = destItems.indexOf(overId)
      rawIndex = fallback >= 0 ? fallback : 0
    }

    const snapshot = dragSnapshotRef.current
    try {
      if (src === dest) {
        const toIndex = isProjectContainerId(overId) ? 0 : srcItems.indexOf(overId)
        if (toIndex < 0) return

        const next = arrayMove(srcItems, fromIndex, toIndex)
        setOpenItemsByContainer((prev) => ({ ...prev, [src]: next }))
        await persistReorder(src, next)
        await onAfterReorder?.()
        return
      }

      const nextSrc = srcItems.filter((id) => id !== activeId)
      const insertIndex = Math.max(0, Math.min(rawIndex, destItems.length))
      const nextDest = [...destItems]
      nextDest.splice(insertIndex, 0, activeId)

      setOpenItemsByContainer((prev) => ({ ...prev, [src]: nextSrc, [dest]: nextDest }))

      const destSectionId = sectionIdFromProjectContainerId(dest)
      const updated = await window.api.task.update({ id: activeId, section_id: destSectionId })
      if (!updated.ok) throw new Error(`${updated.error.code}: ${updated.error.message}`)

      await Promise.all([persistReorder(src, nextSrc), persistReorder(dest, nextDest)])
      await onAfterReorder?.()
    } catch (err) {
      if (snapshot) setOpenItemsByContainer(snapshot)
      throw err
    }
  }

  function handleDragCancel(_e: DragCancelEvent) {
    setActiveTaskId(null)
    setProjectedDrop(null)
    projectedDropRef.current = null
    if (dragSnapshotRef.current) setOpenItemsByContainer(dragSnapshotRef.current)
  }

  const activeTask = useMemo(() => {
    if (!activeTaskId) return null
    return openTasks.find((t) => t.id === activeTaskId) ?? null
  }, [activeTaskId, openTasks])

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

    const noneContainerId = taskListIdProject(projectId, null)
    const openNoneIds = openItemsByContainer[noneContainerId] ?? []
    for (const id of openNoneIds) {
      const task = openById.get(id)
      if (!task) continue
      taskRowIndexById.set(task.id, rows.length)
      rows.push({ type: 'task', task })
    }
    if (doneTasks) {
      for (const task of doneNone) {
        taskRowIndexById.set(task.id, rows.length)
        rows.push({ type: 'task', task })
      }
    }

    // Sections (including empty).
    for (const s of sections) {
      const containerId = taskListIdProject(projectId, s.id)
      const openIds = openItemsByContainer[containerId] ?? []
      const done = doneTasks ? doneBySection.get(s.id) ?? [] : null

      const groupIndex = rows.length
      rows.push({
        type: 'group',
        key: `g:${s.id}`,
        title: s.title,
        sectionId: s.id,
        openCount: openIds.length,
        doneCount: doneTasks ? (done?.length ?? 0) : null,
      })
      groupRowIndexBySectionId.set(s.id, groupIndex)

      for (const id of openIds) {
        const task = openById.get(id)
        if (!task) continue
        taskRowIndexById.set(task.id, rows.length)
        rows.push({ type: 'task', task })
      }
      if (doneTasks && done) {
        for (const task of done) {
          taskRowIndexById.set(task.id, rows.length)
          rows.push({ type: 'task', task })
        }
      }
    }

    return { rows, taskRowIndexById, groupRowIndexBySectionId }
  }, [doneTasks, openItemsByContainer, openTasks, projectId, sections])

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

  useEffect(() => {
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
      editTitleInputRef.current?.focus()
      editTitleInputRef.current?.select()
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

      const sectionId = row.sectionId
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
            if (activeTaskId) return
            if (e.target instanceof HTMLElement) {
              if (e.target.isContentEditable) return
              const tag = e.target.tagName
              if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
              if (e.target.closest('[role="textbox"], [contenteditable="true"]')) return
            }
            if (!selectedRow || selectedRow.type !== 'task') return

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
                  openCount={row.openCount}
                  doneCount={row.doneCount}
                  isSelected={isSelected}
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
                    transform: `translateY(${translateY}px)`,
                  }}
                >
                  <TaskInlineEditorRow taskId={t.id} />
                </li>
              )
            }

            const isSelected = selectedTaskId === t.id
            const isDragging = activeTaskId === t.id
            const indicator = projectedDrop && projectedDrop.overId === t.id ? projectedDrop.placement : undefined

            const containerId = containerByTaskId.get(t.id) ?? taskListIdProject(projectId, t.section_id)
            const containerItems = openItemsByContainer[containerId] ?? []

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
                  transform: `translateY(${translateY}px)`,
                }}
              >
                {t.status === 'open' ? (
                  <SortableContext id={containerId} items={containerItems} strategy={verticalListSortingStrategy}>
                    <SortableProjectTaskRow
                      task={t}
                      dropIndicator={indicator}
                      onSelect={selectTaskRow}
                      onOpen={(taskId) => void openTask(taskId)}
                      onToggleDone={(taskId, done) => void onToggleDone(taskId, done)}
                      onSelectForDrag={selectTaskRow}
                    />
                  </SortableContext>
                ) : (
                  <TaskRow
                    task={t}
                    dropIndicator={indicator}
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

      {activeTask
        ? createPortal(
            <DragOverlay>
              <div className="task-dnd-overlay">
                <TaskRow task={activeTask} isOverlay />
              </div>
            </DragOverlay>,
            document.body
          )
        : null}
    </DndContext>
  )
}
