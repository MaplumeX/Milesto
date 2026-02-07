import { useLayoutEffect, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { TaskListItem } from '../../../shared/schemas/task-list'

import { useTaskSelection } from './TaskSelectionContext'
import { TaskInlineEditorRow } from './TaskInlineEditorRow'
import { TaskRow } from './TaskRow'
import { useContentScrollRef } from '../../app/ContentScrollContext'
import {
  getTaskDropAnimationConfig,
  getTaskDropAnimationDurationMs,
  usePrefersReducedMotion,
} from './dnd-drop-animation'

function SortableTaskRow({
  task,
  isOverlay,
  onSelect,
  onOpen,
  onToggleDone,
  onRestore,
  onSelectForDrag,
}: {
  task: TaskListItem
  isOverlay?: boolean
  onSelect?: (taskId: string) => void
  onOpen?: (taskId: string) => void
  onToggleDone?: (taskId: string, done: boolean) => void
  onRestore?: (taskId: string) => void
  onSelectForDrag?: (taskId: string) => void
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition } = useSortable({
    id: task.id,
  })

  return (
    <TaskRow
      task={task}
      isOverlay={isOverlay}
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
          onSelectForDrag?.(task.id)
          listeners?.onPointerDown?.(e)
        },
      }}
      onSelect={onSelect}
      onOpen={onOpen}
      onToggleDone={onToggleDone}
      onRestore={onRestore}
    />
  )
}

