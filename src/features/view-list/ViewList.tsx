import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, MouseEventHandler, PointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslation } from 'react-i18next'

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type {
  ViewListItem,
  ViewListProjectItem,
  ViewListTaskItem,
  ViewReorderItem,
} from '../../../shared/schemas/view-list'

import { useContentScrollRef } from '../../app/ContentScrollContext'
import { AnimatedTaskSlot } from '../tasks/AnimatedTaskSlot'
import {
  getTaskDropAnimationConfig,
  getTaskDropAnimationDurationMs,
  usePrefersReducedMotion,
} from '../tasks/dnd-drop-animation'
import { TaskInlineEditorRow } from '../tasks/TaskInlineEditorRow'
import { TaskRow } from '../tasks/TaskRow'
import { useOptimisticTaskTitles } from '../tasks/use-optimistic-task-titles'
import { useTaskContextMenu } from '../tasks/use-task-context-menu'
import { useTaskSelection } from '../tasks/TaskSelectionContext'
import { ProjectViewRow } from './ProjectViewRow'

function itemKey(item: Pick<ViewListItem, 'kind' | 'id'>): string {
  return `${item.kind}:${item.id}`
}

function toReorderItem(item: Pick<ViewListItem, 'kind' | 'id'>): ViewReorderItem {
  return { kind: item.kind, id: item.id }
}

function SortableViewRow({
  item,
  isOverlay,
  onSelectTask,
  onOpenTask,
  onSelectProject,
  onOpenProject,
  onToggleTaskDone,
  onCompleteProject,
  onTaskContextMenu,
  onSelectForDrag,
}: {
  item: ViewListItem
  isOverlay?: boolean
  onSelectTask?: (taskId: string) => void
  onOpenTask?: (taskId: string) => void
  onSelectProject?: (projectId: string) => void
  onOpenProject?: (projectId: string) => void
  onToggleTaskDone?: (taskId: string, done: boolean) => void
  onCompleteProject?: (project: ViewListProjectItem) => void
  onTaskContextMenu?: MouseEventHandler<HTMLDivElement>
  onSelectForDrag?: (item: ViewListItem) => void
}) {
  const key = itemKey(item)
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition } = useSortable({
    id: key,
  })

  const activatorProps = {
    ...attributes,
    ...(listeners ?? {}),
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      onSelectForDrag?.(item)
      listeners?.onPointerDown?.(e)
    },
  }

  if (item.kind === 'project') {
    return (
      <ProjectViewRow
        project={item}
        isOverlay={isOverlay}
        innerRef={setNodeRef}
        innerStyle={{
          transform: CSS.Transform.toString(transform),
          transition,
        }}
        titleActivatorRef={setActivatorNodeRef}
        titleActivatorProps={activatorProps}
        onSelect={onSelectProject}
        onOpen={onOpenProject}
        onComplete={onCompleteProject}
      />
    )
  }

  return (
    <TaskRow
      task={item}
      isOverlay={isOverlay}
      innerRef={setNodeRef}
      innerStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      titleActivatorRef={setActivatorNodeRef}
      titleActivatorProps={activatorProps}
      onSelect={onSelectTask}
      onOpen={onOpenTask}
      onToggleDone={onToggleTaskDone}
      onContextMenu={onTaskContextMenu}
    />
  )
}

