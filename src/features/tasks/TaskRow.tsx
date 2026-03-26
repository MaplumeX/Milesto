import type { TaskListItem } from '../../../shared/schemas/task-list'
import { useTranslation } from 'react-i18next'

import { Checkbox } from '../../components/Checkbox'
import { TaskProjectAffiliation } from './TaskProjectAffiliation'

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
        checked={task.status === 'done'}
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

      {task.status === 'done' && onRestore ? (
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
