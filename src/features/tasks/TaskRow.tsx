import type { TaskListItem } from '../../../shared/schemas/task-list'

export function TaskRow({
  task,
  dragHandle,
  dropIndicator,
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
  dropIndicator?: 'before' | 'after'
  innerRef?: React.Ref<HTMLDivElement>
  innerStyle?: React.CSSProperties
  onSelect?: (taskId: string) => void
  onOpen?: (taskId: string) => void
  onToggleDone?: (taskId: string, done: boolean) => void
  onRestore?: (taskId: string) => void
  isOverlay?: boolean
}) {
  return (
    <div
      ref={innerRef}
      className="task-row-inner"
      data-drop-indicator={dropIndicator}
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
        type="button"
        className="task-title task-title-button"
        data-task-focus-target="true"
        data-task-id={task.id}
        disabled={!!isOverlay}
        onClick={() => onSelect?.(task.id)}
        onDoubleClick={() => {
          if (onOpen) void onOpen(task.id)
        }}
      >
        <span className={task.title.trim() ? undefined : 'task-title-placeholder'}>
          {task.title.trim() ? task.title : '新建任务'}
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
          Restore
        </button>
      ) : null}
    </div>
  )
}
