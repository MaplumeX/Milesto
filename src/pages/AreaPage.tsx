import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../shared/app-error'
import type { Area } from '../../shared/schemas/area'
import type { Project } from '../../shared/schemas/project'
import type { TaskListItem } from '../../shared/schemas/task-list'
import { taskListIdArea } from '../../shared/task-list-ids'

import { useAppEvents } from '../app/AppEventsContext'
import { TaskList } from '../features/tasks/TaskList'

export function AreaPage() {
  const { t } = useTranslation()
  const { revision, bumpRevision } = useAppEvents()
  const { areaId } = useParams<{ areaId: string }>()
  const aid = areaId ?? ''

  const [area, setArea] = useState<Area | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [error, setError] = useState<AppError | null>(null)

  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const titleButtonRef = useRef<HTMLButtonElement | null>(null)
  const ignoreNextTitleBlurRef = useRef(false)
  const isCommittingTitleRef = useRef(false)

  const refresh = useCallback(async () => {
    if (!aid) return

    const [areaRes, projectsRes, tasksRes] = await Promise.all([
      window.api.area.get(aid),
      window.api.project.listOpenByArea(aid),
      window.api.task.listArea(aid),
    ])

    if (!areaRes.ok) {
      setError(areaRes.error)
      return
    }
    if (!projectsRes.ok) {
      setError(projectsRes.error)
      return
    }
    if (!tasksRes.ok) {
      setError(tasksRes.error)
      return
    }

    setError(null)
    setArea(areaRes.data)
    setProjects(projectsRes.data)
    setTasks(tasksRes.data)
  }, [aid])

  useEffect(() => {
    void revision
    void refresh()
  }, [refresh, revision])

  // Title edit state should reset on navigation.
  useEffect(() => {
    void aid
    setIsEditingTitle(false)
    ignoreNextTitleBlurRef.current = false
  }, [aid])

  useLayoutEffect(() => {
    if (!isEditingTitle) return
    const raf = window.requestAnimationFrame(() => {
      const input = titleInputRef.current
      if (!input) return
      input.focus()
      const caretPos = input.value.length
      input.setSelectionRange(caretPos, caretPos)
    })
    return () => window.cancelAnimationFrame(raf)
  }, [isEditingTitle])

  const title = area?.title ?? t('shell.area')
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.title.localeCompare(b.title)),
    [projects]
  )

  function enterTitleEdit() {
    if (!area) return
    ignoreNextTitleBlurRef.current = false
    setTitleDraft(area.title ?? '')
    setIsEditingTitle(true)
  }

  function cancelTitleEdit() {
    ignoreNextTitleBlurRef.current = true
    setIsEditingTitle(false)
    titleButtonRef.current?.focus()
  }

  async function commitTitleEdit(nextRaw: string) {
    if (isCommittingTitleRef.current) return

    const a = area
    if (!a) return
    const next = nextRaw.trim()
    const prev = a.title ?? ''

    // Areas require a non-empty title.
    if (!next) {
      cancelTitleEdit()
      return
    }

    if (next === prev.trim()) {
      cancelTitleEdit()
      return
    }

    isCommittingTitleRef.current = true
    try {
      const res = await window.api.area.update({ id: a.id, title: next })
      if (!res.ok) {
        setError(res.error)
        return
      }

      bumpRevision()
      ignoreNextTitleBlurRef.current = true
      setIsEditingTitle(false)
      await refresh()
      titleButtonRef.current?.focus()
    } finally {
      isCommittingTitleRef.current = false
    }
  }

  if (!aid) {
    return (
      <div className="page">
        <h1 className="page-title">{t('shell.area')}</h1>
        <div className="error">{t('errors.missingAreaId')}</div>
      </div>
    )
  }

  return (
    <>
      {error ? <ErrorBanner error={error} /> : null}

      <TaskList
        title={
          area ? (
            isEditingTitle ? (
              <input
                ref={titleInputRef}
                className="page-title-input"
                value={titleDraft}
                placeholder={t('shell.areaTitlePlaceholder')}
                aria-label={t('shell.areaTitlePlaceholder')}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation()

                  if (e.key === 'Enter') {
                    // Don't treat IME composition confirmation as a commit.
                    if (e.nativeEvent.isComposing) return
                    e.preventDefault()
                    void commitTitleEdit(titleDraft)
                    return
                  }

                  if (e.key === 'Escape') {
                    e.preventDefault()
                    cancelTitleEdit()
                  }
                }}
                onBlur={() => {
                  if (ignoreNextTitleBlurRef.current) {
                    ignoreNextTitleBlurRef.current = false
                    return
                  }
                  void commitTitleEdit(titleDraft)
                }}
              />
            ) : (
              <button
                ref={titleButtonRef}
                type="button"
                className="page-title-button"
                onClick={enterTitleEdit}
                onDoubleClick={enterTitleEdit}
              >
                {title}
              </button>
            )
          ) : (
            title
          )
        }
        listId={taskListIdArea(aid)}
        tasks={tasks}
        onAfterReorder={refresh}
        headerActions={
          <>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                enterTitleEdit()
              }}
            >
              {t('common.rename')}
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                const confirmed = confirm(t('area.deleteConfirm'))
                if (!confirmed) return
                void (async () => {
                  const res = await window.api.area.delete(aid)
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  bumpRevision()
                })()
              }}
            >
              {t('common.delete')}
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                const title = prompt(t('project.newTitlePrompt'))
                if (!title) return
                void (async () => {
                  const res = await window.api.project.create({ title, area_id: aid })
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  bumpRevision()
                })()
              }}
            >
              {t('common.addProject')}
            </button>
          </>
        }
        onToggleDone={async (taskId, done) => {
          const updated = await window.api.task.toggleDone(taskId, done)
          if (!updated.ok) throw new Error(`${updated.error.code}: ${updated.error.message}`)
          await refresh()
        }}
      />

      <div className="page">
        <div className="sections-header">
          <div className="sections-title">{t('nav.projects')}</div>
        </div>
        <ul className="task-list">
          {sortedProjects.map((p) => (
            <li key={p.id} className="task-row">
              <NavLink className="nav-item" to={`/projects/${p.id}`}>
                {p.title}
              </NavLink>
            </li>
          ))}
          {sortedProjects.length === 0 ? <li className="nav-muted">{t('shell.empty')}</li> : null}
        </ul>
      </div>
    </>
  )
}

function ErrorBanner({ error }: { error: AppError }) {
  return (
    <div className="error">
      <div className="error-code">{error.code}</div>
      <div>{error.message}</div>
    </div>
  )
}
