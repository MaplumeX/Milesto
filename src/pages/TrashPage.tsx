import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../shared/app-error'
import type { ViewListItem } from '../../shared/schemas/view-list'
import type { TrashEntry } from '../../shared/schemas/trash'
import { Button } from '../components/Button'
import { useAppEvents } from '../app/AppEventsContext'
import { useConfirm } from '../contexts/ConfirmDialogContext'
import { useTaskSelection } from '../features/tasks/TaskSelectionContext'
import { ViewList } from '../features/view-list/ViewList'

function resolveSelectedEntryId(entries: TrashEntry[], preferredId: string | null): string | null {
  if (entries.length === 0) return null
  if (preferredId && entries.some((entry) => entry.id === preferredId)) return preferredId
  return entries[0]?.id ?? null
}

export function TrashPage() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const { revision, bumpRevision } = useAppEvents()
  const { closeTask, openTaskId, requestCloseTask, selectTask } = useTaskSelection()
  const [items, setItems] = useState<ViewListItem[]>([])
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [isEmptying, setIsEmptying] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const skipNextRevisionRefreshRef = useRef(false)

  const refresh = useCallback(async (preferredSelectedId?: string | null) => {
    const res = await window.api.trash.list()
    if (!res.ok) {
      setError(res.error)
      return
    }

    setItems(res.data)
    setSelectedEntryId((current) => resolveSelectedEntryId(res.data, preferredSelectedId ?? current))
    setError(null)
  }, [])

  useEffect(() => {
    if (skipNextRevisionRefreshRef.current) {
      skipNextRevisionRefreshRef.current = false
      return
    }

    void revision
    void refresh()
  }, [refresh, revision])

  const hasEntries = items.length > 0

  const selectedEntry = useMemo(
    () => items.find((entry) => entry.id === selectedEntryId) ?? null,
    [items, selectedEntryId]
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
    const hasOpenTask = items.some((entry) => entry.kind === 'task' && entry.id === openTaskId)
    if (hasOpenTask) return
    closeTask()
  }, [closeTask, items, openTaskId])

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

  const handleCompleteProject = useCallback(
    async (project: import('../../shared/schemas/view-list').ViewListProjectItem) => {
      const res = await window.api.project.complete(project.id, 'trash')
      if (!res.ok) {
        setError(res.error)
        return
      }

      skipNextRevisionRefreshRef.current = true
      bumpRevision()
      await refresh(project.id)
    },
    [bumpRevision, refresh]
  )

  const handleEmpty = useCallback(async () => {
    if (!hasEntries) return
    const confirmed = await confirm({ message: t('trash.emptyConfirm'), variant: 'danger', confirmText: t('common.delete') })
    if (!confirmed) return
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
  }, [bumpRevision, confirm, hasEntries, refresh, requestCloseTask, t])

  const headerActions = (
    <Button
      variant="ghost"
      onClick={() => void handleEmpty()}
      disabled={!hasEntries || isEmptying}
      data-trash-empty-action="true"
    >
      {t('trash.emptyAction')}
    </Button>
  )

  return (
    <>
      {error ? <ErrorBanner error={error} /> : null}
      <ViewList
        title={t('nav.trash')}
        items={items}
        scope="trash"
        headerActions={headerActions}
        onToggleTaskDone={handleToggleTaskDone}
        onCompleteProject={handleCompleteProject}
        emptyState={<div className="nav-muted">{t('trash.emptyState')}</div>}
      />
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