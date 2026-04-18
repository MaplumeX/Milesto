import type { TaskListItem } from '../../../shared/schemas/task-list'
import { isClosedTaskStatus } from '../../../shared/schemas/common'
import { useTranslation } from 'react-i18next'

import { Checkbox } from '../../components/Checkbox'
import { getTaskSchedulePreviewLabel, getTaskTagPreview, isDueUrgent } from './task-metadata'
import { CalendarIcon, ClockIcon, TagIcon } from './task-metadata-icons'
import { TaskProjectAffiliation } from './TaskProjectAffiliation'
import { getLocalToday } from '../../lib/use-local-today'

export function TaskRow({
  task,
  dragHandle,
  titlePrefix,
  titleActivatorRef,
  titleActivatorProps,
  innerRef,
  innerStyle,
  onSelect,
  onOpen,
  onToggleDone,
  onRestore,
  onContextMenu,
  isOverlay,
  showProjectAffiliation = true,
  projectAffiliationLabel,
}: {
  task: TaskListItem
  dragHandle?: React.ReactNode
  titlePrefix?: React.ReactNode
  titleActivatorRef?: React.Ref<HTMLButtonElement>
  titleActivatorProps?: React.ButtonHTMLAttributes<HTMLButtonElement>
  innerRef?: React.Ref<HTMLDivElement>
  innerStyle?: React.CSSProperties
  onSelect?: (taskId: string) => void
  onOpen?: (taskId: string) => void
  onToggleDone?: (taskId: string, done: boolean) => void
  onRestore?: (taskId: string) => void
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>
  isOverlay?: boolean
  showProjectAffiliation?: boolean
  projectAffiliationLabel?: string | null
}) {
  const { t } = useTranslation()
  const isTitleActivator = !!titleActivatorProps
  const hasTitlePrefix = Boolean(titlePrefix)
  const isCancelled = task.status === 'cancelled'
  const isClosed = isClosedTaskStatus(task.status)
  const schedulePreview = getTaskSchedulePreviewLabel(task, {
    someday: t('nav.someday'),
  })
  const tagPreview = getTaskTagPreview(
    task.tag_preview ?? [],
    task.tag_count ?? task.tag_preview?.length ?? 0
  )
  const hasMetadata = Boolean(schedulePreview || task.due_at || tagPreview.visible.length || tagPreview.overflowCount)
  const {
    className: titleActivatorClassName,
    disabled: titleActivatorDisabled,
    onClick: titleActivatorOnClick,
    onDoubleClick: titleActivatorOnDoubleClick,
    ...titleActivatorRest
  } = titleActivatorProps ?? {}

  return (
    <div
      ref={innerRef}
      className="task-row-inner"
      style={innerStyle}
      onContextMenu={onContextMenu}
    >
      {dragHandle}

      <Checkbox
        className="task-checkbox"
        ariaLabel={t('aria.taskDone')}
        checked={isClosed}
        mark={isCancelled ? 'x' : 'check'}
        disabled={isOverlay || !onToggleDone}
        onCheckedChange={(checked) => {
          if (!onToggleDone) return
          onToggleDone(task.id, checked)
        }}
      />

      <button
        {...titleActivatorRest}
        ref={titleActivatorRef}
        type="button"
        className={`task-title task-title-button${hasTitlePrefix ? ' upcoming-task-title-button' : ''}${
          isTitleActivator ? ' is-dnd-activator' : ''
        }${
          titleActivatorClassName ? ` ${titleActivatorClassName}` : ''
        }`}
        data-task-focus-target="true"
        data-task-id={task.id}
        disabled={!!isOverlay || !!titleActivatorDisabled}
        onClick={(e) => {
          titleActivatorOnClick?.(e)
          if (e.defaultPrevented) return
          onSelect?.(task.id)
        }}
        onDoubleClick={(e) => {
          titleActivatorOnDoubleClick?.(e)
          if (e.defaultPrevented) return
          if (onOpen) void onOpen(task.id)
        }}
      >
        {hasTitlePrefix ? (
          <span className="upcoming-date-prefix" aria-hidden="true">
            {titlePrefix}
          </span>
        ) : null}

        <span className="task-title-stack">
          <span
            className={`${hasTitlePrefix ? 'upcoming-task-title ' : ''}task-title-text ${
              task.title.trim() ? '' : 'task-title-placeholder'
            }`.trim() || undefined}
          >
            {task.title.trim() ? task.title : t('task.untitled')}
          </span>
          {showProjectAffiliation ? (
            <TaskProjectAffiliation
              projectId={task.project_id}
              projectTitle={task.project_title}
              overrideLabel={projectAffiliationLabel}
            />
          ) : null}
        </span>
      </button>

      {hasMetadata ? (
        <div className="task-row-metadata" data-task-row-meta="cluster">
          {schedulePreview ? (
            <span
              className="task-row-meta-item task-row-meta-item--schedule"
              data-task-row-meta-kind="schedule"
              title={`${t('taskEditor.scheduledPrefix')} ${schedulePreview}`}
            >
              <CalendarIcon className="task-row-meta-icon" />
              <span className="task-row-meta-value">{schedulePreview}</span>
            </span>
          ) : null}

          {task.due_at ? (
            <span
              className={`task-row-meta-item task-row-meta-item--due${
                isDueUrgent(task.due_at, getLocalToday()) ? ' task-row-meta-item--due-urgent' : ''
              }`}
              data-task-row-meta-kind="due"
              title={`${t('taskEditor.duePrefix')} ${task.due_at}`}
            >
              <ClockIcon className="task-row-meta-icon" />
              <span className="task-row-meta-value">{task.due_at}</span>
            </span>
          ) : null}

          {tagPreview.visible.length > 0 || tagPreview.overflowCount > 0 ? (
            <span
              className="task-row-meta-item task-row-meta-item--tags"
              data-task-row-meta-kind="tags"
              title={tagPreview.visible.join(', ')}
            >
              <TagIcon className="task-row-meta-icon" />
              <span className="task-row-meta-tags">
                {tagPreview.visible.map((title, index) => (
                  <span key={`${title}-${index}`} className="task-row-meta-tag">
                    {title}
                  </span>
                ))}
                {tagPreview.overflowCount > 0 ? (
                  <span className="task-row-meta-overflow">+{tagPreview.overflowCount}</span>
                ) : null}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}

      {isClosed && onRestore ? (
        <button
          type="button"
          className="button button-ghost"
          disabled={!!isOverlay}
          onClick={() => {
            if (!onRestore) return
            onRestore(task.id)
          }}
        >
          {t('task.restore')}
        </button>
      ) : null}
    </div>
  )
}