export function TaskList({
  title,
  tasks,
  listId,
  onToggleDone,
  onRestore,
  onAfterReorder,
  headerActions,
}: {
  title: string
  tasks: TaskListItem[]
  // If provided, enables drag-and-drop + keyboard reordering persisted via list_positions.
  listId?: string
  onToggleDone?: (taskId: string, done: boolean) => Promise<void>
  onRestore?: (taskId: string) => Promise<void>
  onAfterReorder?: () => Promise<void>
  headerActions?: React.ReactNode
}) {
  const { selectedTaskId, selectTask, openTask, openTaskId } = useTaskSelection()

  const contentScrollRef = useContentScrollRef()

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const dropAnimation = useMemo(() => getTaskDropAnimationConfig(prefersReducedMotion), [prefersReducedMotion])
  const dropAnimationDurationMs = useMemo(
    () => getTaskDropAnimationDurationMs(prefersReducedMotion),
    [prefersReducedMotion]
  )

  const clearActiveTaskIdTimeoutRef = useRef<number | null>(null)
  const postDropActionTimeoutRef = useRef<number | null>(null)

  const cancelPendingDropTimers = useCallback(() => {
    if (clearActiveTaskIdTimeoutRef.current !== null) {
      window.clearTimeout(clearActiveTaskIdTimeoutRef.current)
      clearActiveTaskIdTimeoutRef.current = null
    }
    if (postDropActionTimeoutRef.current !== null) {
      window.clearTimeout(postDropActionTimeoutRef.current)
      postDropActionTimeoutRef.current = null
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

  function runAfterDropAnimation(fn: () => void) {
    if (dropAnimationDurationMs <= 0) {
      fn()
      return
    }

    if (postDropActionTimeoutRef.current !== null) window.clearTimeout(postDropActionTimeoutRef.current)
    postDropActionTimeoutRef.current = window.setTimeout(() => {
      postDropActionTimeoutRef.current = null
      fn()
    }, dropAnimationDurationMs)
  }

  const [orderedTaskIds, setOrderedTaskIds] = useState<string[]>(() => tasks.map((t) => t.id))
  useEffect(() => {
    // Avoid clobbering the draft ordering while dragging.
    if (activeTaskId) return
    setOrderedTaskIds(tasks.map((t) => t.id))
  }, [activeTaskId, tasks])

  const orderedTaskIdsRef = useRef<string[]>(orderedTaskIds)
  useEffect(() => {
    orderedTaskIdsRef.current = orderedTaskIds
  }, [orderedTaskIds])

  const orderedTasks = useMemo(() => {
    if (orderedTaskIds.length === 0) return tasks
    const byId = new Map<string, TaskListItem>()
    for (const t of tasks) byId.set(t.id, t)

    const out: TaskListItem[] = []
    const seen = new Set<string>()
    for (const id of orderedTaskIds) {
      const t = byId.get(id)
      if (!t) continue
      out.push(t)
      seen.add(id)
    }
    for (const t of tasks) {
      if (seen.has(t.id)) continue
      out.push(t)
    }
    return out
  }, [orderedTaskIds, tasks])

  const taskIndexById = useMemo(() => {
    const map = new Map<string, number>()
    for (let i = 0; i < orderedTasks.length; i++) {
      const t = orderedTasks[i]
      if (!t) continue
      map.set(t.id, i)
    }
    return map
  }, [orderedTasks])

  const listboxRef = useRef<HTMLDivElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  const isDndEnabled = !!listId
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    })
  )
  const dragSnapshotRef = useRef<string[] | null>(null)
  const lastOverIdRef = useRef<string | null>(null)

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) return pointerCollisions
    return closestCenter(args)
  }, [])

  useLayoutEffect(() => {
    let cancelled = false

    const compute = () => {
      if (cancelled) return
      const se = contentScrollRef.current
      const le = listboxRef.current

      // On some mounts (especially during route switches), refs may not be ready
      // on the first layout pass. Retry on the next tick to avoid a stuck 0 margin,
      // which breaks scrollToIndex alignment.
      if (!se || !le) {
        window.setTimeout(compute, 0)
        return
      }

      const scrollRect = se.getBoundingClientRect()
      const listRect = le.getBoundingClientRect()
      // listRect.top changes with scroll; adding scrollTop yields a stable margin.
      setScrollMargin(listRect.top - scrollRect.top + se.scrollTop)
    }

    compute()
    window.addEventListener('resize', compute)
    return () => {
      cancelled = true
      window.removeEventListener('resize', compute)
    }
  }, [contentScrollRef])
  const rowVirtualizer = useVirtualizer({
    count: orderedTasks.length,
    getScrollElement: () => contentScrollRef.current,
    estimateSize: (index) => {
      const t = orderedTasks[index]
      if (!t) return 44
      // Expanded rows are measured, but the estimate should be close to reduce initial jump.
      return openTaskId && t.id === openTaskId ? 400 : 44
    },
    scrollMargin,
    overscan: 12,
    getItemKey: (index) => {
      const t = orderedTasks[index]
      if (!t) return index
      return `t:${t.id}`
    },
  })

  const lastSelectedIndexRef = useRef(0)
  useEffect(() => {
    if (!selectedTaskId) return

    const idx = orderedTasks.findIndex((t) => t.id === selectedTaskId)
    if (idx >= 0) {
      lastSelectedIndexRef.current = idx
      return
    }

    // If the selected task disappeared after a refresh (e.g. moved lists), pick a neighbor.
    if (orderedTasks.length === 0) {
      selectTask(null)
      return
    }

    const fallbackIdx = Math.min(lastSelectedIndexRef.current, orderedTasks.length - 1)
    const fallback = orderedTasks[fallbackIdx]
    selectTask(fallback?.id ?? null)
  }, [orderedTasks, selectedTaskId, selectTask])

  async function persistOrder(next: string[]) {
    if (!listId) return
    const res = await window.api.task.reorderBatch(listId, next)
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`)
    await onAfterReorder?.()
  }

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id)
    cancelPendingDropTimers()
    setActiveTaskId(id)
    dragSnapshotRef.current = orderedTaskIdsRef.current
    lastOverIdRef.current = null
    selectTask(id)
  }

  function handleDragOver(e: DragOverEvent) {
    const activeId = String(e.active.id)
    const overId = e.over?.id ? String(e.over.id) : null
    if (!overId || activeId === overId) return
    if (lastOverIdRef.current === overId) return

    setOrderedTaskIds((prev) => {
      const activeIndex = prev.indexOf(activeId)
      const overIndex = prev.indexOf(overId)
      if (activeIndex === -1 || overIndex === -1) return prev
      if (activeIndex === overIndex) return prev

      const next = arrayMove(prev, activeIndex, overIndex)
      orderedTaskIdsRef.current = next
      lastOverIdRef.current = overId
      return next
    })
  }

  async function handleDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id)
    const overId = e.over?.id ? String(e.over.id) : null
    scheduleClearActiveTaskIdAfterDrop(activeId)
    lastOverIdRef.current = null

    const snapshot = dragSnapshotRef.current
    dragSnapshotRef.current = null

    const next = orderedTaskIdsRef.current
    // Only revert when dropped outside any sortable target.
    // If `overId === activeId`, dnd-kit often reports the active item itself on drop;
    // we still want to persist if the order changed during drag.
    if (!overId) {
      if (snapshot) setOrderedTaskIds(snapshot)
      return
    }

    if (snapshot && snapshot.length === next.length && snapshot.every((id, i) => id === next[i])) {
      return
    }

    try {
      await persistOrder(next)
    } catch (err) {
      if (snapshot) setOrderedTaskIds(snapshot)
      throw err
    }

    const nextIndex = next.indexOf(activeId)
    if (nextIndex >= 0) {
      const virtualItems = rowVirtualizer.getVirtualItems()
      const firstVisibleIndex = virtualItems[0]?.index ?? 0
      const lastVisibleIndex = virtualItems[virtualItems.length - 1]?.index ?? 0
      const shouldScroll = nextIndex < firstVisibleIndex || nextIndex > lastVisibleIndex
      if (shouldScroll) runAfterDropAnimation(() => rowVirtualizer.scrollToIndex(nextIndex))
    }
  }

  function handleDragCancel(_e: DragCancelEvent) {
    cancelPendingDropTimers()
    setActiveTaskId(null)
    lastOverIdRef.current = null

    const snapshot = dragSnapshotRef.current
    dragSnapshotRef.current = null
    if (snapshot) setOrderedTaskIds(snapshot)
  }

  const activeTask = useMemo(() => {
    if (!activeTaskId) return null
    return orderedTasks.find((t) => t.id === activeTaskId) ?? null
  }, [activeTaskId, orderedTasks])

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{title}</h1>
        <div className="row" style={{ marginTop: 0 }}>
          {headerActions}
        </div>
      </header>

      <DndContext
        sensors={isDndEnabled ? sensors : undefined}
        collisionDetection={collisionDetection}
        onDragStart={isDndEnabled ? handleDragStart : undefined}
        onDragOver={isDndEnabled ? handleDragOver : undefined}
        onDragEnd={isDndEnabled ? handleDragEnd : undefined}
        onDragCancel={isDndEnabled ? handleDragCancel : undefined}
      >
        <div
          ref={listboxRef}
          className="task-scroll"
          tabIndex={0}
          role="listbox"
          aria-label="Tasks"
          onKeyDown={(e) => {
            // Keyboard-first list navigation (ArrowUp/Down, Enter to open, Space to toggle).
            const isReorderChord = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')

            if (isReorderChord && e.target instanceof HTMLElement) {
              const tag = e.target.tagName
              // Don't steal text selection / cursor movement shortcuts from inputs.
              if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return
            }
            if (
              e.key !== 'ArrowDown' &&
              e.key !== 'ArrowUp' &&
              e.key !== 'Enter' &&
              e.key !== ' ' &&
              !isReorderChord
            )
              return

            const idx = selectedTaskId ? taskIndexById.get(selectedTaskId) ?? -1 : -1

            if (isReorderChord && listId && selectedTaskId) {
              e.preventDefault()
              const dir = e.key === 'ArrowUp' ? -1 : 1
              const prev = orderedTaskIds
              const from = prev.indexOf(selectedTaskId)
              const to = from + dir
              if (from < 0 || to < 0 || to >= prev.length) return
              const next = arrayMove(prev, from, to)
              setOrderedTaskIds(next)
              void (async () => {
                try {
                  await persistOrder(next)
                } catch (err) {
                  setOrderedTaskIds(prev)
                  throw err
                }
                rowVirtualizer.scrollToIndex(to)
              })()
              return
            }

            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (orderedTasks.length === 0) return
              const nextIdx = Math.min((idx < 0 ? -1 : idx) + 1, orderedTasks.length - 1)
              const next = orderedTasks[nextIdx]
              if (!next) return
              selectTask(next.id)
              rowVirtualizer.scrollToIndex(nextIdx)
              return
            }

            if (e.key === 'ArrowUp') {
              e.preventDefault()
              if (orderedTasks.length === 0) return
              const nextIdx = Math.max(idx <= 0 ? 0 : idx - 1, 0)
              const next = orderedTasks[nextIdx]
              if (!next) return
              selectTask(next.id)
              rowVirtualizer.scrollToIndex(nextIdx)
              return
            }

            if (e.key === ' ') {
              e.preventDefault()
              if (!selectedTaskId || !onToggleDone) return
              const current = orderedTasks.find((t) => t.id === selectedTaskId)
              if (!current) return
              void onToggleDone(current.id, current.status !== 'done')
              return
            }

            if (e.key === 'Enter') {
              e.preventDefault()
              if (!selectedTaskId) return
              void openTask(selectedTaskId)
            }
          }}
        >
          <SortableContext items={isDndEnabled ? orderedTaskIds : []} strategy={verticalListSortingStrategy}>
            <ul className="task-list" style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const t = orderedTasks[virtualRow.index]
                if (!t) return null

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
                        transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                      }}
                    >
                      <TaskInlineEditorRow taskId={t.id} />
                    </li>
                  )
                }

                return (
                  <li
                    key={t.id}
                    className={`task-row task-row-virtual${t.status === 'done' ? ' is-done' : ''}${
                      selectedTaskId === t.id ? ' is-selected' : ''
                    }${activeTaskId === t.id ? ' is-dragging' : ''}`}
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
                      transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                    }}
                  >
                    {isDndEnabled ? (
                      <SortableTaskRow
                        task={t}
                        onSelect={(taskId) => selectTask(taskId)}
                        onOpen={(taskId) => openTask(taskId)}
                        onToggleDone={(taskId, done) => {
                          if (onToggleDone) void onToggleDone(taskId, done)
                        }}
                        onRestore={(taskId) => {
                          if (onRestore) void onRestore(taskId)
                        }}
                        onSelectForDrag={(taskId) => selectTask(taskId)}
                      />
                    ) : (
                      <TaskRow
                        task={t}
                        onSelect={(taskId) => selectTask(taskId)}
                        onOpen={(taskId) => openTask(taskId)}
                        onToggleDone={(taskId, done) => {
                          if (onToggleDone) void onToggleDone(taskId, done)
                        }}
                        onRestore={(taskId) => {
                          if (onRestore) void onRestore(taskId)
                        }}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </SortableContext>
        </div>

        {isDndEnabled && activeTaskId
          ? createPortal(
              <DragOverlay dropAnimation={dropAnimation}>
                {activeTask ? (
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
    </div>
  )
}
