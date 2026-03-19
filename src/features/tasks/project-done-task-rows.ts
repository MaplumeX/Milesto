import type { ProjectSection } from '../../../shared/schemas/project'
import type { TaskListItem } from '../../../shared/schemas/task-list'

export type ProjectDoneTaskRow = {
  task: TaskListItem
  affiliationLabel: string | null
}

export function buildProjectDoneTaskRows({
  doneTasks,
  sections,
}: {
  doneTasks: TaskListItem[]
  sections: ProjectSection[]
}): ProjectDoneTaskRow[] {
  const groupedRowsBySectionId = new Map<string, ProjectDoneTaskRow[]>()
  const ungroupedRows: ProjectDoneTaskRow[] = []

  for (const task of doneTasks) {
    const sectionId = task.section_id
    if (!sectionId) {
      ungroupedRows.push({ task, affiliationLabel: null })
      continue
    }

    const section = sections.find((item) => item.id === sectionId)
    if (!section) {
      ungroupedRows.push({ task, affiliationLabel: null })
      continue
    }

    const rows = groupedRowsBySectionId.get(sectionId) ?? []
    rows.push({
      task,
      affiliationLabel: section.title.trim() || null,
    })
    groupedRowsBySectionId.set(sectionId, rows)
  }

  return [
    ...ungroupedRows,
    ...sections.flatMap((section) => groupedRowsBySectionId.get(section.id) ?? []),
  ]
}
