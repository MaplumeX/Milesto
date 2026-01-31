import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { AppError } from '../../../shared/app-error'
import type { Area } from '../../../shared/schemas/area'
import type { ChecklistItem } from '../../../shared/schemas/checklist'
import type { Project, ProjectSection } from '../../../shared/schemas/project'
import type { Tag } from '../../../shared/schemas/tag'
import type { TaskDetail } from '../../../shared/schemas/task-detail'
import type { TaskUpdateInput } from '../../../shared/schemas/task'

import { formatLocalDate } from '../../lib/dates'

type Draft = {
  title: string
  notes: string
  base_list: 'inbox' | 'anytime' | 'someday'
  project_id: string | null
  section_id: string | null
  area_id: string | null
  scheduled_at: string | null
  due_at: string | null
}

export type TaskEditorPaperHandle = {
  flushPendingChanges: () => Promise<boolean>
  focusTitle: () => void
  focusLastErrorTarget: () => void
}

type TaskEditorVariant = 'overlay' | 'inline'

type PickerKind = 'schedule' | 'due' | 'tags'
type ActivePicker = {
  kind: PickerKind
  anchorEl: HTMLElement
} | null

const TITLE_NOTES_DEBOUNCE_MS = 450
const OTHER_FIELDS_DEBOUNCE_MS = 120

const TAG_COLOR_PRESETS: Array<{ name: string; value: string | null; hex: string | null }> = [
  { name: 'None', value: null, hex: null },
  { name: 'Red', value: '#d14b2a', hex: '#d14b2a' },
  { name: 'Orange', value: '#d9882a', hex: '#d9882a' },
  { name: 'Yellow', value: '#d1b82a', hex: '#d1b82a' },
  { name: 'Green', value: '#2d8a5f', hex: '#2d8a5f' },
  { name: 'Blue', value: '#2f6fd6', hex: '#2f6fd6' },
  { name: 'Purple', value: '#7a4bd6', hex: '#7a4bd6' },
  { name: 'Gray', value: '#6c6a64', hex: '#6c6a64' },
]

function normalizeDraft(draft: Draft): Draft {
  // PRD rule: Inbox is for unprocessed items. If a task is assigned/scheduled, it should not remain in Inbox.
  if (draft.base_list !== 'inbox') return draft
  if (draft.project_id !== null || draft.scheduled_at !== null) {
    return { ...draft, base_list: 'anytime' }
  }
  return draft
}

function isDraftEqual(a: Draft, b: Draft): boolean {
  return (
    a.title === b.title &&
    a.notes === b.notes &&
    a.base_list === b.base_list &&
    a.project_id === b.project_id &&
    a.section_id === b.section_id &&
    a.area_id === b.area_id &&
    a.scheduled_at === b.scheduled_at &&
    a.due_at === b.due_at
  )
}

function computePatch(prev: Draft, next: Draft): Omit<TaskUpdateInput, 'id'> {
  const patch: Partial<Omit<TaskUpdateInput, 'id'>> = {}
  if (prev.title !== next.title) patch.title = next.title
  if (prev.notes !== next.notes) patch.notes = next.notes
  if (prev.base_list !== next.base_list) patch.base_list = next.base_list
  if (prev.project_id !== next.project_id) patch.project_id = next.project_id
  if (prev.section_id !== next.section_id) patch.section_id = next.section_id
  if (prev.area_id !== next.area_id) patch.area_id = next.area_id
  if (prev.scheduled_at !== next.scheduled_at) patch.scheduled_at = next.scheduled_at
  if (prev.due_at !== next.due_at) patch.due_at = next.due_at
  return patch as Omit<TaskUpdateInput, 'id'>
}

function isDevForcedUpdateErrorEnabled(): boolean {
  const selfTestEnabled = new URL(window.location.href).searchParams.get('selfTest') === '1'
  if (!import.meta.env.DEV && !selfTestEnabled) return false
  return (
    (window as unknown as { __milestoForceTaskUpdateError?: boolean }).__milestoForceTaskUpdateError ===
    true
  )
}

function getDevTaskUpdateDelayMs(): number {
  const selfTestEnabled = new URL(window.location.href).searchParams.get('selfTest') === '1'
  if (!import.meta.env.DEV && !selfTestEnabled) return 0
  const v = (window as unknown as { __milestoTaskUpdateDelayMs?: unknown }).__milestoTaskUpdateDelayMs
  if (typeof v !== 'number') return 0
  if (!Number.isFinite(v) || v <= 0) return 0
  return v
}

