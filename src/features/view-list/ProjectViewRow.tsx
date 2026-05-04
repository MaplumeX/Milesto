import type { ButtonHTMLAttributes, CSSProperties, MouseEventHandler, ReactNode, Ref } from 'react'

import type { ViewListProjectItem } from '../../../shared/schemas/view-list'

import { ProjectRow, type ProjectRowProject } from '../projects/ProjectRow'

export function ProjectViewRow({
  project,
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
  showAreaAffiliation,
}: {
  project: ViewListProjectItem
  titlePrefix?: ReactNode
  titleActivatorRef?: Ref<HTMLButtonElement>
  titleActivatorProps?: ButtonHTMLAttributes<HTMLButtonElement>
  innerRef?: Ref<HTMLDivElement>
  innerStyle?: CSSProperties
  isOverlay?: boolean
  onSelect?: (projectId: string) => void
  onOpen?: (projectId: string) => void
  onComplete?: (project: ViewListProjectItem) => void
  onContextMenu?: MouseEventHandler<HTMLDivElement>
  showAreaAffiliation?: boolean
}) {
  return (
    <ProjectRow
      project={project as unknown as ProjectRowProject}
      titlePrefix={titlePrefix}
      titleActivatorRef={titleActivatorRef}
      titleActivatorProps={titleActivatorProps}
      innerRef={innerRef}
      innerStyle={innerStyle}
      isOverlay={isOverlay}
      onSelect={onSelect}
      onOpen={onOpen}
      onComplete={onComplete ? () => onComplete(project) : undefined}
      onContextMenu={onContextMenu}
      showAreaAffiliation={showAreaAffiliation}
    />
  )
}
