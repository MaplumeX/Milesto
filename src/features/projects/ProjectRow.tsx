import type { ButtonHTMLAttributes, CSSProperties, MouseEventHandler, ReactNode, Ref } from 'react'
import { useTranslation } from 'react-i18next'

import { CalendarIcon, ClockIcon, NoteIcon, TagIcon } from '../tasks/task-metadata-icons'
import { getTaskSchedulePreviewLabel, getTaskTagPreview } from '../tasks/task-metadata'
import { ProjectProgressControl } from './ProjectProgressControl'

export type ProjectRowProject = {
  id: string
  title: string
  notes: string
  status: 'open' | 'done' | 'cancelled'
  done_count: number
  total_count: number
  area_id: string | null
  area_title?: string | null
  scheduled_at: string | null
  due_at: string | null
  is_someday: boolean
  tag_preview?: string[]
  tag_count?: number
}

export function ProjectRow({
  project,
  dragHandle,
  titlePrefix,
  titleActivatorRef,
  titleActivatorProps,
  innerRef,
  innerStyle,
  isOverlay,
  onSelect,
  onOpen,
  onComplete,
  onContextMenu,
  showOpenCount = true,
  showAreaAffiliation = true,
}: {
  project: ProjectRowProject
  dragHandle?: ReactNode
  titlePrefix?: ReactNode
  titleActivatorRef?: Ref<HTMLButtonElement>
  titleActivatorProps?: ButtonHTMLAttributes<HTMLButtonElement>
  innerRef?: Ref<HTMLDivElement>
  innerStyle?: CSSProperties
  isOverlay?: boolean
  onSelect?: (projectId: string) => void
  onOpen?: (projectId: string) => void
  onComplete?: (project: ProjectRowProject) => void
  onContextMenu?: MouseEventHandler<HTMLDivElement>
  showOpenCount?: boolean
  showAreaAffiliation?: boolean
}) {
  const { t } = useTranslation()
  const hasTitlePrefix = Boolean(titlePrefix)
  const hasTitle = project.title.trim().length > 0
  const schedulePreview = getTaskSchedulePreviewLabel(
    { is_someday: project.is_someday, scheduled_at: project.scheduled_at },
    { someday: t('nav.someday') }
  )
  const tagPreview = getTaskTagPreview(
    project.tag_preview ?? [],
    project.tag_count ?? project.tag_preview?.length ?? 0
  )
  const hasMetadata = Boolean(schedulePreview || project.due_at || tagPreview.visible.length || tagPreview.overflowCount)
  const {
    className: titleActivatorClassName,
    disabled: titleActivatorDisabled,
    onClick: titleActivatorOnClick,
    onDoubleClick: titleActivatorOnDoubleClick,
    onKeyDown: titleActivatorOnKeyDown,
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

      <ProjectProgressControl
        status={project.status}
        doneCount={project.done_count}
        totalCount={project.total_count}
        size="list"
        disabled={!!isOverlay || !onComplete}
        onActivate={() => {
          onComplete?.(project)
        }}
      />

      <button
        {...titleActivatorRest}
        ref={titleActivatorRef}
        type="button"
        className={`task-title task-title-button${hasTitlePrefix ? ' upcoming-task-title-button' : ''}${
          titleActivatorProps ? ' is-dnd-activator' : ''
        }${titleActivatorClassName ? ` ${titleActivatorClassName}` : ''}`}
        data-project-focus-target="true"
        data-project-id={project.id}
        disabled={!!isOverlay || !!titleActivatorDisabled}
        onClick={(e) => {
          titleActivatorOnClick?.(e)
          if (e.defaultPrevented) return
          onSelect?.(project.id)
        }}
        onDoubleClick={(e) => {
          titleActivatorOnDoubleClick?.(e)
          if (e.defaultPrevented) return
          onSelect?.(project.id)
          onOpen?.(project.id)
        }}
        onKeyDown={(e) => {
          titleActivatorOnKeyDown?.(e)
          if (e.defaultPrevented) return
          if (e.key !== 'Enter') return
          e.preventDefault()
          e.stopPropagation()
          onSelect?.(project.id)
          onOpen?.(project.id)
        }}
      >
        {hasTitlePrefix ? (
          <span className="upcoming-date-prefix" aria-hidden="true">
            {titlePrefix}
          </span>
        ) : null}

        <span className="task-title-stack">
          <span
            className={`${hasTitlePrefix ? 'upcoming-task-title ' : ''}task-title-text${
              hasTitle ? '' : ' task-title-placeholder'
            }`}
          >
            {hasTitle ? project.title : t('project.untitled')}
            {showOpenCount ? (
              <span className="project-open-count" aria-hidden="true">
                {project.total_count - project.done_count}
              </span>
            ) : null}
            {project.notes?.trim() ? (
              <span className="task-row-note-icon" aria-hidden="true">
                <NoteIcon />
              </span>
            ) : null}
          </span>
          {showAreaAffiliation && project.area_id && project.area_title ? (
            <span className="task-project-affiliation">{project.area_title}</span>
          ) : null}
        </span>
      </button>

      {hasMetadata ? (
        <div className="task-row-metadata" data-task-row-meta="cluster">
          {schedulePreview ? (
            <span
              className="task-row-meta-item"
              data-task-row-meta-kind="schedule"
              title={`${t('taskEditor.scheduledPrefix')} ${schedulePreview}`}
            >
              <CalendarIcon className="task-row-meta-icon" />
              <span className="task-row-meta-value">{schedulePreview}</span>
            </span>
          ) : null}

          {project.due_at ? (
            <span
              className="task-row-meta-item"
              data-task-row-meta-kind="due"
              title={`${t('taskEditor.duePrefix')} ${project.due_at}`}
            >
              <ClockIcon className="task-row-meta-icon" />
              <span className="task-row-meta-value">{project.due_at}</span>
            </span>
          ) : null}

          {tagPreview.visible.length > 0 || tagPreview.overflowCount > 0 ? (
            <span
              className="task-row-meta-item"
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
    </div>
  )
}
