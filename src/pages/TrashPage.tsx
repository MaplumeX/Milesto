import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../shared/app-error'
import type { TrashEntry } from '../../shared/schemas/trash'
import { useAppEvents } from '../app/AppEventsContext'
import { useTaskSelection } from '../features/tasks/TaskSelectionContext'
import { TrashList } from '../features/trash/TrashList'
import { buildProjectPath } from '../lib/entity-scope'

function resolveSelectedEntryId(entries: TrashEntry[], preferredId: string | null): string | null {
  if (entries.length === 0) return null
  if (preferredId && entries.some((entry) => entry.id === preferredId)) return preferredId
  return entries[0]?.id ?? null
}

export function TrashPage() {
  const { t } = useTranslation()
  const { revision, bumpRevision } = useAppEvents()
  const navigate = useNavigate()
  const { closeTask, openTask, openTaskId, requestCloseTask, selectTask } = useTaskSelection()
  const [entries, setEntries] = useState<TrashEntry[]>([])
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [isEmptying, setIsEmptying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<AppError | null>(null)
  const skipNextRevisionRefreshRef = useRef(false)

  const refresh = useCallback(async (preferredSelectedId?: string | null) => {
    const res = await window.api.trash.list()
    if (!res.ok) {
      setError(res.error)
      setIsLoading(false)
      return
    }

    setEntries(res.data)
    setSelectedEntryId((current) => resolveSelectedEntryId(res.data, preferredSelectedId ?? current))
    setError(null)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (skipNextRevisionRefreshRef.current) {
      skipNextRevisionRefreshRef.current = false
      return
    }

    void revision
    void refresh()
  }, [refresh, revision])

  const hasEntries = entries.length > 0

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId]
  )

  useEffect(() => {
    if (!selectedEntry) {
      selectTask(null)
      return
    }

    selectTask(selectedEntry.kind === 'task' ? selectedEntry.id : null)
  }, [selectTask, selectedEntry])

  useEffect(() => {
    if (!openTaskId) return
    const hasOpenTask = entries.some((entry) => entry.kind === 'task' && entry.id === openTaskId)
    if (hasOpenTask) return
    closeTask()
  }, [closeTask, entries, openTaskId])

  const handleOpenTask = useCallback(
    async (taskId: string) => {
      setSelectedEntryId(taskId)
      await openTask(taskId)
    },
    [openTask]
  )

  const handleOpenProject = useCallback(
    async (projectId: string) => {
      const ok = await requestCloseTask()
      if (!ok) return
      setSelectedEntryId(projectId)
      navigate(buildProjectPath(projectId, 'trash'))
    },
    [navigate, requestCloseTask]
  )

  const handleToggleTaskDone = useCallback(
    async (taskId: string, done: boolean) => {
      const res = await window.api.task.toggleDone(taskId, done, 'trash')
      if (!res.ok) {
        setError(res.error)
        return
      }

      skipNextRevisionRefreshRef.current = true
      bumpRevision()
      await refresh(taskId)
    },
    [bumpRevision, refresh]
  )

  const handleEmpty = useCallback(async () => {
    if (!hasEntries) return
    if (!window.confirm(t('trash.emptyConfirm'))) return
    if (!(await requestCloseTask())) return

    setIsEmptying(true)
    const res = await window.api.trash.empty()
    if (!res.ok) {
      setError(res.error)
      setIsEmptying(false)
      return
    }

    skipNextRevisionRefreshRef.current = true
    bumpRevision()
    await refresh(null)
    setIsEmptying(false)
  }, [bumpRevision, hasEntries, refresh, requestCloseTask, t])

  return (
    <div className="page">
      <header className="page-header trash-page-header">
        <h1 className="page-title">{t('nav.trash')}</h1>

        <button
          type="button"
          className="button button-ghost"
          onClick={() => void handleEmpty()}
          disabled={!hasEntries || isEmptying}
          data-trash-empty-action="true"
        >
          {t('trash.emptyAction')}
        </button>
      </header>

      {error ? <ErrorBanner error={error} /> : null}

      {isLoading ? <div className="nav-muted">{t('common.loading')}</div> : null}

      {!isLoading && !hasEntries ? <div className="nav-muted">{t('trash.emptyState')}</div> : null}

      {!isLoading && hasEntries ? (
        <TrashList
          entries={entries}
          selectedEntryId={selectedEntry?.id ?? selectedEntryId}
          openTaskId={openTaskId}
          onSelectEntry={setSelectedEntryId}
          onOpenTask={handleOpenTask}
          onOpenProject={handleOpenProject}
          onToggleTaskDone={handleToggleTaskDone}
        />
      ) : null}
    </div>
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
