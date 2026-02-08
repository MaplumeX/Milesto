import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../../shared/app-error'
import type { Area } from '../../../shared/schemas/area'
import type { ChecklistItem } from '../../../shared/schemas/checklist'
import type { Project, ProjectSection } from '../../../shared/schemas/project'
import type { Tag } from '../../../shared/schemas/tag'
import type { TaskDetail } from '../../../shared/schemas/task-detail'
import type { TaskUpdateInput } from '../../../shared/schemas/task'

import { formatLocalDate, parseLocalDate } from '../../lib/dates'

type Draft = {
  title: string
  notes: string
  is_inbox: boolean
  is_someday: boolean
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

type ChecklistRowView = {
  key: string
  itemId: string | null
  done: boolean
  titleDraft: string
  persistedTitle: string | null
}

type PickerKind = 'schedule' | 'due' | 'tags'
type ActivePicker = {
  kind: PickerKind
  anchorEl: HTMLElement
} | null

function createChecklistRowKey(counterRef: { current: number }): string {
  counterRef.current += 1
  return `checklist-row-${counterRef.current}`
}

function mergeChecklistRows(
  prevRows: ChecklistRowView[],
  items: ChecklistItem[],
  keyById: Map<string, string>,
  rowKeyCounterRef: { current: number },
  editingRowKey: string | null
): ChecklistRowView[] {
  const orderedItems = [...items].sort((a, b) => a.position - b.position)
  const itemById = new Map(orderedItems.map((item) => [item.id, item]))
  const retainedIds = new Set<string>()
  const nextRows: ChecklistRowView[] = []

  for (const row of prevRows) {
    if (!row.itemId) {
      nextRows.push(row)
      continue
    }

    const item = itemById.get(row.itemId)
    if (!item) continue

    const existingKey = keyById.get(item.id) ?? row.key
    keyById.set(item.id, existingKey)
    retainedIds.add(item.id)

    const shouldKeepDraft =
      editingRowKey === row.key && row.titleDraft !== (row.persistedTitle ?? item.title)

    nextRows.push({
      key: existingKey,
      itemId: item.id,
      done: item.done,
      titleDraft: shouldKeepDraft ? row.titleDraft : item.title,
      persistedTitle: item.title,
    })
  }

  for (const item of orderedItems) {
    if (retainedIds.has(item.id)) continue
    const key = keyById.get(item.id) ?? createChecklistRowKey(rowKeyCounterRef)
    keyById.set(item.id, key)
    nextRows.push({
      key,
      itemId: item.id,
      done: item.done,
      titleDraft: item.title,
      persistedTitle: item.title,
    })
  }

  for (const persistedId of Array.from(keyById.keys())) {
    if (!itemById.has(persistedId)) keyById.delete(persistedId)
  }

  return nextRows
}

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
  let next = draft

  // Someday and a concrete scheduled date are mutually exclusive.
  // If both are present (shouldn't happen), let the date win.
  if (next.scheduled_at !== null && next.is_someday) {
    next = { ...next, is_someday: false }
  }

  // Inbox is for unprocessed items. Any concrete plan/assignment moves it out.
  if (next.is_inbox && (next.project_id !== null || next.scheduled_at !== null || next.is_someday)) {
    next = { ...next, is_inbox: false }
  }

  return next
}

