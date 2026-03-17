import { useTranslation } from 'react-i18next'

import type { Area } from '../../../shared/schemas/area'
import type { Project } from '../../../shared/schemas/project'
import type { TaskUpdateInput } from '../../../shared/schemas/task'

import { ProjectProgressIndicator } from '../projects/ProjectProgressControl'
import { TaskMovePopoverContent } from './TaskMovePopoverContent'

type TriggerProps = {
  mode: 'trigger'
  projectTitle: string | null
  projectStatus: Project['status']
  doneCount: number
  totalCount: number
  onToggleMenu: (anchorEl: HTMLElement) => void
}

type MenuProps = {
  mode: 'menu'
  onOpenProject: () => void
  onOpenMove: () => void
}

type MoveProps = {
  mode: 'move'
  areas: Area[]
  openProjects: Project[]
  actionError: string | null
  onMoveProject: (patch: Partial<Omit<TaskUpdateInput, 'id'>>) => Promise<void>
}

type TaskEditorProjectActionsProps = TriggerProps | MenuProps | MoveProps

export function TaskEditorProjectActions(props: TaskEditorProjectActionsProps) {
  const { t } = useTranslation()

  if (props.mode === 'trigger') {
    if (!props.projectTitle) return null

    return (
      <button
        type="button"
        className="task-inline-project-button"
        onClick={(event) => props.onToggleMenu(event.currentTarget as HTMLElement)}
      >
        <ProjectProgressIndicator
          status={props.projectStatus}
          doneCount={props.doneCount}
          totalCount={props.totalCount}
        />
        <span>{props.projectTitle}</span>
      </button>
    )
  }

  if (props.mode === 'menu') {
    return (
      <div className="task-inline-popover-body">
        <div className="task-inline-popover-title">{t('taskEditor.projectLabel')}</div>
        <button
          type="button"
          className="task-inline-popover-item"
          onClick={props.onOpenProject}
        >
          {t('taskEditor.openProject')}
        </button>
        <button
          type="button"
          className="task-inline-popover-item"
          onClick={props.onOpenMove}
        >
          {t('taskEditor.changeProject')}
        </button>
      </div>
    )
  }

  return (
    <div className="task-inline-popover-body">
      <div className="task-inline-popover-title">{t('common.move')}</div>
      <TaskMovePopoverContent
        areas={props.areas}
        openProjects={props.openProjects}
        actionError={props.actionError}
        onMove={props.onMoveProject}
      />
    </div>
  )
}
