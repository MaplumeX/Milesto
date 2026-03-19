import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { TrashEntry } from '../../../shared/schemas/trash'
import { ProjectProgressIndicator } from '../projects/ProjectProgressControl'
import { AnimatedTaskSlot } from '../tasks/AnimatedTaskSlot'
import { TaskRow } from '../tasks/TaskRow'
import { TaskInlineEditorRow } from '../tasks/TaskInlineEditorRow'
import { usePrefersReducedMotion } from '../tasks/dnd-drop-animation'

type TrashListProps = {
  entries: TrashEntry[]
  selectedEntryId: string | null
  openTaskId: string | null
  onSelectEntry: (entryId: string | null) => void
  onOpenTask: (taskId: string) => Promise<void>
  onOpenProject: (projectId: string) => Promise<void>
  onToggleTaskDone: (taskId: string, done: boolean) => Promise<void>
}

export function TrashList({
  entries,
  selectedEntryId,
  openTaskId,
  onSelectEntry,
  onOpenTask,
  onOpenProject,
  onToggleTaskDone,
}: TrashListProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = usePrefersReducedMotion()
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
        if (event.key === 'ArrowDown') {
          if (entries.length === 0) return
          event.preventDefault()
          const nextIndex = Math.min((selectedIndex < 0 ? -1 : selectedIndex) + 1, entries.length - 1)
          onSelectEntry(entries[nextIndex]?.id ?? null)
          return
        }

        if (event.key === 'ArrowUp') {
          if (entries.length === 0) return
          event.preventDefault()
          const nextIndex = selectedIndex < 0 ? entries.length - 1 : Math.max(selectedIndex - 1, 0)
          onSelectEntry(entries[nextIndex]?.id ?? null)
          return
        }

        if (event.key !== 'Enter') return
        event.preventDefault()
        const entry = entries.find((item) => item.id === selectedEntryId)
        if (!entry) return
        if (entry.kind === 'task') {
          void onOpenTask(entry.id)
          return
        }
        void onOpenProject(entry.id)
      }}
    >
      <ul className="task-list">
        {entries.map((entry) => {
          const isSelected = entry.id === selectedEntryId
          const isOpenTask = entry.kind === 'task' && openTaskId === entry.id

          return (
            <li
              key={`${entry.kind}:${entry.id}`}
              className={
                entry.kind === 'task'
                  ? `task-row task-row-virtual${isOpenTask ? ' is-open' : ''}${isSelected ? ' is-selected' : ''}`
                  : `task-row${isSelected ? ' is-selected' : ''}`
              }
              data-trash-entry-id={entry.id}
              data-trash-entry-kind={entry.kind}
            >
              {entry.kind === 'task' ? (
                <AnimatedTaskSlot
                  isOpen={isOpenTask}
                  rowContent={
                    <TaskRow
                      task={{
                        id: entry.id,
                        title: entry.title,
                        status: 'open',
                        is_inbox: false,
                        is_someday: false,
                        project_id: null,
                        project_title: null,
                        section_id: null,
                        area_id: null,
                        scheduled_at: null,
                        due_at: null,
                        created_at: entry.deleted_at,
                        updated_at: entry.deleted_at,
                        completed_at: null,
                        deleted_at: entry.deleted_at,
                        rank: null,
                      }}
                      showProjectAffiliation={false}
                      titleActivatorProps={{ 'data-trash-entry-button': 'true' } as React.ButtonHTMLAttributes<HTMLButtonElement>}
                      onSelect={onSelectEntry}
                      onOpen={(taskId) => void onOpenTask(taskId)}
                      onToggleDone={(taskId, done) => {
                        void onToggleTaskDone(taskId, done)
                      }}
                    />
                  }
                  editorContent={
                    <TaskInlineEditorRow
                      taskId={entry.id}
                      scope="trash"
                      projectScope="active"
                      showProjectActions={false}
                    />
                  }
                  onHeightChange={() => {}}
                  prefersReducedMotion={prefersReducedMotion}
                />
              ) : (
                <>
                  <ProjectProgressIndicator status="open" doneCount={0} totalCount={entry.open_task_count} size="list" />
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
                    onDoubleClick={() => {
                      void onOpenProject(entry.id)
                    }}
                    data-trash-entry-button="true"
                  >
                    <span className={entry.title.trim() ? undefined : 'task-title-placeholder'}>
                      {entry.title.trim() ? entry.title : t('project.untitled')}
                    </span>
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