export function ViewList({
  title,
  items,
  listId,
  onToggleTaskDone,
  onCompleteProject,
  onAfterReorder,
  topContent,
  emptyState,
}: {
  title: ReactNode
  items: ViewListItem[]
  listId?: string
  onToggleTaskDone?: (taskId: string, done: boolean) => Promise<void>
  onCompleteProject?: (project: ViewListProjectItem) => Promise<void>
  onAfterReorder?: () => Promise<void>
  topContent?: ReactNode
  emptyState?: ReactNode
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { selectedTaskId, selectTask, openTask, openTaskId } = useTaskSelection()
  const contentScrollRef = useContentScrollRef()
  const prefersReducedMotion = usePrefersReducedMotion()
  const dropAnimation = useMemo(() => getTaskDropAnimationConfig(prefersReducedMotion), [prefersReducedMotion])
  const dropAnimationDurationMs = useMemo(
    () => getTaskDropAnimationDurationMs(prefersReducedMotion),
    [prefersReducedMotion]
  )
  const { openTaskContextMenu, menuNode } = useTaskContextMenu({ scope: 'active' })

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [activeItemKey, setActiveItemKey] = useState<string | null>(null)
  const [orderedItemKeys, setOrderedItemKeys] = useState<string[]>(() => items.map(itemKey))

  const taskItems = useMemo(() => items.filter((item): item is ViewListTaskItem => item.kind === 'task'), [items])
  const optimisticTasks = useOptimisticTaskTitles(taskItems)
  const itemsWithOptimisticTitles = useMemo(() => {
    const tasksById = new Map(optimisticTasks.map((task) => [task.id, task]))
    return items.map((item) => {
      if (item.kind === 'project') return item
      return { ...item, ...tasksById.get(item.id), kind: 'task' as const }
    })
  }, [items, optimisticTasks])

  useEffect(() => {
    if (activeItemKey) return
    setOrderedItemKeys(itemsWithOptimisticTitles.map(itemKey))
  }, [activeItemKey, itemsWithOptimisticTitles])

  const orderedItemKeysRef = useRef<string[]>(orderedItemKeys)
  useEffect(() => {
    orderedItemKeysRef.current = orderedItemKeys
  }, [orderedItemKeys])

  const orderedItems = useMemo(() => {
    if (orderedItemKeys.length === 0) return itemsWithOptimisticTitles
    const byKey = new Map<string, ViewListItem>()
    for (const item of itemsWithOptimisticTitles) byKey.set(itemKey(item), item)

    const out: ViewListItem[] = []
    const seen = new Set<string>()
    for (const key of orderedItemKeys) {
      const item = byKey.get(key)
      if (!item) continue
      out.push(item)
      seen.add(key)
    }
    for (const item of itemsWithOptimisticTitles) {
      const key = itemKey(item)
      if (seen.has(key)) continue
      out.push(item)
    }
    return out
  }, [itemsWithOptimisticTitles, orderedItemKeys])

  const itemByKey = useMemo(() => {
    const map = new Map<string, ViewListItem>()
    for (const item of orderedItems) map.set(itemKey(item), item)
    return map
  }, [orderedItems])

  const itemIndexByKey = useMemo(() => {
    const map = new Map<string, number>()
    for (let i = 0; i < orderedItems.length; i++) {
      const item = orderedItems[i]
      if (!item) continue
      map.set(itemKey(item), i)
    }
    return map
  }, [orderedItems])

  const selectedItemKey = selectedProjectId ? `project:${selectedProjectId}` : selectedTaskId ? `task:${selectedTaskId}` : null

  const selectItem = useCallback(
    (item: Pick<ViewListItem, 'kind' | 'id'> | null) => {
      if (!item) {
        setSelectedProjectId(null)
        selectTask(null)
        return
      }

      if (item.kind === 'task') {
        setSelectedProjectId(null)
        selectTask(item.id)
        return
      }

      selectTask(null)
      setSelectedProjectId(item.id)
    },
    [selectTask]
  )

  const openItem = useCallback(
    (item: ViewListItem) => {
      if (item.kind === 'task') {
        void openTask(item.id)
        return
      }
      navigate(`/projects/${item.id}`)
    },
    [navigate, openTask]
  )

  const lastSelectedIndexRef = useRef(0)
  useEffect(() => {
    if (!selectedItemKey) return

    const idx = itemIndexByKey.get(selectedItemKey)
    if (idx !== undefined) {
      lastSelectedIndexRef.current = idx
      return
    }

    if (orderedItems.length === 0) {
      selectItem(null)
      return
    }

    const fallbackIdx = Math.min(lastSelectedIndexRef.current, orderedItems.length - 1)
    selectItem(orderedItems[fallbackIdx] ?? null)
  }, [itemIndexByKey, orderedItems, selectItem, selectedItemKey])

  const preListRef = useRef<HTMLDivElement | null>(null)
  const computeScrollMarginRef = useRef<(() => void) | null>(null)
  const listboxRef = useRef<HTMLDivElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

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
      const next = listRect.top - scrollRect.top + se.scrollTop
      setScrollMargin((prev) => (prev === next ? prev : next))
    }

    computeScrollMarginRef.current = compute
    compute()
    window.addEventListener('resize', compute)
    return () => {
      cancelled = true
      computeScrollMarginRef.current = null
      window.removeEventListener('resize', compute)
    }
  }, [contentScrollRef])

  useLayoutEffect(() => {
    const el = preListRef.current
    if (!el) return
    if (typeof ResizeObserver === 'undefined') return

    const ro = new ResizeObserver(() => {
      computeScrollMarginRef.current?.()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rowVirtualizer = useVirtualizer({
    count: orderedItems.length,
    getScrollElement: () => contentScrollRef.current,
    estimateSize: (index) => {
      const item = orderedItems[index]
      if (!item) return 44
      if (item.kind === 'task' && openTaskId && item.id === openTaskId) return 400
      return 44
    },
    scrollMargin,
    overscan: 12,
    getItemKey: (index) => {
      const item = orderedItems[index]
      if (!item) return index
      return itemKey(item)
    },
  })

  const isDndEnabled = !!listId
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    })
  )
  const dragSnapshotRef = useRef<string[] | null>(null)
  const lastOverIdRef = useRef<string | null>(null)
  const clearActiveItemTimeoutRef = useRef<number | null>(null)
  const postDropActionTimeoutRef = useRef<number | null>(null)

  const cancelPendingDropTimers = useCallback(() => {
    if (clearActiveItemTimeoutRef.current !== null) {
      window.clearTimeout(clearActiveItemTimeoutRef.current)
      clearActiveItemTimeoutRef.current = null
    }
    if (postDropActionTimeoutRef.current !== null) {
      window.clearTimeout(postDropActionTimeoutRef.current)
      postDropActionTimeoutRef.current = null
    }
  }, [])

  useEffect(() => () => cancelPendingDropTimers(), [cancelPendingDropTimers])

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) return pointerCollisions
    return closestCenter(args)
  }, [])

  function scheduleClearActiveItemAfterDrop(droppingKey: string) {
    if (dropAnimationDurationMs <= 0) {
      setActiveItemKey(null)
      return
    }

    if (clearActiveItemTimeoutRef.current !== null) window.clearTimeout(clearActiveItemTimeoutRef.current)

    clearActiveItemTimeoutRef.current = window.setTimeout(() => {
      clearActiveItemTimeoutRef.current = null
      setActiveItemKey((cur) => (cur === droppingKey ? null : cur))
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

  async function persistOrder(nextKeys: string[]) {
    if (!listId) return
    const nextItems = nextKeys
      .map((key) => itemByKey.get(key))
      .filter((item): item is ViewListItem => Boolean(item))
      .map(toReorderItem)
    const res = await window.api.view.reorderBatch(listId, nextItems)
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`)
    await onAfterReorder?.()
  }

  function handleDragStart(e: DragStartEvent) {
    const key = String(e.active.id)
    const item = itemByKey.get(key)
    cancelPendingDropTimers()
    setActiveItemKey(key)
    dragSnapshotRef.current = orderedItemKeysRef.current
    lastOverIdRef.current = null
    selectItem(item ?? null)
  }

  function handleDragOver(e: DragOverEvent) {
    const activeKey = String(e.active.id)
    const overKey = e.over?.id ? String(e.over.id) : null
    if (!overKey || activeKey === overKey) return
    if (lastOverIdRef.current === overKey) return

    setOrderedItemKeys((prev) => {
      const activeIndex = prev.indexOf(activeKey)
      const overIndex = prev.indexOf(overKey)
      if (activeIndex === -1 || overIndex === -1) return prev
      if (activeIndex === overIndex) return prev

      const next = arrayMove(prev, activeIndex, overIndex)
      orderedItemKeysRef.current = next
      lastOverIdRef.current = overKey
      return next
    })
  }

  async function handleDragEnd(e: DragEndEvent) {
    const activeKey = String(e.active.id)
    const overKey = e.over?.id ? String(e.over.id) : null
    scheduleClearActiveItemAfterDrop(activeKey)
    lastOverIdRef.current = null

    const snapshot = dragSnapshotRef.current
    dragSnapshotRef.current = null
    const next = orderedItemKeysRef.current

    if (!overKey) {
      if (snapshot) setOrderedItemKeys(snapshot)
      return
    }

    if (snapshot && snapshot.length === next.length && snapshot.every((key, i) => key === next[i])) return

    try {
      await persistOrder(next)
    } catch (err) {
      if (snapshot) setOrderedItemKeys(snapshot)
      throw err
    }

    const nextIndex = next.indexOf(activeKey)
    if (nextIndex >= 0) {
      const virtualItems = rowVirtualizer.getVirtualItems()
      const firstVisibleIndex = virtualItems[0]?.index ?? 0
      const lastVisibleIndex = virtualItems[virtualItems.length - 1]?.index ?? 0
      const shouldScroll = nextIndex < firstVisibleIndex || nextIndex > lastVisibleIndex
      if (shouldScroll) runAfterDropAnimation(() => rowVirtualizer.scrollToIndex(nextIndex))
    }
  }

  function handleDragCancel() {
    cancelPendingDropTimers()
    setActiveItemKey(null)
    lastOverIdRef.current = null

    const snapshot = dragSnapshotRef.current
    dragSnapshotRef.current = null
    if (snapshot) setOrderedItemKeys(snapshot)
  }

  const activeItem = useMemo(() => {
    if (!activeItemKey) return null
    return orderedItems.find((item) => itemKey(item) === activeItemKey) ?? null
  }, [activeItemKey, orderedItems])

  const handleTaskContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, task: ViewListTaskItem) => {
      event.preventDefault()
      event.stopPropagation()
      selectItem(task)

      const eventTarget = event.target
      const restoreFocusEl =
        eventTarget instanceof HTMLElement
          ? eventTarget.closest<HTMLElement>('[data-task-focus-target="true"]') ??
            event.currentTarget.querySelector<HTMLElement>('[data-task-focus-target="true"]') ??
            event.currentTarget
          : event.currentTarget.querySelector<HTMLElement>('[data-task-focus-target="true"]') ??
            event.currentTarget

      void openTaskContextMenu({
        task,
        anchorX: event.clientX,
        anchorY: event.clientY,
        restoreFocusEl,
      })
    },
    [openTaskContextMenu, selectItem]
  )

  return (
    <div className="page">
      <div ref={preListRef}>
        <header className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">{title}</h1>
          </div>
        </header>

        {topContent ? <div className="task-list-top-content">{topContent}</div> : null}
      </div>

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
          aria-label={t('aria.tasks')}
          onKeyDown={(e) => {
            const isReorderChord =
              (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')

            if (isReorderChord && e.target instanceof HTMLElement) {
              const tag = e.target.tagName
              if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return
            }
            if (
              e.key !== 'ArrowDown' &&
              e.key !== 'ArrowUp' &&
              e.key !== 'Enter' &&
              e.key !== ' ' &&
              !isReorderChord
            ) {
              return
            }

            const idx = selectedItemKey ? itemIndexByKey.get(selectedItemKey) ?? -1 : -1

            if (isReorderChord && listId && selectedItemKey) {
              e.preventDefault()
              const dir = e.key === 'ArrowUp' ? -1 : 1
              const prev = orderedItemKeys
              const from = prev.indexOf(selectedItemKey)
              const to = from + dir
              if (from < 0 || to < 0 || to >= prev.length) return
              const next = arrayMove(prev, from, to)
              setOrderedItemKeys(next)
              void (async () => {
                try {
                  await persistOrder(next)
                } catch (err) {
                  setOrderedItemKeys(prev)
                  throw err
                }
                rowVirtualizer.scrollToIndex(to)
              })()
              return
            }

            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (orderedItems.length === 0) return
              const nextIdx = Math.min((idx < 0 ? -1 : idx) + 1, orderedItems.length - 1)
              const next = orderedItems[nextIdx]
              if (!next) return
              selectItem(next)
              rowVirtualizer.scrollToIndex(nextIdx)
              return
            }

            if (e.key === 'ArrowUp') {
              e.preventDefault()
              if (orderedItems.length === 0) return
              const nextIdx = Math.max(idx <= 0 ? 0 : idx - 1, 0)
              const next = orderedItems[nextIdx]
              if (!next) return
              selectItem(next)
              rowVirtualizer.scrollToIndex(nextIdx)
              return
            }

            if (e.key === ' ') {
              e.preventDefault()
              if (!selectedItemKey || !onToggleTaskDone) return
              const current = itemByKey.get(selectedItemKey)
              if (!current || current.kind !== 'task') return
              void onToggleTaskDone(current.id, current.status !== 'done')
              return
            }

            if (e.key === 'Enter') {
              e.preventDefault()
              if (!selectedItemKey) return
              const current = itemByKey.get(selectedItemKey)
              if (!current) return
              openItem(current)
            }
          }}
        >
          {items.length === 0 && emptyState ? (
            <div className="task-list-empty">{emptyState}</div>
          ) : (
            <SortableContext items={isDndEnabled ? orderedItemKeys : []} strategy={verticalListSortingStrategy}>
              <ul className="task-list" style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const item = orderedItems[virtualRow.index]
                  if (!item) return null

                  const key = itemKey(item)
                  const isTask = item.kind === 'task'
                  const isOpen = isTask && openTaskId === item.id
                  const isSelected = selectedItemKey === key
                  let liEl: HTMLLIElement | null = null

                  return (
                    <li
                      key={key}
                      className={`task-row${isOpen ? ' is-open' : ' task-row-virtual'}${
                        item.status === 'done' ? ' is-done' : item.status === 'cancelled' ? ' is-cancelled' : ''
                      }${isSelected ? ' is-selected' : ''}${!isOpen && activeItemKey === key ? ' is-dragging' : ''}`}
                      data-task-id={isTask ? item.id : undefined}
                      data-project-id={item.kind === 'project' ? item.id : undefined}
                      ref={(el) => {
                        liEl = el
                        if (!el) return
                        rowVirtualizer.measureElement(el)
                      }}
                      data-index={virtualRow.index}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        visibility: activeItemKey === key ? 'hidden' : undefined,
                        transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                      }}
                    >
                      {item.kind === 'task' ? (
                        <AnimatedTaskSlot
                          isOpen={isOpen}
                          rowContent={
                            isDndEnabled ? (
                              <SortableViewRow
                                item={item}
                                onSelectTask={(taskId) => selectItem({ kind: 'task', id: taskId })}
                                onOpenTask={(taskId) => openItem({ ...item, id: taskId })}
                                onToggleTaskDone={(taskId, done) => {
                                  if (onToggleTaskDone) void onToggleTaskDone(taskId, done)
                                }}
                                onTaskContextMenu={(event) => handleTaskContextMenu(event, item)}
                                onSelectForDrag={selectItem}
                              />
                            ) : (
                              <TaskRow
                                task={item}
                                onSelect={(taskId) => selectItem({ kind: 'task', id: taskId })}
                                onOpen={(taskId) => openItem({ ...item, id: taskId })}
                                onToggleDone={(taskId, done) => {
                                  if (onToggleTaskDone) void onToggleTaskDone(taskId, done)
                                }}
                                onContextMenu={(event) => handleTaskContextMenu(event, item)}
                              />
                            )
                          }
                          editorContent={<TaskInlineEditorRow taskId={item.id} />}
                          onHeightChange={() => {
                            if (liEl) rowVirtualizer.measureElement(liEl)
                          }}
                          prefersReducedMotion={prefersReducedMotion}
                        />
                      ) : isDndEnabled ? (
                        <SortableViewRow
                          item={item}
                          onSelectProject={(projectId) => selectItem({ kind: 'project', id: projectId })}
                          onOpenProject={() => openItem(item)}
                          onCompleteProject={(project) => {
                            if (onCompleteProject) void onCompleteProject(project)
                          }}
                          onSelectForDrag={selectItem}
                        />
                      ) : (
                        <ProjectViewRow
                          project={item}
                          onSelect={(projectId) => selectItem({ kind: 'project', id: projectId })}
                          onOpen={() => openItem(item)}
                          onComplete={(project) => {
                            if (onCompleteProject) void onCompleteProject(project)
                          }}
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            </SortableContext>
          )}
        </div>

        {isDndEnabled && activeItemKey
          ? createPortal(
              <DragOverlay dropAnimation={dropAnimation}>
                {activeItem ? (
                  <div className="task-dnd-overlay">
                    {activeItem.kind === 'task' ? (
                      <TaskRow task={activeItem} isOverlay />
                    ) : (
                      <ProjectViewRow project={activeItem} isOverlay />
                    )}
                  </div>
                ) : null}
              </DragOverlay>,
              document.body
            )
          : null}
      </DndContext>

      {menuNode}
    </div>
  )
}