function isDraftEqual(a: Draft, b: Draft): boolean {
  return (
    a.title === b.title &&
    a.notes === b.notes &&
    a.is_inbox === b.is_inbox &&
    a.is_someday === b.is_someday &&
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
  if (prev.is_inbox !== next.is_inbox) patch.is_inbox = next.is_inbox
  if (prev.is_someday !== next.is_someday) patch.is_someday = next.is_someday
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

function normalizeTagTitle(title: string): string {
  return title.trim().toLowerCase()
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
    const { t } = useTranslation()
    const titleInputRef = useRef<HTMLInputElement | null>(null)
    const notesInputRef = useRef<HTMLTextAreaElement | null>(null)

    const inlineRootRef = useRef<HTMLDivElement | null>(null)
    const popoverRef = useRef<HTMLDivElement | null>(null)
    const tagsButtonRef = useRef<HTMLButtonElement | null>(null)

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
    const [tagCreateError, setTagCreateError] = useState<AppError | null>(null)
    const [tagCreateTitle, setTagCreateTitle] = useState('')
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
    const lastFlushFailureTargetRef = useRef<'title' | 'tags' | 'checklist'>('title')

    const tagsSaveSeqRef = useRef(0)
    const tagsSavePromiseRef = useRef<Promise<void> | null>(null)
    const tagsSaveErrorRef = useRef<AppError | null>(null)

    const [checklistError, setChecklistError] = useState<AppError | null>(null)
    const checklistErrorRef = useRef<AppError | null>(null)
    const checklistMutationSetRef = useRef(new Set<Promise<unknown>>())

    useEffect(() => {
      tagsSaveErrorRef.current = tagsError
    }, [tagsError])

    useEffect(() => {
      checklistErrorRef.current = checklistError
    }, [checklistError])

    const [isChecklistExpanded, setIsChecklistExpanded] = useState(false)
    const [checklistCreateRequestToken, setChecklistCreateRequestToken] = useState(0)
    const checklistActionButtonRef = useRef<HTMLButtonElement | null>(null)

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

    function focusTitle() {
      titleInputRef.current?.focus()
    }

    function focusLastErrorTarget() {
      if (lastFlushFailureTargetRef.current === 'tags') {
        tagsButtonRef.current?.focus()
        return
      }

      if (lastFlushFailureTargetRef.current === 'checklist') {
        const checklistInput = document.querySelector<HTMLInputElement>('.checklist-title-input')
        if (checklistInput) {
          checklistInput.focus()
          return
        }
        checklistActionButtonRef.current?.focus()
        return
      }

      focusTitle()
    }

    const closeActivePicker = useCallback((opts?: { restoreFocus?: boolean }) => {
      const current = activePickerRef.current
      if (!current) return
      const anchorEl = current.anchorEl
      setActivePicker(null)

      if (!opts?.restoreFocus) return

      window.setTimeout(() => {
        if (anchorEl.isConnected) anchorEl.focus()
      }, 0)
    }, [])

    useEffect(() => {
      if (variant !== 'inline') return

      function handlePointerDown(e: PointerEvent) {
        if (e.button !== 0) return
        if (!(e.target instanceof Node)) return

        const root = inlineRootRef.current
        if (!root) return
        const popover = popoverRef.current
        const isInsideRoot = root.contains(e.target)
        const isInsidePopover = popover ? popover.contains(e.target) : false

        if (isInsidePopover) return

        if (activePicker) {
          // Clicking anywhere outside the popover should dismiss it.
          // If the click is outside the editor, keep the existing two-step close behavior.
          if (!isInsideRoot) {
            e.preventDefault()
            e.stopPropagation()
          }
          setActivePicker(null)
          return
        }

        if (isInsideRoot) return

        // Dismiss pickers first. If no picker is open, attempt to close the editor.
        e.preventDefault()
        e.stopPropagation()

        onRequestClose()
      }

      document.addEventListener('pointerdown', handlePointerDown, true)
      return () => document.removeEventListener('pointerdown', handlePointerDown, true)
    }, [activePicker, onRequestClose, variant])

    useEffect(() => {
      if (!activePicker) return

      // Close pickers on scroll/resize to avoid stale positioning.
      function handleClose() {
        // Scroll/resize is not an intentional dismissal; don't steal focus.
        setActivePicker(null)
      }

      window.addEventListener('resize', handleClose)
      window.addEventListener('scroll', handleClose, true)
      return () => {
        window.removeEventListener('resize', handleClose)
        window.removeEventListener('scroll', handleClose, true)
      }
    }, [activePicker])

    function scheduleSave(nextDraft: Draft, debounceMs: number) {
      if (saveDebounceRef.current) window.clearTimeout(saveDebounceRef.current)

      saveDebounceRef.current = window.setTimeout(() => {
        saveDebounceRef.current = null
        requestSave(nextDraft)
      }, debounceMs)
    }

    function trackChecklistMutation<T>(mutation: Promise<T>): Promise<T> {
      checklistMutationSetRef.current.add(mutation)
      void mutation.finally(() => {
        checklistMutationSetRef.current.delete(mutation)
      })
      return mutation
    }

    function requestSave(nextDraft: Draft) {
      const currentTaskId = taskIdRef.current
      const prev = lastSavedRef.current
      if (!prev) return

      const normalized = normalizeDraft(nextDraft)
      if (
        normalized.is_inbox !== nextDraft.is_inbox ||
        normalized.is_someday !== nextDraft.is_someday ||
        normalized.scheduled_at !== nextDraft.scheduled_at
      ) {
        // Keep the UI truthful when normalization rules apply.
        setDraft((d) =>
          d
            ? {
                ...d,
                is_inbox: normalized.is_inbox,
                is_someday: normalized.is_someday,
                scheduled_at: normalized.scheduled_at,
              }
            : d
        )
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

      while (checklistMutationSetRef.current.size > 0) {
        const pending = Array.from(checklistMutationSetRef.current)
        await Promise.allSettled(pending)
      }

      if (saveErrorRef.current) return false
      if (tagsSaveErrorRef.current) return false
      if (checklistErrorRef.current) return false
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
      setChecklistError(null)
      setSaveError(null)
      setSavePhase('idle')
      setActivePicker(null)
      setDetail(null)
      setDraft(null)
      setLastSaved(null)
      setIsChecklistExpanded(false)
      setChecklistCreateRequestToken(0)
      lastSavedRef.current = null
      pendingSnapshotRef.current = null
      tagsSavePromiseRef.current = null
      tagsSaveSeqRef.current = 0
      checklistMutationSetRef.current.clear()
      checklistErrorRef.current = null
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
          is_inbox: res.data.task.is_inbox,
          is_someday: res.data.task.is_someday,
          project_id: res.data.task.project_id,
          section_id: res.data.task.section_id,
          area_id: res.data.task.area_id,
          scheduled_at: res.data.task.scheduled_at,
          due_at: res.data.task.due_at,
        }

        setDetail(res.data)
        setDraft(nextDraft)
        setIsChecklistExpanded(res.data.checklist_items.length > 0)
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

    const paperClassName = variant === 'inline' ? 'task-inline-paper' : 'overlay-paper'

    if (loadError) {
      return (
        <div className={paperClassName}>
          <div className="overlay-paper-header">
            <div className="overlay-paper-title">{t('taskEditor.taskTitle')}</div>
            <button type="button" className="button button-ghost" onClick={onRequestClose}>
              {t('common.close')}
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
            <div className="overlay-paper-title">{t('taskEditor.taskTitle')}</div>
            <button type="button" className="button button-ghost" onClick={onRequestClose}>
              {t('common.close')}
            </button>
          </div>
          <div className="nav-muted">{t('common.loading')}</div>
        </div>
      )
    }

    const statusLabel = detail.task.status === 'done' ? t('taskEditor.statusDone') : t('taskEditor.statusOpen')

    const createChecklistItem = async (title: string): Promise<ChecklistItem | null> => {
      const nextTitle = title.trim()
      if (!nextTitle) return null

      setChecklistError(null)

      const mutation = (async () => {
        const res = await window.api.checklist.create({ task_id: detail.task.id, title: nextTitle })
        if (!res.ok) {
          lastFlushFailureTargetRef.current = 'checklist'
          setChecklistError(res.error)
          return null
        }

        setChecklistError(null)
        setDetail((d) => {
          if (!d) return d
          const nextItems = [...d.checklist_items, res.data].sort((a, b) => a.position - b.position)
          return { ...d, checklist_items: nextItems }
        })

        return res.data
      })()

      return trackChecklistMutation(mutation)
    }

    const toggleChecklistItem = async (itemId: string, done: boolean): Promise<ChecklistItem | null> => {
      setChecklistError(null)

      const mutation = (async () => {
        const res = await window.api.checklist.update({ id: itemId, done })
        if (!res.ok) {
          lastFlushFailureTargetRef.current = 'checklist'
          setChecklistError(res.error)
          return null
        }

        setChecklistError(null)
        setDetail((d) => {
          if (!d) return d
          const nextItems = d.checklist_items
            .map((it) => (it.id === res.data.id ? res.data : it))
            .sort((a, b) => a.position - b.position)
          return { ...d, checklist_items: nextItems }
        })

        return res.data
      })()

      return trackChecklistMutation(mutation)
    }

    const renameChecklistItem = async (itemId: string, title: string): Promise<ChecklistItem | null> => {
      const nextTitle = title.trim()
      if (!nextTitle) return null

      setChecklistError(null)

      const mutation = (async () => {
        const res = await window.api.checklist.update({ id: itemId, title: nextTitle })
        if (!res.ok) {
          lastFlushFailureTargetRef.current = 'checklist'
          setChecklistError(res.error)
          return null
        }

        setChecklistError(null)
        setDetail((d) => {
          if (!d) return d
          const nextItems = d.checklist_items
            .map((it) => (it.id === res.data.id ? res.data : it))
            .sort((a, b) => a.position - b.position)
          return { ...d, checklist_items: nextItems }
        })

        return res.data
      })()

      return trackChecklistMutation(mutation)
    }

    const deleteChecklistItem = async (itemId: string): Promise<boolean> => {
      setChecklistError(null)

      const mutation = (async () => {
        const res = await window.api.checklist.delete(itemId)
        if (!res.ok) {
          lastFlushFailureTargetRef.current = 'checklist'
          setChecklistError(res.error)
          return false
        }

        setChecklistError(null)
        setDetail((d) => {
          if (!d) return d
          const nextItems = d.checklist_items.filter((it) => it.id !== itemId)
          return { ...d, checklist_items: nextItems }
        })

        return true
      })()

      return trackChecklistMutation(mutation)
    }

    const collapseInlineChecklist = () => {
      if (variant !== 'inline') return
      setIsChecklistExpanded(false)
      window.setTimeout(() => {
        checklistActionButtonRef.current?.focus()
      }, 0)
    }

    if (variant === 'inline') {
      function openChecklistAndFocus() {
        setIsChecklistExpanded(true)
        setChecklistCreateRequestToken((v) => v + 1)
      }

      const openSchedulePicker = (anchorEl: HTMLElement) => {
        setActivePicker({ kind: 'schedule', anchorEl })
      }

      const openDuePicker = (anchorEl: HTMLElement) => {
        setActivePicker({ kind: 'due', anchorEl })
      }

      const openTagsPicker = (anchorEl: HTMLElement) => {
        setTagCreateError(null)
        setTagCreateTitle('')
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
        const viewportPadding = 12
        const isCalendar = activePicker.kind === 'schedule' || activePicker.kind === 'due'

        const isTags = activePicker.kind === 'tags'

        // Keep inline pickers compact.
        const maxWidth = isTags ? 220 : 236
        const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - maxWidth - viewportPadding)

        const preferredTop = rect.bottom + 8
        const spaceBelow = window.innerHeight - viewportPadding - preferredTop
        const spaceAbove = rect.top - 8 - viewportPadding
        const estimatedCalendarHeight = 250
        const openCalendarAbove =
          isCalendar && spaceBelow < estimatedCalendarHeight && spaceAbove > spaceBelow

        const top = (() => {
          if (!isCalendar) return Math.min(preferredTop, window.innerHeight - viewportPadding)

          // When flipping above, anchor the popover edge to the trigger edge.
          return openCalendarAbove ? rect.top - 8 : preferredTop
        })()

        const maxHeight = (() => {
          if (!isCalendar) return undefined

          const sideSpace = openCalendarAbove ? spaceAbove : spaceBelow
          // Keep it usable when viewport is tight.
          return Math.max(180, sideSpace)
        })()

        return createPortal(
          <div
            ref={popoverRef}
            className={
              isCalendar
                ? 'task-inline-popover task-inline-popover-calendar'
                : isTags
                  ? 'task-inline-popover task-inline-popover-tags'
                  : 'task-inline-popover'
            }
            role="dialog"
            style={{
              position: 'fixed',
              top,
              left,
              width: maxWidth,
              maxHeight: isCalendar ? maxHeight : undefined,
              transform: openCalendarAbove ? 'translateY(-100%)' : undefined,
              zIndex: 45,
            }}
          >
            {activePicker.kind === 'tags' ? (
              <div className="task-inline-popover-body">
                <div className="task-inline-popover-title">{t('taskEditor.tagsLabel')}</div>
                <input
                  className="input"
                  placeholder={t('taskEditor.newTagPlaceholder')}
                  value={tagCreateTitle}
                  onChange={(e) => {
                    setTagCreateTitle(e.target.value)
                    if (tagCreateError) setTagCreateError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    e.stopPropagation()

                    const title = tagCreateTitle.trim()
                    if (!title) return

                    const normalized = normalizeTagTitle(title)
                    const existing = tags.find((t) => normalizeTagTitle(t.title) === normalized)
                    if (existing) {
                      const next = new Set(selectedTagIds)
                      next.add(existing.id)
                      if (next.size !== selectedTagIds.size) persistTags(Array.from(next))
                      setTagCreateTitle('')
                      setTagCreateError(null)
                      return
                    }

                    void (async () => {
                      setTagCreateError(null)
                      const res = await window.api.tag.create({ title })
                      if (!res.ok) {
                        setTagCreateError(res.error)
                        return
                      }

                      setTagCreateTitle('')
                      const list = await window.api.tag.list()
                      if (list.ok) setTags(list.data)

                      const next = new Set(selectedTagIds)
                      next.add(res.data.id)
                      if (next.size !== selectedTagIds.size) persistTags(Array.from(next))
                    })()
                  }}
                  style={{ marginTop: 6 }}
                />

                {tagCreateError ? (
                  <div className="error" style={{ margin: '10px 0 0' }}>
                    <div className="error-code">{tagCreateError.code}</div>
                    <div>{tagCreateError.message}</div>
                  </div>
                ) : null}
                <div className="tag-grid" style={{ marginTop: 6 }}>
                  {tags.map((tag) => {
                    const checked = selectedTagIds.has(tag.id)
                    return (
                      <label key={tag.id} className="tag-checkbox" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
                <div className="task-inline-popover-title">{t('taskEditor.popoverScheduleTitle')}</div>
                <div className="task-inline-calendar" style={{ marginTop: 8 }}>
                  <DayPicker
                    mode="single"
                    selected={!draft.is_someday && draft.scheduled_at ? parseLocalDate(draft.scheduled_at) ?? undefined : undefined}
                    onSelect={(date) => {
                      const nextDate = date ? formatLocalDate(date) : null
                      const next = {
                        ...draft,
                        scheduled_at: nextDate,
                        is_someday: false,
                        // Assigning a concrete schedule is a form of processing; it must leave Inbox.
                        is_inbox: nextDate ? false : draft.is_inbox,
                      }
                      setDraft(next)
                      scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
                      closeActivePicker({ restoreFocus: true })
                    }}
                    weekStartsOn={1}
                    showOutsideDays
                    fixedWeeks
                    autoFocus
                  />
                </div>
                <div className="row" style={{ justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      const next = { ...draft, is_someday: true, scheduled_at: null, is_inbox: false }
                      setDraft(next)
                      scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
                      closeActivePicker({ restoreFocus: true })
                    }}
                  >
                    {t('nav.someday')}
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      const next = { ...draft, scheduled_at: today, is_someday: false, is_inbox: false }
                      setDraft(next)
                      scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
                      closeActivePicker({ restoreFocus: true })
                    }}
                  >
                    {t('nav.today')}
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      const next = { ...draft, scheduled_at: null, is_someday: false }
                      setDraft(next)
                      scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
                      closeActivePicker({ restoreFocus: true })
                    }}
                  >
                    {t('common.clear')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="task-inline-popover-body">
                <div className="task-inline-popover-title">{t('taskEditor.popoverDueTitle')}</div>
                <div className="task-inline-calendar" style={{ marginTop: 8 }}>
                  <DayPicker
                    mode="single"
                    selected={draft.due_at ? parseLocalDate(draft.due_at) ?? undefined : undefined}
                    onSelect={(date) => {
                      const next = { ...draft, due_at: date ? formatLocalDate(date) : null }
                      setDraft(next)
                      scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
                      closeActivePicker({ restoreFocus: true })
                    }}
                    weekStartsOn={1}
                    showOutsideDays
                    fixedWeeks
                    autoFocus
                  />
                </div>
                <div className="row" style={{ justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      const next = { ...draft, due_at: null }
                      setDraft(next)
                      scheduleSave(next, OTHER_FIELDS_DEBOUNCE_MS)
                      closeActivePicker({ restoreFocus: true })
                    }}
                  >
                    {t('common.clear')}
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
            closeActivePicker({ restoreFocus: true })
          }}
        >
          <div className="task-inline-header">
            <label className="task-checkbox" aria-label={t('aria.taskDone')}>
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
              placeholder={t('task.titlePlaceholder')}
            />

            {savePhase === 'error' ? (
              <div className="task-inline-header-right">
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => {
                    requestSave(draft)
                  }}
                >
                  {t('common.retry')}
                </button>
              </div>
            ) : null}
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

            {checklistError ? (
              <div className="error">
                <div className="error-code">{checklistError.code}</div>
                <div>{checklistError.message}</div>
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
              placeholder={t('task.notesPlaceholder')}
            />

            {isChecklistExpanded ? (
              <div className="task-inline-section">
                <Checklist
                  items={checklist}
                  variant="inline"
                  createRequestToken={checklistCreateRequestToken}
                  fallbackFocusRef={checklistActionButtonRef}
                  onCreate={createChecklistItem}
                  onToggle={toggleChecklistItem}
                  onRename={renameChecklistItem}
                  onDelete={deleteChecklistItem}
                  onCollapseWhenEmpty={collapseInlineChecklist}
                />
              </div>
            ) : null}

            <div className="task-inline-action-bar">
            <div className="task-inline-action-bar-left">
              {draft.scheduled_at || draft.is_someday ? (
                <div className="task-inline-chip">
                  <button
                    type="button"
                    className="task-inline-chip-main"
                    onClick={(e) => openSchedulePicker(e.currentTarget as HTMLElement)}
                  >
                    {t('taskEditor.scheduledPrefix')} {draft.is_someday ? t('nav.someday') : draft.scheduled_at === today ? t('nav.today') : draft.scheduled_at}
                  </button>
                  <button
                    type="button"
                    className="task-inline-chip-close"
                    aria-label={t('taskEditor.clearScheduledAria')}
                    onClick={(e) => {
                      e.preventDefault()
                      const next = draft.is_someday ? { ...draft, is_someday: false } : { ...draft, scheduled_at: null }
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
                    {t('taskEditor.duePrefix')} {draft.due_at}
                  </button>
                  <button
                    type="button"
                    className="task-inline-chip-close"
                    aria-label={t('taskEditor.clearDueAria')}
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
                    {t('taskEditor.tagsPrefix')} {selectedTagIds.size}
                  </button>
                  <button
                    type="button"
                    className="task-inline-chip-close"
                    aria-label={t('taskEditor.clearTagsAria')}
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
              {!draft.scheduled_at && !draft.is_someday ? (
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={(e) => openSchedulePicker(e.currentTarget as HTMLElement)}
                >
                  {t('common.schedule')}
                </button>
              ) : null}

              <button
                ref={tagsButtonRef}
                type="button"
                className="button button-ghost"
                onClick={(e) => openTagsPicker(e.currentTarget as HTMLElement)}
              >
                {t('taskEditor.tagsLabel')}
              </button>

              {!draft.due_at ? (
                <button type="button" className="button button-ghost" onClick={(e) => openDuePicker(e.currentTarget as HTMLElement)}>
                  {t('taskEditor.dueLabel')}
                </button>
              ) : null}

              {checklist.length === 0 && !isChecklistExpanded ? (
                <button
                  ref={checklistActionButtonRef}
                  type="button"
                  className="button"
                  onClick={() => openChecklistAndFocus()}
                >
                  {t('taskEditor.checklistLabel')}
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
          <div className="overlay-paper-title">{t('taskEditor.taskTitle')}</div>

          {savePhase === 'error' ? (
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                if (!draft) return
                requestSave(draft)
              }}
            >
              {t('common.retry')}
            </button>
          ) : null}

          <button type="button" className="button button-ghost" onClick={onRequestClose}>
            {t('common.close')}
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

        {checklistError ? (
          <div className="error">
            <div className="error-code">{checklistError.code}</div>
            <div>{checklistError.message}</div>
          </div>
        ) : null}

        <div className="detail-meta" style={{ marginTop: 6 }}>
          <span className={`badge ${detail.task.status === 'done' ? 'badge-done' : 'badge-open'}`}>{statusLabel}</span>
          {detail.task.is_someday ? (
            <span className="badge">
              {t('taskEditor.scheduledPrefix')} {t('nav.someday')}
            </span>
          ) : detail.task.scheduled_at ? (
            <span className="badge">
              {t('taskEditor.scheduledPrefix')} {detail.task.scheduled_at}
            </span>
          ) : null}
          {detail.task.due_at ? (
            <span className="badge">
              {t('taskEditor.duePrefix')} {detail.task.due_at}
            </span>
          ) : null}
        </div>

        <div className="detail-field">
          <label className="label" htmlFor="task-title">
            {t('taskEditor.titleLabel')}
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
            {t('taskEditor.notesLabel')}
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
            placeholder={t('taskEditor.markdownPlaceholder')}
          />
        </div>

        <div className="detail-grid">
          <div className="detail-field">
            <label className="label" htmlFor="task-project">
              {t('taskEditor.projectLabel')}
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
              <option value="">{t('common.noneOption')}</option>
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
                const title = prompt(t('project.newTitlePrompt'))
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
              {t('taskEditor.sectionLabel')}
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
              <option value="">{t('common.noneOption')}</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title.trim() ? s.title : t('common.untitled')}
                </option>
              ))}
            </select>
          </div>

          <div className="detail-field">
            <label className="label" htmlFor="task-area">
              {t('taskEditor.areaLabel')}
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
              <option value="">{t('common.noneOption')}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>

          <div className="detail-field">
            <label className="label" htmlFor="task-scheduled">
              {t('taskEditor.scheduledLabel')}
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
                {t('nav.today')}
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
                {t('common.clear')}
              </button>
            </div>
          </div>

          <div className="detail-field">
            <label className="label" htmlFor="task-due">
              {t('taskEditor.dueLabel')}
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
                {t('common.clear')}
              </button>
            </div>
          </div>
        </div>

        <div className="detail-field">
          <div className="label">{t('taskEditor.tagsLabel')}</div>
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
                      const next = prompt(t('tag.renamePromptTitle'), tag.title)
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
                    {t('common.rename')}
                  </button>

                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      const confirmed = confirm(t('tag.deleteConfirm'))
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
                    {t('common.delete')}
                  </button>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              const title = prompt(t('tag.newPromptTitle'))
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
            {t('common.addTag')}
          </button>
        </div>

        <div className="detail-field">
          <div className="label">{t('taskEditor.checklistLabel')}</div>
          <Checklist
            items={checklist}
            variant="overlay"
            onCreate={createChecklistItem}
            onToggle={toggleChecklistItem}
            onRename={renameChecklistItem}
            onDelete={deleteChecklistItem}
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
              {t('task.restore')}
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
              {t('taskEditor.markDone')}
            </button>
          )}
        </div>
      </div>
    )
  }
)

function Checklist({
  items,
  variant,
  createRequestToken,
  fallbackFocusRef,
  onCreate,
  onToggle,
  onRename,
  onDelete,
  onCollapseWhenEmpty,
}: {
  items: ChecklistItem[]
  variant: TaskEditorVariant
  createRequestToken?: number
  fallbackFocusRef?: { current: HTMLButtonElement | null }
  onCreate: (title: string) => Promise<ChecklistItem | null>
  onToggle: (id: string, done: boolean) => Promise<ChecklistItem | null>
  onRename: (id: string, title: string) => Promise<ChecklistItem | null>
  onDelete: (id: string) => Promise<boolean>
  onCollapseWhenEmpty?: () => void
}) {
  const { t } = useTranslation()
  const rowKeyCounterRef = useRef(0)
  const keyByIdRef = useRef(new Map<string, string>())
  const editingRowKeyRef = useRef<string | null>(null)

  const [rows, setRows] = useState<ChecklistRowView[]>(() =>
    mergeChecklistRows([], items, keyByIdRef.current, rowKeyCounterRef, null)
  )
  const rowsRef = useRef(rows)
  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  useEffect(() => {
    setRows((prev) => mergeChecklistRows(prev, items, keyByIdRef.current, rowKeyCounterRef, editingRowKeyRef.current))
  }, [items])

  const rowInputRefs = useRef(new Map<string, HTMLInputElement>())
  const pendingFocusRef = useRef<
    | { type: 'row'; key: string; selectAll?: boolean; cursor?: 'start' | 'end' }
    | { type: 'fallback' }
    | null
  >(null)
  const committingRowsRef = useRef(new Set<string>())
  const composingRowsRef = useRef(new Set<string>())

  const queueRowFocus = useCallback((key: string, options?: { selectAll?: boolean; cursor?: 'start' | 'end' }) => {
    pendingFocusRef.current = { type: 'row', key, ...options }
  }, [])

  const queueFallbackFocus = useCallback(() => {
    pendingFocusRef.current = { type: 'fallback' }
  }, [])

  useEffect(() => {
    const pending = pendingFocusRef.current
    if (!pending) return

    if (pending.type === 'row') {
      const input = rowInputRefs.current.get(pending.key)
      if (!input) return
      pendingFocusRef.current = null
      input.focus()
      if (pending.selectAll === false) {
        const pos = pending.cursor === 'start' ? 0 : input.value.length
        input.setSelectionRange(pos, pos)
      } else {
        input.select()
      }
      return
    }

    pendingFocusRef.current = null
    fallbackFocusRef?.current?.focus()
  })

  const ensureEditableRow = useCallback(() => {
    setRows((prev) => {
      if (prev.length > 0) {
        queueRowFocus(prev[0].key)
        return prev
      }

      const key = createChecklistRowKey(rowKeyCounterRef)
      queueRowFocus(key)

      return [
        {
          key,
          itemId: null,
          done: false,
          titleDraft: '',
          persistedTitle: null,
        },
      ]
    })
  }, [queueRowFocus])

  const lastCreateRequestRef = useRef<number | null>(null)
  useEffect(() => {
    if (createRequestToken === undefined) return
    if (lastCreateRequestRef.current === createRequestToken) return
    lastCreateRequestRef.current = createRequestToken
    ensureEditableRow()
  }, [createRequestToken, ensureEditableRow])

  const commitRow = useCallback(
    async (rowKey: string, source: 'enter' | 'blur') => {
      if (committingRowsRef.current.has(rowKey)) return

      const snapshot = rowsRef.current.find((row) => row.key === rowKey)
      if (!snapshot) return

      committingRowsRef.current.add(rowKey)
      try {
        const rowIndex = rowsRef.current.findIndex((row) => row.key === rowKey)
        if (rowIndex === -1) return

        const nextTitle = snapshot.titleDraft.trim()
        const nextRowKey = rowsRef.current[rowIndex + 1]?.key ?? null
        const previousRowKey = rowsRef.current[rowIndex - 1]?.key ?? null

        if (!nextTitle) {
          let deleted = true
          if (snapshot.itemId) {
            deleted = await onDelete(snapshot.itemId)
          }
          if (!deleted) return

          const remainingCount = rowsRef.current.length - 1
          setRows((prev) => prev.filter((row) => row.key !== rowKey))

          if (remainingCount === 0 && variant === 'inline') {
            onCollapseWhenEmpty?.()
            return
          }

          if (nextRowKey) {
            queueRowFocus(nextRowKey)
            return
          }
          if (previousRowKey) {
            queueRowFocus(previousRowKey, { selectAll: false, cursor: 'end' })
            return
          }
          queueFallbackFocus()
          return
        }

        if (!snapshot.itemId) {
          const created = await onCreate(nextTitle)
          if (!created) return
          keyByIdRef.current.set(created.id, snapshot.key)
          setRows((prev) =>
            prev.map((row) =>
              row.key === rowKey
                ? {
                    ...row,
                    itemId: created.id,
                    done: created.done,
                    titleDraft: created.title,
                    persistedTitle: created.title,
                  }
                : row
            )
          )
        } else if (snapshot.persistedTitle !== nextTitle) {
          const updated = await onRename(snapshot.itemId, nextTitle)
          if (!updated) return
          setRows((prev) =>
            prev.map((row) =>
              row.key === rowKey
                ? {
                    ...row,
                    done: updated.done,
                    titleDraft: updated.title,
                    persistedTitle: updated.title,
                  }
                : row
            )
          )
        } else {
          setRows((prev) =>
            prev.map((row) => (row.key === rowKey ? { ...row, persistedTitle: nextTitle } : row))
          )
        }

        if (source !== 'enter') return

        const insertedKey = createChecklistRowKey(rowKeyCounterRef)
        setRows((prev) => {
          const currentIndex = prev.findIndex((row) => row.key === rowKey)
          if (currentIndex === -1) return prev
          const nextRows = [...prev]
          nextRows.splice(currentIndex + 1, 0, {
            key: insertedKey,
            itemId: null,
            done: false,
            titleDraft: '',
            persistedTitle: null,
          })
          return nextRows
        })
        queueRowFocus(insertedKey)
      } finally {
        committingRowsRef.current.delete(rowKey)
      }
    },
    [onCollapseWhenEmpty, onCreate, onDelete, onRename, queueFallbackFocus, queueRowFocus, variant]
  )

  const handleToggle = useCallback(
    (rowKey: string, done: boolean) => {
      const snapshot = rowsRef.current.find((row) => row.key === rowKey)
      if (!snapshot) return

      setRows((prev) => prev.map((row) => (row.key === rowKey ? { ...row, done } : row)))

      if (!snapshot.itemId) return

      void (async () => {
        const updated = await onToggle(snapshot.itemId as string, done)
        if (!updated) {
          setRows((prev) => prev.map((row) => (row.key === rowKey ? { ...row, done: snapshot.done } : row)))
          return
        }

        setRows((prev) =>
          prev.map((row) =>
            row.key === rowKey
              ? {
                  ...row,
                  done: updated.done,
                  persistedTitle: updated.title,
                }
              : row
          )
        )
      })()
    },
    [onToggle]
  )

  return (
    <ul className="checklist">
      {rows.map((row) => (
        <li key={row.key} className={`checklist-row${row.done ? ' is-done' : ''}`}>
          <label className="task-checkbox" aria-label={t('taskEditor.checklistItemDoneAria')}>
            <input
              type="checkbox"
              checked={row.done}
              onChange={(e) => handleToggle(row.key, e.target.checked)}
              disabled={!row.itemId}
            />
          </label>

          <input
            ref={(el) => {
              if (el) rowInputRefs.current.set(row.key, el)
              else rowInputRefs.current.delete(row.key)
            }}
            className="checklist-title-input"
            value={row.titleDraft}
            placeholder={t('taskEditor.checklistItemPlaceholder')}
            onFocus={() => {
              editingRowKeyRef.current = row.key
            }}
            onChange={(e) => {
              const nextTitle = e.target.value
              setRows((prev) =>
                prev.map((candidate) =>
                  candidate.key === row.key
                    ? {
                        ...candidate,
                        titleDraft: nextTitle,
                      }
                    : candidate
                )
              )
            }}
            onCompositionStart={() => {
              composingRowsRef.current.add(row.key)
            }}
            onCompositionEnd={() => {
              composingRowsRef.current.delete(row.key)
            }}
            onBlur={() => {
              editingRowKeyRef.current = null
              composingRowsRef.current.delete(row.key)
              void commitRow(row.key, 'blur')
            }}
            onKeyDown={(e) => {
              const isDeleteKey = e.key === 'Backspace' || e.key === 'Delete'

              if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ' || isDeleteKey) {
                e.stopPropagation()
              }

              if (isDeleteKey && row.titleDraft === '') {
                e.preventDefault()
                void commitRow(row.key, 'blur')
                return
              }

              if (e.key !== 'Enter') return

              const nativeEvent = e.nativeEvent as KeyboardEvent & { isComposing?: boolean; keyCode?: number }
              if (composingRowsRef.current.has(row.key) || nativeEvent.isComposing || nativeEvent.keyCode === 229) {
                return
              }

              e.preventDefault()
              void commitRow(row.key, 'enter')
            }}
          />
        </li>
      ))}

      {rows.length === 0 ? (
        <li className="checklist-empty">
          <button
            type="button"
            className="checklist-empty-entry"
            onClick={() => {
              ensureEditableRow()
            }}
          >
            {variant === 'overlay' ? 'Create first checklist item' : 'Create checklist item'}
          </button>
        </li>
      ) : null}
    </ul>
  )
}
