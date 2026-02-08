import type { TaskListItem } from '../../../shared/schemas/task-list'
import { useTranslation } from 'react-i18next'

export function TaskRow({
  task,
  dragHandle,
  titleActivatorRef,
  titleActivatorProps,
  innerRef,
  innerStyle,
  onSelect,
  onOpen,
  onToggleDone,
  onRestore,
  isOverlay,
}: {
  task: TaskListItem
  dragHandle?: React.ReactNode
  titleActivatorRef?: React.Ref<HTMLButtonElement>
  titleActivatorProps?: React.ButtonHTMLAttributes<HTMLButtonElement>
  innerRef?: React.Ref<HTMLDivElement>
  innerStyle?: React.CSSProperties
  onSelect?: (taskId: string) => void
  onOpen?: (taskId: string) => void
  onToggleDone?: (taskId: string, done: boolean) => void
  onRestore?: (taskId: string) => void
  isOverlay?: boolean
}) {
  const { t } = useTranslation()
  const isTitleActivator = !!titleActivatorProps
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
    >
      {dragHandle}

      <label className="task-checkbox">
        <input
          type="checkbox"
          checked={task.status === 'done'}
          disabled={isOverlay || !onToggleDone}
          onChange={(e) => {
            if (!onToggleDone) return
            onToggleDone(task.id, e.target.checked)
          }}
        />
      </label>

      <button
        {...titleActivatorRest}
        ref={titleActivatorRef}
        type="button"
        className={`task-title task-title-button${isTitleActivator ? ' is-dnd-activator' : ''}${
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
        <span className={task.title.trim() ? undefined : 'task-title-placeholder'}>
          {task.title.trim() ? task.title : t('task.untitled')}
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
