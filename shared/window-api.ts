import type { Result } from './result'

import type { Locale } from './i18n/locale'
import type { EntityScope } from './schemas/common'

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
import type { ProjectDetail } from './schemas/project-detail'
import type { Tag, TagCreateInput, TagUpdateInput } from './schemas/tag'
import type { Task, TaskCreateInput, TaskUpdateInput } from './schemas/task'
import type { TaskCountProjectsProgressResult, TaskCountResult, TaskListItem } from './schemas/task-list'
import type { TaskSearchResultItem } from './schemas/search'
import type { TaskDetail } from './schemas/task-detail'
import type { ThemePreference, ThemeState } from './schemas/theme'
import type { AreaDetail } from './schemas/area-detail'
import type {
  TrashEmptyResult,
  TrashEntry,
  TrashPurgeResult,
  TrashRestoreResult,
} from './schemas/trash'
import type {
  SidebarListModel,
  SidebarMoveProjectInput,
  SidebarMoveProjectResult,
  SidebarReorderAreasInput,
  SidebarReorderProjectsInput,
  SidebarReorderResult,
} from './schemas/sidebar'
import type {
  SyncConnectionInput,
  SyncCredentials,
  SyncState,
  SyncTestConnectionResult,
  SyncSaveConfigurationInput,
} from './schemas/sync'

export type OpenDialogResult = {
  canceled: boolean
  filePaths: string[]
}

export type SaveDialogResult = {
  canceled: boolean
  filePath?: string
}

export type SidebarState = {
  collapsedAreaIds: string[]
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

  settings: {
    getLocaleState(): Promise<Result<{ locale: Locale; supportedLocales: Locale[] }>>
    setLocale(locale: Locale): Promise<Result<{ locale: Locale; supportedLocales: Locale[] }>>

    getSidebarState(): Promise<Result<SidebarState>>
    setSidebarState(state: SidebarState): Promise<Result<SidebarState>>

    getThemeState(): Promise<Result<ThemeState>>
    setThemePreference(preference: ThemePreference): Promise<Result<ThemeState>>
  }

  sync: {
    getState(): Promise<Result<SyncState>>
    getCredentials(): Promise<Result<SyncCredentials>>
    testConnection(input: SyncConnectionInput): Promise<Result<SyncTestConnectionResult>>
    saveConfiguration(input: SyncSaveConfigurationInput): Promise<Result<SyncState>>
    enable(): Promise<Result<SyncState>>
    disable(): Promise<Result<SyncState>>
    syncNow(): Promise<Result<SyncState>>
  }

  trash: {
    list(): Promise<Result<TrashEntry[]>>
    restoreTask(id: string): Promise<Result<TrashRestoreResult>>
    restoreProject(id: string): Promise<Result<TrashRestoreResult>>
    purgeTask(id: string): Promise<Result<TrashPurgeResult>>
    purgeProject(id: string): Promise<Result<TrashPurgeResult>>
    empty(): Promise<Result<TrashEmptyResult>>
  }

  task: {
    create(input: TaskCreateInput): Promise<Result<Task>>
    update(input: TaskUpdateInput): Promise<Result<Task>>
    toggleDone(id: string, done: boolean, scope?: EntityScope): Promise<Result<Task>>
    cancel(id: string, scope?: EntityScope): Promise<Result<Task>>
    restore(id: string, scope?: EntityScope): Promise<Result<Task>>
    delete(id: string): Promise<Result<{ deleted: boolean }>>

    getDetail(id: string, scope?: EntityScope): Promise<Result<TaskDetail>>

    listInbox(): Promise<Result<TaskListItem[]>>
    listAnytime(): Promise<Result<TaskListItem[]>>
    listSomeday(): Promise<Result<TaskListItem[]>>
    listToday(date: string): Promise<Result<TaskListItem[]>>
    listUpcoming(fromDate: string): Promise<Result<TaskListItem[]>>
    listLogbook(): Promise<Result<TaskListItem[]>>
    listProject(projectId: string, scope?: EntityScope): Promise<Result<TaskListItem[]>>
    countProjectDone(projectId: string, scope?: EntityScope): Promise<Result<TaskCountResult>>
    countProjectsProgress(projectIds: string[]): Promise<Result<TaskCountProjectsProgressResult>>
    listProjectDone(projectId: string, scope?: EntityScope): Promise<Result<TaskListItem[]>>
    listArea(areaId: string): Promise<Result<TaskListItem[]>>

    search(query: string, options?: { includeLogbook?: boolean }): Promise<Result<TaskSearchResultItem[]>>

    reorderBatch(listId: string, orderedTaskIds: string[]): Promise<Result<{ reordered: boolean }>>
    setTags(taskId: string, tagIds: string[], scope?: EntityScope): Promise<Result<{ updated: boolean }>>
  }

  project: {
    create(input: ProjectCreateInput): Promise<Result<Project>>
    get(id: string, scope?: EntityScope): Promise<Result<Project>>
    getDetail(id: string, scope?: EntityScope): Promise<Result<ProjectDetail>>
    update(input: ProjectUpdateInput): Promise<Result<Project>>
    complete(id: string, scope?: EntityScope): Promise<Result<ProjectCompleteResult>>
    cancel(id: string, scope?: EntityScope): Promise<Result<ProjectCompleteResult>>
    delete(id: string): Promise<Result<{ deleted: boolean }>>
    listOpen(): Promise<Result<Project[]>>
    listDone(): Promise<Result<Project[]>>
    listOpenByArea(areaId: string): Promise<Result<Project[]>>

    setTags(projectId: string, tagIds: string[], scope?: EntityScope): Promise<Result<{ updated: boolean }>>

    listSections(projectId: string, scope?: EntityScope): Promise<Result<ProjectSection[]>>
    createSection(projectId: string, title: string, scope?: EntityScope): Promise<Result<ProjectSection>>
    renameSection(id: string, title: string, scope?: EntityScope): Promise<Result<ProjectSection>>
    deleteSection(id: string): Promise<Result<{ deleted: boolean; moved_to_section_id: string | null }>>
    reorderSections(
      projectId: string,
      orderedSectionIds: string[],
      scope?: EntityScope
    ): Promise<Result<ProjectSectionReorderBatchResult>>
  }

  area: {
    create(input: AreaCreateInput): Promise<Result<Area>>
    get(id: string): Promise<Result<Area>>
    getDetail(id: string): Promise<Result<AreaDetail>>
    update(input: AreaUpdateInput): Promise<Result<Area>>
    list(): Promise<Result<Area[]>>
    delete(id: string): Promise<Result<{ deleted: boolean }>>

    setTags(areaId: string, tagIds: string[]): Promise<Result<{ updated: boolean }>>
  }

  sidebar: {
    // Sidebar-specific ordering rules (manual order with title fallback).
    listModel(): Promise<Result<SidebarListModel>>
    reorderAreas(input: SidebarReorderAreasInput): Promise<Result<SidebarReorderResult>>
    reorderProjects(input: SidebarReorderProjectsInput): Promise<Result<SidebarReorderResult>>
    moveProject(input: SidebarMoveProjectInput): Promise<Result<SidebarMoveProjectResult>>
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
    delete(id: string, scope?: EntityScope): Promise<Result<{ deleted: boolean }>>
  }
}
