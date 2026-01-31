import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { useVirtualizer } from '@tanstack/react-virtual'

import type { ProjectSection } from '../../../shared/schemas/project'
import type { TaskListItem } from '../../../shared/schemas/task-list'

import { useContentScrollRef } from '../../app/ContentScrollContext'
import { TaskInlineEditorRow } from './TaskInlineEditorRow'
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

function sortByRankThenCreated(a: TaskListItem, b: TaskListItem) {
  const ar = a.rank ?? Number.POSITIVE_INFINITY
  const br = b.rank ?? Number.POSITIVE_INFINITY
  if (ar !== br) return ar - br
  return a.created_at.localeCompare(b.created_at)
}

export function ProjectGroupedList({
  sections,
  openTasks,
  doneTasks,
  editingSectionId,
  onCancelSectionTitleEdit,
  onCommitSectionTitle,
  onToggleDone,
  onRenameSection,
  onDeleteSection,
}: {
  sections: ProjectSection[]
  openTasks: TaskListItem[]
  doneTasks: TaskListItem[] | null
  editingSectionId: string | null
  onCancelSectionTitleEdit: () => void
  onCommitSectionTitle: (sectionId: string, title: string) => Promise<void>
  onToggleDone: (taskId: string, done: boolean) => Promise<void>
  onRenameSection: (sectionId: string, currentTitle: string) => void
  onDeleteSection: (sectionId: string) => void
}) {
  const { selectedTaskId, selectTask, openTask, openTaskId } = useTaskSelection()
  const contentScrollRef = useContentScrollRef()

  const listboxRef = useRef<HTMLDivElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  const editTitleInputRef = useRef<HTMLInputElement | null>(null)
  const [editTitleDraft, setEditTitleDraft] = useState('')
  const lastEditingSectionIdRef = useRef<string | null>(null)

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

    const openBySection = new Map<string, TaskListItem[]>()
    const openNone: TaskListItem[] = []
    for (const t of openTasks) {
      if (!t.section_id) openNone.push(t)
      else {
        const list = openBySection.get(t.section_id) ?? []
        list.push(t)
        openBySection.set(t.section_id, list)
      }
    }
    openNone.sort(sortByRankThenCreated)
    for (const list of openBySection.values()) list.sort(sortByRankThenCreated)

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

    // Tasks with no section: render first, without a dedicated group header.
    for (const task of openNone) {
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
      const open = openBySection.get(s.id) ?? []
      const done = doneTasks ? doneBySection.get(s.id) ?? [] : null

      const groupIndex = rows.length
      rows.push({
        type: 'group',
        key: `g:${s.id}`,
        title: s.title,
        sectionId: s.id,
        openCount: open.length,
        doneCount: doneTasks ? (done?.length ?? 0) : null,
      })
      groupRowIndexBySectionId.set(s.id, groupIndex)

      for (const task of open) {
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
  }, [doneTasks, openTasks, sections])

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

  function moveSelection(dir: -1 | 1) {
    if (rows.length === 0) return
    const currentIndex = selectedTaskId ? taskRowIndexById.get(selectedTaskId) ?? -1 : -1
    const start = currentIndex < 0 ? (dir === 1 ? -1 : rows.length) : currentIndex

    for (let i = start + dir; i >= 0 && i < rows.length; i += dir) {
      const r = rows[i]
      if (r?.type !== 'task') continue
      selectTask(r.task.id)
      rowVirtualizer.scrollToIndex(i)
      return
    }
  }

  return (
    <div
      ref={listboxRef}
      className="task-scroll"
      tabIndex={0}
      role="listbox"
      aria-label="Project tasks"
      onKeyDown={(e) => {
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
          if (!selectedTaskId) return
          const idx = taskRowIndexById.get(selectedTaskId)
          const row = idx !== undefined ? rows[idx] : null
          if (!row || row.type !== 'task') return
          void onToggleDone(row.task.id, row.task.status !== 'done')
          return
        }

        if (e.key === 'Enter') {
          e.preventDefault()
          if (!selectedTaskId) return
          void openTask(selectedTaskId)
        }
      }}
    >
      <ul className="task-list" style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index]
          if (!row) return null

          if (row.type === 'group') {
            const isEditing = !!row.sectionId && row.sectionId === editingSectionId
            const title = row.title.trim() ? row.title : '(untitled)'
            return (
              <li
                key={row.key}
                className="project-group-header"
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
                  transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                }}
              >
                <div className="project-group-left">
                  {isEditing ? (
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
                          const sectionId = row.sectionId
                          if (!sectionId) return

                          const next = editTitleDraft.trim()
                          const current = sections.find((s) => s.id === sectionId)?.title ?? ''
                          if (next === current) {
                            onCancelSectionTitleEdit()
                            return
                          }
                          void onCommitSectionTitle(sectionId, next)
                          return
                        }

                        if (e.key === 'Escape') {
                          e.preventDefault()
                          onCancelSectionTitleEdit()
                        }
                      }}
                      onBlur={() => {
                        const sectionId = row.sectionId
                        if (!sectionId) return

                        const next = editTitleDraft.trim()
                        const current = sections.find((s) => s.id === sectionId)?.title ?? ''
                        if (next === current) {
                          onCancelSectionTitleEdit()
                          return
                        }
                        void onCommitSectionTitle(sectionId, next)
                      }}
                    />
                  ) : (
                    <div className={`project-group-title${row.title.trim() ? '' : ' is-placeholder'}`}>{title}</div>
                  )}
                  <div className="project-group-meta">
                    {row.openCount} open
                    {row.doneCount !== null ? ` · ${row.doneCount} done` : null}
                  </div>
                </div>

                {row.sectionId && !isEditing ? (
                  <div className="project-group-actions">
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        const section = sections.find((s) => s.id === row.sectionId)
                        if (!section) return
                        onRenameSection(section.id, section.title)
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteSection(row.sectionId!)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </li>
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
              className={`task-row${t.status === 'done' ? ' is-done' : ''}${selectedTaskId === t.id ? ' is-selected' : ''}`}
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
                transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
              }}
            >
              <label className="task-checkbox">
                <input
                  type="checkbox"
                  checked={t.status === 'done'}
                  onChange={(e) => {
                    void onToggleDone(t.id, e.target.checked)
                  }}
                />
              </label>

              <button
                type="button"
                className="task-title task-title-button"
                data-task-focus-target="true"
                data-task-id={t.id}
                onClick={() => selectTask(t.id)}
                onDoubleClick={() => void openTask(t.id)}
              >
                <span className={t.title.trim() ? undefined : 'task-title-placeholder'}>
                  {t.title.trim() ? t.title : '新建任务'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