export const TaskEditorPaper = forwardRef<
  TaskEditorPaperHandle,
  { taskId: string; onRequestClose: () => void; variant?: TaskEditorVariant }
  >(function TaskEditorPaper({ taskId, onRequestClose, variant = 'overlay' }, ref) {
    const titleInputRef = useRef<HTMLInputElement | null>(null)
    const notesInputRef = useRef<HTMLTextAreaElement | null>(null)

    const inlineRootRef = useRef<HTMLDivElement | null>(null)
    const popoverRef = useRef<HTMLDivElement | null>(null)
    const tagsButtonRef = useRef<HTMLButtonElement | null>(null)

    const schedulePopoverInputRef = useRef<HTMLInputElement | null>(null)
    const duePopoverInputRef = useRef<HTMLInputElement | null>(null)

    const taskIdRef = useRef(taskId)
    useEffect(() => {
      taskIdRef.current = taskId
    }, [taskId])

    const [detail, setDetail] = useState<TaskDetail | null>(null)
    const [draft, setDraft] = useState<Draft | null>(null)
    const [lastSaved, setLastSaved] = useState<Draft | null>(null)

    const [loadError, setLoadError] = useState<AppError | null>(null)
    const [actionError, setActionError] = useState<AppError | null>(null)
    const [tagsError, setTagsError] = useState<AppError | null>(null)
    const [saveError, setSaveError] = useState<AppError | null>(null)
    const saveErrorRef = useRef<AppError | null>(null)
    useEffect(() => {
      saveErrorRef.current = saveError
    }, [saveError])

    const [savePhase, setSavePhase] = useState<'idle' | 'saving' | 'error'>('idle')

    const [activePicker, setActivePicker] = useState<ActivePicker>(null)
    const activePickerRef = useRef<ActivePicker>(null)
    useEffect(() => {
      activePickerRef.current = activePicker
    }, [activePicker])
    const lastFlushFailureTargetRef = useRef<'title' | 'tags'>('title')

    const tagsSaveSeqRef = useRef(0)
    const tagsSavePromiseRef = useRef<Promise<void> | null>(null)
    const tagsSaveErrorRef = useRef<AppError | null>(null)

    useEffect(() => {
      tagsSaveErrorRef.current = tagsError
    }, [tagsError])

    const [isChecklistExpanded, setIsChecklistExpanded] = useState(false)
    const checklistCreateInputRef = useRef<HTMLInputElement | null>(null)

    const [projects, setProjects] = useState<Project[]>([])
    const [sections, setSections] = useState<ProjectSection[]>([])
    const [areas, setAreas] = useState<Area[]>([])
    const [tags, setTags] = useState<Tag[]>([])

    const today = useMemo(() => formatLocalDate(new Date()), [])

    const saveDebounceRef = useRef<number | null>(null)
    const pendingSnapshotRef = useRef<Draft | null>(null)
    const saveWorkerRef = useRef<Promise<void> | null>(null)
    const lastSavedRef = useRef<Draft | null>(null)
    useEffect(() => {
      lastSavedRef.current = lastSaved
    }, [lastSaved])

    const isDirty = !!draft && !!lastSaved && !isDraftEqual(normalizeDraft(draft), lastSaved)

    function focusTitle() {
      titleInputRef.current?.focus()
    }

    function focusLastErrorTarget() {
      if (lastFlushFailureTargetRef.current === 'tags') {
        tagsButtonRef.current?.focus()
        return
      }
      focusTitle()
    }

    const closeActivePicker = useCallback(() => {
      const current = activePickerRef.current
      if (!current) return
      setActivePicker(null)
    }, [])

    useEffect(() => {
      // When a date picker popover opens, focus the input and attempt to open the native picker.
      const current = activePicker
      if (!current) return
      if (current.kind !== 'schedule' && current.kind !== 'due') return

      const input = current.kind === 'schedule' ? schedulePopoverInputRef.current : duePopoverInputRef.current
      if (!input) return

      input.focus()
      if (typeof input.showPicker === 'function') {
        try {
          input.showPicker()
        } catch {
          // Ignore and rely on the visible date input.
        }
      }
    }, [activePicker])

    useEffect(() => {
      if (variant !== 'inline') return

      function handlePointerDown(e: PointerEvent) {
        if (e.button !== 0) return
        if (!(e.target instanceof Node)) return

        const root = inlineRootRef.current
        if (!root) return
        const popover = popoverRef.current
        const isInside = root.contains(e.target) || (popover ? popover.contains(e.target) : false)
        if (isInside) return

        // Dismiss pickers first. If no picker is open, attempt to close the editor.
        e.preventDefault()
        e.stopPropagation()

        if (activePicker) {
          closeActivePicker()
          return
        }

        onRequestClose()
      }

      document.addEventListener('pointerdown', handlePointerDown, true)
      return () => document.removeEventListener('pointerdown', handlePointerDown, true)
    }, [activePicker, closeActivePicker, onRequestClose, variant])

    useEffect(() => {
      if (!activePicker) return

      // Close pickers on scroll/resize to avoid stale positioning.
      function handleClose() {
        closeActivePicker()
      }

      window.addEventListener('resize', handleClose)
      window.addEventListener('scroll', handleClose, true)
      return () => {
        window.removeEventListener('resize', handleClose)
        window.removeEventListener('scroll', handleClose, true)
      }
    }, [activePicker, closeActivePicker])

    function scheduleSave(nextDraft: Draft, debounceMs: number) {
      if (saveDebounceRef.current) window.clearTimeout(saveDebounceRef.current)

      saveDebounceRef.current = window.setTimeout(() => {
        saveDebounceRef.current = null
        requestSave(nextDraft)
      }, debounceMs)
    }

    function requestSave(nextDraft: Draft) {
      const currentTaskId = taskIdRef.current
      const prev = lastSavedRef.current
      if (!prev) return

      const normalized = normalizeDraft(nextDraft)
      if (normalized.base_list !== nextDraft.base_list) {
        // Keep the UI truthful when the Inbox normalization rule applies.
        setDraft((d) => (d ? { ...d, base_list: normalized.base_list } : d))
      }

      const patch = computePatch(prev, normalized)
      if (Object.keys(patch).length === 0) return

      pendingSnapshotRef.current = normalized
      if (!saveWorkerRef.current) {
        saveWorkerRef.current = runSaveWorker(currentTaskId).finally(() => {
          saveWorkerRef.current = null
        })
      }
    }

    async function runSaveWorker(workerTaskId: string) {
      while (pendingSnapshotRef.current) {
        const snapshot = pendingSnapshotRef.current
        pendingSnapshotRef.current = null

        const prev = lastSavedRef.current
        if (!prev) return

        const patch = computePatch(prev, snapshot)
        if (Object.keys(patch).length === 0) {
          lastSavedRef.current = snapshot
          setLastSaved(snapshot)
          setSaveError(null)
          setSavePhase('idle')
          continue
        }

        setSavePhase('saving')
        setSaveError(null)

        if (isDevForcedUpdateErrorEnabled()) {
          lastFlushFailureTargetRef.current = 'title'
          setSaveError({
            code: 'DEV_FORCED_SAVE_ERROR',
            message: 'Forced task.update failure (dev self-test).',
          })
          setSavePhase('error')
          // Preserve pending state so a retry can re-run the same snapshot.
          pendingSnapshotRef.current = snapshot
          return
        }

        const delayMs = getDevTaskUpdateDelayMs()
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs))
          if (taskIdRef.current !== workerTaskId) return
        }

        const res = await window.api.task.update({ id: workerTaskId, ...patch })
        if (taskIdRef.current !== workerTaskId) return
        if (!res.ok) {
          lastFlushFailureTargetRef.current = 'title'
          setSaveError(res.error)
          setSavePhase('error')
          // Preserve pending state so a user-triggered retry can re-run the same snapshot.
          pendingSnapshotRef.current = snapshot
          return
        }

        setDetail((d) => (d ? { ...d, task: res.data } : d))
        lastSavedRef.current = snapshot
        setLastSaved(snapshot)
        setSaveError(null)
        setSavePhase('idle')
      }
    }

    async function flushPendingChanges(): Promise<boolean> {
      if (saveDebounceRef.current) {
        window.clearTimeout(saveDebounceRef.current)
        saveDebounceRef.current = null
      }

      if (draft) requestSave(draft)

      if (saveWorkerRef.current) await saveWorkerRef.current

      if (tagsSavePromiseRef.current) await tagsSavePromiseRef.current

      if (saveErrorRef.current) return false
      if (tagsSaveErrorRef.current) return false
      if (!draft || !lastSavedRef.current) return true
      return isDraftEqual(normalizeDraft(draft), lastSavedRef.current)
    }

    useImperativeHandle(ref, () => ({ flushPendingChanges, focusTitle, focusLastErrorTarget }))

    useEffect(() => {
      void (async () => {
        const [projectsRes, tagsRes, areasRes] = await Promise.all([
          window.api.project.listOpen(),
          window.api.tag.list(),
          window.api.area.list(),
        ])

        if (projectsRes.ok) setProjects(projectsRes.data)
        if (tagsRes.ok) setTags(tagsRes.data)
        if (areasRes.ok) setAreas(areasRes.data)
      })()
    }, [])

    useEffect(() => {
      let cancelled = false
      setLoadError(null)
      setActionError(null)
      setTagsError(null)
      setSaveError(null)
      setSavePhase('idle')
      setActivePicker(null)
      setDetail(null)
      setDraft(null)
      setLastSaved(null)
      lastSavedRef.current = null
      pendingSnapshotRef.current = null
      tagsSavePromiseRef.current = null
      tagsSaveSeqRef.current = 0
      if (saveDebounceRef.current) {
        window.clearTimeout(saveDebounceRef.current)
        saveDebounceRef.current = null
      }

      void (async () => {
        const res = await window.api.task.getDetail(taskId)
        if (cancelled) return
        if (!res.ok) {
          setLoadError(res.error)
          return
        }

        const nextDraft: Draft = {
          title: res.data.task.title,
          notes: res.data.task.notes,
          base_list: res.data.task.base_list,
          project_id: res.data.task.project_id,
          section_id: res.data.task.section_id,
          area_id: res.data.task.area_id,
          scheduled_at: res.data.task.scheduled_at,
          due_at: res.data.task.due_at,
        }

        setDetail(res.data)
        setDraft(nextDraft)
        const normalized = normalizeDraft(nextDraft)
        lastSavedRef.current = normalized
        setLastSaved(normalized)

        // Ensure focus starts in the title field.
        const handle = window.setTimeout(() => {
          titleInputRef.current?.focus()
          if ((nextDraft.title ?? '').trim() === '') titleInputRef.current?.select()
        }, 0)

        return () => window.clearTimeout(handle)
      })()

      return () => {
        cancelled = true
      }
    }, [taskId])

    useEffect(() => {
      if (variant !== 'inline') return
      const notes = draft?.notes
      if (notes === undefined) return
      const el = notesInputRef.current
      if (!el) return
      // Auto-resize notes to avoid nested scrolling.
      el.style.height = '0px'
      el.style.height = `${el.scrollHeight}px`

      // Keep the editor stable in virtualized lists while content grows.
      // Only do this when the user is actively editing notes to avoid unexpected jumps.
      if (document.activeElement === el) {
        el.scrollIntoView({ block: 'nearest' })
      }
    }, [draft?.notes, variant])

    useEffect(() => {
      const projectId = draft?.project_id
      if (!projectId) {
        setSections([])
        return
      }

      void (async () => {
        const res = await window.api.project.listSections(projectId)
        if (!res.ok) {
          setSections([])
          return
        }
        setSections(res.data)
      })()
    }, [draft?.project_id])

    const selectedTagIds = useMemo(() => new Set(detail?.tag_ids ?? []), [detail?.tag_ids])
    const checklist = detail?.checklist_items ?? []

    useEffect(() => {
      if (variant !== 'inline') return
      // Inline editor treats an empty checklist as collapsed.
      setIsChecklistExpanded(checklist.length > 0)
    }, [checklist.length, variant])

    const paperClassName = variant === 'inline' ? 'task-inline-paper' : 'overlay-paper'

    if (loadError) {
      return (
        <div className={paperClassName}>
          <div className="overlay-paper-header">
            <div className="overlay-paper-title">Task</div>
            <button type="button" className="button button-ghost" onClick={onRequestClose}>
              Close
            </button>
          </div>
          <div className="error">
            <div className="error-code">{loadError.code}</div>
            <div>{loadError.message}</div>
          </div>
        </div>
      )
    }

    if (!detail || !draft) {
      return (
        <div className={paperClassName}>
          <div className="overlay-paper-header">
            <div className="overlay-paper-title">Task</div>
            <button type="button" className="button button-ghost" onClick={onRequestClose}>
              Close
            </button>
          </div>
          <div className="nav-muted">Loading…</div>
        </div>
      )
    }

    const statusLabel = detail.task.status === 'done' ? 'Done' : 'Open'

    if (variant === 'inline') {
      function openChecklistAndFocus() {
        setIsChecklistExpanded(true)
        window.setTimeout(() => checklistCreateInputRef.current?.focus(), 0)
      }

      const saveStatusLabel =
        savePhase === 'saving' ? 'Saving…' : savePhase === 'error' ? 'Error' : isDirty ? 'Unsaved' : 'Saved'

      const openSchedulePicker = (anchorEl: HTMLElement) => {
        setActivePicker({ kind: 'schedule', anchorEl })
      }

      const openDuePicker = (anchorEl: HTMLElement) => {
        setActivePicker({ kind: 'due', anchorEl })
      }

      const openTagsPicker = (anchorEl: HTMLElement) => {
        setActivePicker({ kind: 'tags', anchorEl })
      }

      const persistTags = (nextTagIds: string[]) => {
        // Optimistic UI update; persistence is tracked so close/switch can await it.
        setDetail((d) => (d ? { ...d, tag_ids: nextTagIds } : d))
        setTagsError(null)

        tagsSaveSeqRef.current += 1
        const seq = tagsSaveSeqRef.current
        const promise = (async () => {
          const res = await window.api.task.setTags(detail.task.id, nextTagIds)
          if (tagsSaveSeqRef.current !== seq) return
          if (!res.ok) {
            lastFlushFailureTargetRef.current = 'tags'
            setTagsError(res.error)
            return
          }
          setTagsError(null)
        })()

        tagsSavePromiseRef.current = promise
      }

      const renderPopover = () => {
        if (!activePicker) return null

        const rect = activePicker.anchorEl.getBoundingClientRect()
        const maxWidth = 320
        const left = Math.min(Math.max(12, rect.left), window.innerWidth - maxWidth - 12)
        const top = Math.min(rect.bottom + 8, window.innerHeight - 12)

        return createPortal(
          <div
            ref={popoverRef}
            className="task-inline-popover"
            role="dialog"
            style={{ position: 'fixed', top, left, width: maxWidth, zIndex: 45 }}
          >
            {activePicker.kind === 'tags' ? (
              <div className="task-inline-popover-body">
                <div className="task-inline-popover-title">Tags</div>
                <div className="tag-grid" style={{ marginTop: 8 }}>
                  {tags.map((tag) => {
                    const checked = selectedTagIds.has(tag.id)
                    return (
                      <label key={tag.id} className="tag-checkbox" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = new Set(selectedTagIds)
                            if (e.target.checked) next.add(tag.id)
                            else next.delete(tag.id)
                            persistTags(Array.from(next))
                          }}
                        />
                        <span>{tag.title}</span>
                        <span
                          className="tag-swatch"
                          style={{ marginLeft: 'auto', background: tag.color ?? 'transparent' }}
                          aria-hidden="true"
                        />
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : activePicker.kind === 'schedule' ? (
              <div className="task-inline-popover-body">
                <div className="task-inline-popover-title">Scheduled</div>
                <input
                  ref={schedulePopoverInputRef}
                  className="input"
                  type="date"
                  value={draft.scheduled_at ?? ''}
                  onChange={(e) => {
                    const next = { ...draft, scheduled_at: e.target.value ? e.target.value : null }
                    setDraft(next)
                    scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
                    setActivePicker(null)
                  }}
                />
                <div className="row" style={{ justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      const next = { ...draft, scheduled_at: today }
                      setDraft(next)
                      scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
                      setActivePicker(null)
                    }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      const next = { ...draft, scheduled_at: null }
                      setDraft(next)
                      scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
                      setActivePicker(null)
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <div className="task-inline-popover-body">
                <div className="task-inline-popover-title">Due</div>
                <input
                  ref={duePopoverInputRef}
                  className="input"
                  type="date"
                  value={draft.due_at ?? ''}
                  onChange={(e) => {
                    const next = { ...draft, due_at: e.target.value ? e.target.value : null }
                    setDraft(next)
                    scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
                    setActivePicker(null)
                  }}
                />
                <div className="row" style={{ justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      const next = { ...draft, due_at: null }
                      setDraft(next)
                      scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
                      setActivePicker(null)
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>,
          document.body
        )
      }

      return (
        <div
          className={paperClassName}
          ref={inlineRootRef}
          onKeyDownCapture={(e) => {
            if (e.key !== 'Escape') return
            if (!activePickerRef.current) return
            e.preventDefault()
            e.stopPropagation()
            closeActivePicker()
          }}
        >
          <div className="task-inline-header">
            <label className="task-checkbox" aria-label="Done">
              <input
                type="checkbox"
                checked={detail.task.status === 'done'}
                onChange={(e) => {
                  const nextDone = e.target.checked
                  void (async () => {
                    const res = await window.api.task.toggleDone(detail.task.id, nextDone)
                    if (!res.ok) {
                      setActionError(res.error)
                      return
                    }
                    setActionError(null)
                    setDetail((d) => (d ? { ...d, task: res.data } : d))
                  })()
                }}
              />
            </label>

            <input
              id="task-title"
              ref={titleInputRef}
              className="task-inline-title"
              value={draft.title}
              onChange={(e) => {
                const next = { ...draft, title: e.target.value }
                setDraft(next)
                scheduleSave(next, TITLE_NOTES_DEBOUNCE_MS)
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                if (e.metaKey || e.ctrlKey) return
                e.preventDefault()
                e.stopPropagation()
                onRequestClose()
              }}
              placeholder="新建任务"
            />

            <div className="task-inline-header-right">
              <div className="task-inline-status" aria-live="polite">
                {saveStatusLabel}
              </div>

            {savePhase === 'error' ? (
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  requestSave(draft)
                }}
              >
                Retry
              </button>
            ) : null}

            </div>
          </div>

          <div className="task-inline-content">
            {saveError ? (
              <div className="error">
                <div className="error-code">{saveError.code}</div>
                <div>{saveError.message}</div>
              </div>
            ) : null}

            {actionError ? (
              <div className="error">
                <div className="error-code">{actionError.code}</div>
                <div>{actionError.message}</div>
              </div>
            ) : null}

            {tagsError ? (
              <div className="error">
                <div className="error-code">{tagsError.code}</div>
                <div>{tagsError.message}</div>
              </div>
            ) : null}

            <textarea
              id="task-notes"
              ref={notesInputRef}
              className="task-inline-notes"
              value={draft.notes}
              onChange={(e) => {
                const next = { ...draft, notes: e.target.value }
                setDraft(next)
                scheduleSave(next, TITLE_NOTES_DEBOUNCE_MS)
              }}
              placeholder="备注"
            />

            {isChecklistExpanded ? (
              <div className="task-inline-section">
                <Checklist
                  items={checklist}
                  inputRef={checklistCreateInputRef}
                  onAdd={async (title) => {
                    const res = await window.api.checklist.create({ task_id: detail.task.id, title })
                    if (!res.ok) {
                      setActionError(res.error)
                      return
                    }
                    setActionError(null)
                    setDetail((d) => {
                      if (!d) return d
                      const nextItems = [...d.checklist_items, res.data].sort((a, b) => a.position - b.position)
                      return { ...d, checklist_items: nextItems }
                    })
                  }}
                  onToggle={async (itemId, done) => {
                    const res = await window.api.checklist.update({ id: itemId, done })
                    if (!res.ok) {
                      setActionError(res.error)
                      return
                    }
                    setActionError(null)
                    setDetail((d) => {
                      if (!d) return d
                      const nextItems = d.checklist_items
                        .map((it) => (it.id === res.data.id ? res.data : it))
                        .sort((a, b) => a.position - b.position)
                      return { ...d, checklist_items: nextItems }
                    })
                  }}
                  onRename={async (itemId, title) => {
                    const res = await window.api.checklist.update({ id: itemId, title })
                    if (!res.ok) {
                      setActionError(res.error)
                      return
                    }
                    setActionError(null)
                    setDetail((d) => {
                      if (!d) return d
                      const nextItems = d.checklist_items
                        .map((it) => (it.id === res.data.id ? res.data : it))
                        .sort((a, b) => a.position - b.position)
                      return { ...d, checklist_items: nextItems }
                    })
                  }}
                  onDelete={async (itemId) => {
                    const res = await window.api.checklist.delete(itemId)
                    if (!res.ok) {
                      setActionError(res.error)
                      return
                    }
                    setActionError(null)
                    setDetail((d) => {
                      if (!d) return d
                      const nextItems = d.checklist_items.filter((it) => it.id !== itemId)
                      if (nextItems.length === 0) setIsChecklistExpanded(false)
                      return { ...d, checklist_items: nextItems }
                    })
                  }}
                />
              </div>
            ) : null}

            <div className="task-inline-action-bar">
            <div className="task-inline-action-bar-left">
              {draft.scheduled_at ? (
                <div className="task-inline-chip">
                  <button
                    type="button"
                    className="task-inline-chip-main"
                    onClick={(e) => openSchedulePicker(e.currentTarget as HTMLElement)}
                  >
                    Scheduled: {draft.scheduled_at === today ? 'Today' : draft.scheduled_at}
                  </button>
                  <button
                    type="button"
                    className="task-inline-chip-close"
                    aria-label="Clear scheduled"
                    onClick={(e) => {
                      e.preventDefault()
                      const next = { ...draft, scheduled_at: null }
                      setDraft(next)
                      scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : null}

              {draft.due_at ? (
                <div className="task-inline-chip">
                  <button type="button" className="task-inline-chip-main" onClick={(e) => openDuePicker(e.currentTarget as HTMLElement)}>
                    Due: {draft.due_at}
                  </button>
                  <button
                    type="button"
                    className="task-inline-chip-close"
                    aria-label="Clear due"
                    onClick={(e) => {
                      e.preventDefault()
                      const next = { ...draft, due_at: null }
                      setDraft(next)
                      scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : null}

              {selectedTagIds.size > 0 ? (
                <div className="task-inline-chip">
                  <button type="button" className="task-inline-chip-main" onClick={(e) => openTagsPicker(e.currentTarget as HTMLElement)}>
                    Tags: {selectedTagIds.size}
                  </button>
                  <button
                    type="button"
                    className="task-inline-chip-close"
                    aria-label="Clear tags"
                    onClick={(e) => {
                      e.preventDefault()
                      persistTags([])
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : null}
            </div>

            <div className="task-inline-action-bar-right">
              {!draft.scheduled_at ? (
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={(e) => openSchedulePicker(e.currentTarget as HTMLElement)}
                >
                  Schedule
                </button>
              ) : null}

              <button
                ref={tagsButtonRef}
                type="button"
                className="button button-ghost"
                onClick={(e) => openTagsPicker(e.currentTarget as HTMLElement)}
              >
                Tags
              </button>

              {!draft.due_at ? (
                <button type="button" className="button button-ghost" onClick={(e) => openDuePicker(e.currentTarget as HTMLElement)}>
                  Due
                </button>
              ) : null}

              {checklist.length === 0 ? (
                <button type="button" className="button" onClick={() => openChecklistAndFocus()}>
                  Checklist
                </button>
              ) : null}
            </div>
          </div>

          </div>

          {renderPopover()}
        </div>
      )
    }

    return (
      <div className={paperClassName}>
        <div className="overlay-paper-header">
          <div className="overlay-paper-title">Task</div>

          <div className="overlay-paper-status" aria-live="polite">
            {savePhase === 'saving'
              ? 'Saving…'
              : savePhase === 'error'
                ? 'Error'
                : isDirty
                  ? 'Unsaved'
                  : 'Saved'}
          </div>

          {savePhase === 'error' ? (
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                if (!draft) return
                requestSave(draft)
              }}
            >
              Retry
            </button>
          ) : null}

          <button type="button" className="button button-ghost" onClick={onRequestClose}>
            Close
          </button>
        </div>

        {saveError ? (
          <div className="error">
            <div className="error-code">{saveError.code}</div>
            <div>{saveError.message}</div>
          </div>
        ) : null}

        {actionError ? (
          <div className="error">
            <div className="error-code">{actionError.code}</div>
            <div>{actionError.message}</div>
          </div>
        ) : null}

        <div className="detail-meta" style={{ marginTop: 6 }}>
          <span className={`badge ${detail.task.status === 'done' ? 'badge-done' : 'badge-open'}`}>{statusLabel}</span>
          {detail.task.scheduled_at ? <span className="badge">Scheduled: {detail.task.scheduled_at}</span> : null}
          {detail.task.due_at ? <span className="badge">Due: {detail.task.due_at}</span> : null}
        </div>

        <div className="detail-field">
          <label className="label" htmlFor="task-title">
            Title
          </label>
          <input
            id="task-title"
            ref={titleInputRef}
            className="input"
            value={draft.title}
            onChange={(e) => {
              const next = { ...draft, title: e.target.value }
              setDraft(next)
              scheduleSave(next, TITLE_NOTES_DEBOUNCE_MS)
            }}
          />
        </div>

        <div className="detail-field">
          <label className="label" htmlFor="task-notes">
            Notes
          </label>
          <textarea
            id="task-notes"
            className="input"
            rows={8}
            value={draft.notes}
            onChange={(e) => {
              const next = { ...draft, notes: e.target.value }
              setDraft(next)
              scheduleSave(next, TITLE_NOTES_DEBOUNCE_MS)
            }}
            placeholder="Markdown supported (stored as plain text in v0.1)."
          />
        </div>

        <div className="detail-grid">
          <div className="detail-field">
            <label className="label" htmlFor="task-base-list">
              Base list
            </label>
            <select
              id="task-base-list"
              className="input"
              value={draft.base_list}
              onChange={(e) => {
                const next = { ...draft, base_list: e.target.value as Draft['base_list'] }
                setDraft(next)
                scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
              }}
            >
              <option value="inbox">Inbox</option>
              <option value="anytime">Anytime</option>
              <option value="someday">Someday</option>
            </select>
          </div>

          <div className="detail-field">
            <label className="label" htmlFor="task-project">
              Project
            </label>
            <select
              id="task-project"
              className="input"
              value={draft.project_id ?? ''}
              onChange={(e) => {
                const nextProject = e.target.value ? e.target.value : null
                const next = { ...draft, project_id: nextProject, section_id: null }
                setDraft(next)
                scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
              }}
            >
              <option value="">(none)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                const title = prompt('New project title')
                if (!title) return
                void (async () => {
                  const res = await window.api.project.create({ title })
                  if (!res.ok) {
                    setActionError(res.error)
                    return
                  }
                  setActionError(null)
                  const projectsRes = await window.api.project.listOpen()
                  if (projectsRes.ok) setProjects(projectsRes.data)
                  const next = { ...draft, project_id: res.data.id, section_id: null }
                  setDraft(next)
                  scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
                })()
              }}
            >
              +
            </button>
          </div>

          <div className="detail-field">
            <label className="label" htmlFor="task-section">
              Section
            </label>
            <select
              id="task-section"
              className="input"
              value={draft.section_id ?? ''}
              onChange={(e) => {
                const next = { ...draft, section_id: e.target.value ? e.target.value : null }
                setDraft(next)
                scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
              }}
              disabled={!draft.project_id}
            >
              <option value="">(none)</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title.trim() ? s.title : '(untitled)'}
                </option>
              ))}
            </select>
          </div>

          <div className="detail-field">
            <label className="label" htmlFor="task-area">
              Area
            </label>
            <select
              id="task-area"
              className="input"
              value={draft.area_id ?? ''}
              onChange={(e) => {
                const next = { ...draft, area_id: e.target.value ? e.target.value : null }
                setDraft(next)
                scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
              }}
            >
              <option value="">(none)</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>

          <div className="detail-field">
            <label className="label" htmlFor="task-scheduled">
              Scheduled
            </label>
            <input
              id="task-scheduled"
              className="input"
              type="date"
              value={draft.scheduled_at ?? ''}
              onChange={(e) => {
                const next = { ...draft, scheduled_at: e.target.value ? e.target.value : null }
                setDraft(next)
                scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
              }}
            />
            <div className="row">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  const next = { ...draft, scheduled_at: today }
                  setDraft(next)
                  scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
                }}
              >
                Today
              </button>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  const next = { ...draft, scheduled_at: null }
                  setDraft(next)
                  scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
                }}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="detail-field">
            <label className="label" htmlFor="task-due">
              Due
            </label>
            <input
              id="task-due"
              className="input"
              type="date"
              value={draft.due_at ?? ''}
              onChange={(e) => {
                const next = { ...draft, due_at: e.target.value ? e.target.value : null }
                setDraft(next)
                scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
              }}
            />
            <div className="row">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  const next = { ...draft, due_at: null }
                  setDraft(next)
                  scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="detail-field">
          <div className="label">Tags</div>
          <div className="tag-grid">
            {tags.map((tag) => {
              const checked = selectedTagIds.has(tag.id)
              return (
                <div key={tag.id} className="tag-pill">
                  <label className="tag-checkbox">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = new Set(selectedTagIds)
                        if (e.target.checked) next.add(tag.id)
                        else next.delete(tag.id)

                        void (async () => {
                          const res = await window.api.task.setTags(detail.task.id, Array.from(next))
                          if (!res.ok) {
                            setActionError(res.error)
                            return
                          }
                          setActionError(null)
                          setDetail((d) => (d ? { ...d, tag_ids: Array.from(next) } : d))
                        })()
                      }}
                    />
                    <span>{tag.title}</span>
                  </label>

                  <span className="tag-swatch" style={{ background: tag.color ?? 'transparent' }} aria-hidden="true" />

                  <select
                    className="tag-color"
                    value={tag.color ?? ''}
                    onChange={(e) => {
                      const nextColor = e.target.value ? e.target.value : null
                      void (async () => {
                        const res = await window.api.tag.update({ id: tag.id, color: nextColor })
                        if (!res.ok) {
                          setActionError(res.error)
                          return
                        }
                        setActionError(null)
                        const list = await window.api.tag.list()
                        if (list.ok) setTags(list.data)
                      })()
                    }}
                  >
                    {TAG_COLOR_PRESETS.map((c) => (
                      <option key={c.name} value={c.value ?? ''}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      const next = prompt('Rename tag', tag.title)
                      if (!next) return
                      void (async () => {
                        const res = await window.api.tag.update({ id: tag.id, title: next })
                        if (!res.ok) {
                          setActionError(res.error)
                          return
                        }
                        setActionError(null)
                        const list = await window.api.tag.list()
                        if (list.ok) setTags(list.data)
                      })()
                    }}
                  >
                    Rename
                  </button>

                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      const confirmed = confirm('Delete tag?')
                      if (!confirmed) return
                      void (async () => {
                        const res = await window.api.tag.delete(tag.id)
                        if (!res.ok) {
                          setActionError(res.error)
                          return
                        }
                        setActionError(null)
                        const list = await window.api.tag.list()
                        if (list.ok) setTags(list.data)
                      })()
                    }}
                  >
                    Delete
                  </button>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              const title = prompt('New tag')
              if (!title) return
              void (async () => {
                const res = await window.api.tag.create({ title })
                if (!res.ok) {
                  setActionError(res.error)
                  return
                }
                setActionError(null)
                const list = await window.api.tag.list()
                if (list.ok) setTags(list.data)
              })()
            }}
          >
            + Tag
          </button>
        </div>

        <div className="detail-field">
          <div className="label">Checklist</div>
          <Checklist
            items={checklist}
            onAdd={async (title) => {
              const res = await window.api.checklist.create({ task_id: detail.task.id, title })
              if (!res.ok) {
                setActionError(res.error)
                return
              }
              setActionError(null)
              setDetail((d) => {
                if (!d) return d
                const nextItems = [...d.checklist_items, res.data].sort((a, b) => a.position - b.position)
                return { ...d, checklist_items: nextItems }
              })
            }}
            onToggle={async (itemId, done) => {
              const res = await window.api.checklist.update({ id: itemId, done })
              if (!res.ok) {
                setActionError(res.error)
                return
              }
              setActionError(null)
              setDetail((d) => {
                if (!d) return d
                const nextItems = d.checklist_items
                  .map((it) => (it.id === res.data.id ? res.data : it))
                  .sort((a, b) => a.position - b.position)
                return { ...d, checklist_items: nextItems }
              })
            }}
            onRename={async (itemId, title) => {
              const res = await window.api.checklist.update({ id: itemId, title })
              if (!res.ok) {
                setActionError(res.error)
                return
              }
              setActionError(null)
              setDetail((d) => {
                if (!d) return d
                const nextItems = d.checklist_items
                  .map((it) => (it.id === res.data.id ? res.data : it))
                  .sort((a, b) => a.position - b.position)
                return { ...d, checklist_items: nextItems }
              })
            }}
            onDelete={async (itemId) => {
              const res = await window.api.checklist.delete(itemId)
              if (!res.ok) {
                setActionError(res.error)
                return
              }
              setActionError(null)
              setDetail((d) => {
                if (!d) return d
                const nextItems = d.checklist_items.filter((it) => it.id !== itemId)
                return { ...d, checklist_items: nextItems }
              })
            }}
          />
        </div>

        <div className="detail-actions">
          {detail.task.status === 'done' ? (
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                void (async () => {
                  const res = await window.api.task.restore(detail.task.id)
                  if (!res.ok) {
                    setActionError(res.error)
                    return
                  }
                  setActionError(null)
                  setDetail((d) => (d ? { ...d, task: res.data } : d))
                })()
              }}
            >
              Restore
            </button>
          ) : (
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                void (async () => {
                  const res = await window.api.task.toggleDone(detail.task.id, true)
                  if (!res.ok) {
                    setActionError(res.error)
                    return
                  }
                  setActionError(null)
                  setDetail((d) => (d ? { ...d, task: res.data } : d))
                })()
              }}
            >
              Mark Done
            </button>
          )}
        </div>
      </div>
    )
  }
)

