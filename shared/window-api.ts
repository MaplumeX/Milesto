import type { Result } from './result'

import type { Area, AreaCreateInput, AreaUpdateInput } from './schemas/area'
import type {
  ChecklistItem,
  ChecklistItemCreateInput,
  ChecklistItemUpdateInput,
} from './schemas/checklist'
import type {
  Project,
  ProjectCreateInput,
  ProjectCompleteResult,
  ProjectSection,
  ProjectSectionReorderBatchResult,
  ProjectUpdateInput,
} from './schemas/project'
import type { Tag, TagCreateInput, TagUpdateInput } from './schemas/tag'
import type { Task, TaskCreateInput, TaskUpdateInput } from './schemas/task'
import type { TaskCountResult, TaskListItem } from './schemas/task-list'
import type { TaskSearchResultItem } from './schemas/search'
import type { TaskDetail } from './schemas/task-detail'

export type OpenDialogResult = {
  canceled: boolean
  filePaths: string[]
}

export type SaveDialogResult = {
  canceled: boolean
  filePath?: string
}

export type WindowApi = {
  app: {
    getVersion(): Promise<Result<string>>
    getUserDataPath(): Promise<Result<string>>
    openPath(path: string): Promise<Result<void>>
    showItemInFolder(path: string): Promise<Result<void>>
  }

  data: {
    exportToFile(): Promise<Result<{ canceled: boolean; filePath?: string }>>
    importFromFile(): Promise<Result<{ canceled: boolean; imported: boolean }>>
    resetAllData(): Promise<Result<void>>
  }

  task: {
    create(input: TaskCreateInput): Promise<Result<Task>>
    update(input: TaskUpdateInput): Promise<Result<Task>>
    toggleDone(id: string, done: boolean): Promise<Result<Task>>
    restore(id: string): Promise<Result<Task>>

    getDetail(id: string): Promise<Result<TaskDetail>>

    listInbox(): Promise<Result<TaskListItem[]>>
    listAnytime(): Promise<Result<TaskListItem[]>>
    listSomeday(): Promise<Result<TaskListItem[]>>
    listToday(date: string): Promise<Result<TaskListItem[]>>
    listUpcoming(fromDate: string): Promise<Result<TaskListItem[]>>
    listLogbook(): Promise<Result<TaskListItem[]>>
    listProject(projectId: string): Promise<Result<TaskListItem[]>>
    countProjectDone(projectId: string): Promise<Result<TaskCountResult>>
    listProjectDone(projectId: string): Promise<Result<TaskListItem[]>>
    listArea(areaId: string): Promise<Result<TaskListItem[]>>

    search(query: string, options?: { includeLogbook?: boolean }): Promise<Result<TaskSearchResultItem[]>>

    reorderBatch(listId: string, orderedTaskIds: string[]): Promise<Result<{ reordered: boolean }>>
    setTags(taskId: string, tagIds: string[]): Promise<Result<{ updated: boolean }>>
  }

  project: {
    create(input: ProjectCreateInput): Promise<Result<Project>>
    get(id: string): Promise<Result<Project>>
    update(input: ProjectUpdateInput): Promise<Result<Project>>
    complete(id: string): Promise<Result<ProjectCompleteResult>>
    listOpen(): Promise<Result<Project[]>>
    listDone(): Promise<Result<Project[]>>
    listOpenByArea(areaId: string): Promise<Result<Project[]>>

    listSections(projectId: string): Promise<Result<ProjectSection[]>>
    createSection(projectId: string, title: string): Promise<Result<ProjectSection>>
    renameSection(id: string, title: string): Promise<Result<ProjectSection>>
    deleteSection(id: string): Promise<Result<{ deleted: boolean; moved_to_section_id: string | null }>>
    reorderSections(projectId: string, orderedSectionIds: string[]): Promise<Result<ProjectSectionReorderBatchResult>>
  }

  area: {
    create(input: AreaCreateInput): Promise<Result<Area>>
    get(id: string): Promise<Result<Area>>
    update(input: AreaUpdateInput): Promise<Result<Area>>
    list(): Promise<Result<Area[]>>
    delete(id: string): Promise<Result<{ deleted: boolean }>>
  }

  tag: {
    create(input: TagCreateInput): Promise<Result<Tag>>
    update(input: TagUpdateInput): Promise<Result<Tag>>
    list(): Promise<Result<Tag[]>>
    delete(id: string): Promise<Result<{ deleted: boolean }>>
  }

  checklist: {
    listByTask(taskId: string): Promise<Result<ChecklistItem[]>>
    create(input: ChecklistItemCreateInput): Promise<Result<ChecklistItem>>
    update(input: ChecklistItemUpdateInput): Promise<Result<ChecklistItem>>
    delete(id: string): Promise<Result<{ deleted: boolean }>>
  }
}
