import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { TrashEntry } from '../../../shared/schemas/trash'

type TrashListProps = {
  entries: TrashEntry[]
  selectedEntryId: string | null
  busyEntryId: string | null
  onSelectEntry: (entryId: string | null) => void
  onRestoreEntry: (entry: TrashEntry) => Promise<void>
  onPurgeEntry: (entry: TrashEntry) => Promise<void>
}

export function TrashList({
  entries,
  selectedEntryId,
  busyEntryId,
  onSelectEntry,
  onRestoreEntry,
  onPurgeEntry,
}: TrashListProps) {
  const { t } = useTranslation()
  const entryButtonRefs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    if (!selectedEntryId) return
    entryButtonRefs.current.get(selectedEntryId)?.focus()
  }, [selectedEntryId, entries])

  const selectedIndex = useMemo(
    () => entries.findIndex((entry) => entry.id === selectedEntryId),
    [entries, selectedEntryId]
  )

  return (
    <div
      className="task-scroll"
      role="listbox"
      aria-label={t('trash.listAria')}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        if (entries.length === 0) return

        event.preventDefault()
        if (event.key === 'ArrowDown') {
          const nextIndex = Math.min((selectedIndex < 0 ? -1 : selectedIndex) + 1, entries.length - 1)
          onSelectEntry(entries[nextIndex]?.id ?? null)
          return
        }

        const nextIndex = selectedIndex < 0 ? entries.length - 1 : Math.max(selectedIndex - 1, 0)
        onSelectEntry(entries[nextIndex]?.id ?? null)
      }}
    >
      <ul className="task-list">
        {entries.map((entry) => {
          const isSelected = entry.id === selectedEntryId
          const isBusy = entry.id === busyEntryId
          const displayTitle = entry.title.trim() || (entry.kind === 'project' ? t('project.untitled') : t('task.untitled'))

          return (
            <li
              key={`${entry.kind}:${entry.id}`}
              className={`task-row trash-row${isSelected ? ' is-selected' : ''}`}
              data-trash-entry-id={entry.id}
              data-trash-entry-kind={entry.kind}
            >
              <button
                ref={(node) => {
                  if (node) {
                    entryButtonRefs.current.set(entry.id, node)
                    return
                  }
                  entryButtonRefs.current.delete(entry.id)
                }}
                type="button"
                className="task-title task-title-button"
                onClick={() => onSelectEntry(entry.id)}
                data-trash-entry-button="true"
              >
                <span className="task-title-stack">
                  <span className={entry.title.trim() ? undefined : 'task-title-placeholder'}>{displayTitle}</span>
                  {entry.kind === 'project' ? (
                    <span className="trash-row-meta">
                      <span className="tag-pill" data-trash-open-count={entry.open_task_count}>
                        {t('trash.projectOpenCount', { count: entry.open_task_count })}
                      </span>
                    </span>
                  ) : (
                    <span className="trash-row-meta">{t('trash.taskLabel')}</span>
                  )}
                </span>
              </button>

              <div className="trash-row-actions">
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => void onRestoreEntry(entry)}
                  disabled={isBusy}
                  data-trash-action="restore"
                >
                  {t('task.restore')}
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => void onPurgeEntry(entry)}
                  disabled={isBusy}
                  data-trash-action="purge"
                >
                  {t('trash.purge')}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