function Checklist({
  items,
  inputRef,
  onAdd,
  onToggle,
  onRename,
  onDelete,
}: {
  items: ChecklistItem[]
  inputRef?: { current: HTMLInputElement | null }
  onAdd: (title: string) => Promise<void>
  onToggle: (id: string, done: boolean) => Promise<void>
  onRename: (id: string, title: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')

  return (
    <div>
      <div className="checklist-create">
        <input
          ref={inputRef}
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add checklist item…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const title = draft.trim()
              if (!title) return
              void (async () => {
                await onAdd(title)
                setDraft('')
              })()
            }
          }}
        />
        <button
          type="button"
          className="button"
          onClick={() => {
            const title = draft.trim()
            if (!title) return
            void (async () => {
              await onAdd(title)
              setDraft('')
            })()
          }}
        >
          Add
        </button>
      </div>

      <ul className="checklist">
        {items.map((item) => (
          <li key={item.id} className={`checklist-row${item.done ? ' is-done' : ''}`}>
            <label className="task-checkbox">
              <input
                type="checkbox"
                checked={item.done}
                onChange={(e) => void onToggle(item.id, e.target.checked)}
              />
            </label>
            <button
              type="button"
              className="checklist-title"
              onClick={() => {
                const next = prompt('Edit item', item.title)
                if (!next) return
                void onRename(item.id, next)
              }}
            >
              {item.title}
            </button>
            <button type="button" className="button button-ghost" onClick={() => void onDelete(item.id)}>
              Delete
            </button>
          </li>
        ))}
        {items.length === 0 ? <li className="nav-muted">(empty)</li> : null}
      </ul>
    </div>
  )
}
