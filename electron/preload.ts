import { contextBridge, ipcRenderer } from 'electron'

import type { WindowApi } from '../shared/window-api'

function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  return payload === undefined
    ? (ipcRenderer.invoke(channel) as Promise<T>)
    : (ipcRenderer.invoke(channel, payload) as Promise<T>)
}

// Expose a minimal, business-level API. Do NOT expose ipcRenderer directly.
const api: WindowApi = {
  app: {
    getVersion: () => invoke('app:getVersion'),
    getUserDataPath: () => invoke('app:getUserDataPath'),
    openPath: (path) => invoke('app:openPath', { path }),
    showItemInFolder: (path) => invoke('app:showItemInFolder', { path }),
  },
  data: {
    exportToFile: () => invoke('data:exportToFile'),
    importFromFile: () => invoke('data:importFromFile'),
    resetAllData: () => invoke('data:resetAllData'),
  },
  settings: {
    getLocaleState: () => invoke('settings:getLocaleState'),
    setLocale: (locale) => invoke('settings:setLocale', { locale }),
    getSidebarState: () => invoke('settings:getSidebarState'),
    setSidebarState: (state) => invoke('settings:setSidebarState', { state }),
    getThemeState: () => invoke('settings:getThemeState'),
    setThemePreference: (preference) => invoke('settings:setThemePreference', { preference }),
  },
  task: {
    create: (input) => invoke('db:task.create', input),
    update: (input) => invoke('db:task.update', input),
    toggleDone: (id, done) => invoke('db:task.toggleDone', { id, done }),
    restore: (id) => invoke('db:task.restore', { id }),
    delete: (id) => invoke('db:task.delete', { id }),

    getDetail: (id) => invoke('db:task.getDetail', { id }),

    listInbox: () => invoke('db:task.listInbox', {}),
    listAnytime: () => invoke('db:task.listAnytime', {}),
    listSomeday: () => invoke('db:task.listSomeday', {}),
    listToday: (date) => invoke('db:task.listToday', { date }),
    listUpcoming: (fromDate) => invoke('db:task.listUpcoming', { from_date: fromDate }),
    listLogbook: () => invoke('db:task.listLogbook', {}),
    listProject: (projectId) => invoke('db:task.listProject', { project_id: projectId }),
    countProjectDone: (projectId) => invoke('db:task.countProjectDone', { project_id: projectId }),
    countProjectsProgress: (projectIds) =>
      invoke('db:task.countProjectsProgress', { project_ids: projectIds }),
    listProjectDone: (projectId) => invoke('db:task.listProjectDone', { project_id: projectId }),
    listArea: (areaId) => invoke('db:task.listArea', { area_id: areaId }),

    search: (query, options) =>
      invoke('db:task.search', {
        query,
        include_logbook: options?.includeLogbook ?? false,
      }),

    reorderBatch: (listId, orderedTaskIds) =>
      invoke('db:task.reorderBatch', {
        list_id: listId,
        ordered_task_ids: orderedTaskIds,
      }),
    setTags: (taskId, tagIds) =>
      invoke('db:task.setTags', {
        task_id: taskId,
        tag_ids: tagIds,
      }),
  },

  project: {
    create: (input) => invoke('db:project.create', input),
    get: (id) => invoke('db:project.get', { id }),
    getDetail: (id) => invoke('db:project.getDetail', { id }),
    update: (input) => invoke('db:project.update', input),
    complete: (id) => invoke('db:project.complete', { id }),
    delete: (id) => invoke('db:project.delete', { id }),
    listOpen: () => invoke('db:project.listOpen', {}),
    listDone: () => invoke('db:project.listDone', {}),
    listOpenByArea: (areaId) => invoke('db:project.listOpenByArea', { area_id: areaId }),

    setTags: (projectId, tagIds) =>
      invoke('db:project.setTags', {
        project_id: projectId,
        tag_ids: tagIds,
      }),

    listSections: (projectId) => invoke('db:project.section.list', { project_id: projectId }),
    createSection: (projectId, title) => invoke('db:project.section.create', { project_id: projectId, title }),
    renameSection: (id, title) => invoke('db:project.section.rename', { id, title }),
    deleteSection: (id) => invoke('db:project.section.delete', { id }),
    reorderSections: (projectId, orderedSectionIds) =>
      invoke('db:project.section.reorderBatch', {
        project_id: projectId,
        ordered_section_ids: orderedSectionIds,
      }),
  },

  area: {
    create: (input) => invoke('db:area.create', input),
    get: (id) => invoke('db:area.get', { id }),
    getDetail: (id) => invoke('db:area.getDetail', { id }),
    update: (input) => invoke('db:area.update', input),
    list: () => invoke('db:area.list', {}),
    delete: (id) => invoke('db:area.delete', { id }),

    setTags: (areaId, tagIds) =>
      invoke('db:area.setTags', {
        area_id: areaId,
        tag_ids: tagIds,
      }),
  },

  sidebar: {
    listModel: () => invoke('db:sidebar.listModel', {}),
    reorderAreas: (input) => invoke('db:sidebar.reorderAreas', input),
    reorderProjects: (input) => invoke('db:sidebar.reorderProjects', input),
    moveProject: (input) => invoke('db:sidebar.moveProject', input),
  },

  tag: {
    create: (input) => invoke('db:tag.create', input),
    update: (input) => invoke('db:tag.update', input),
    list: () => invoke('db:tag.list', {}),
    delete: (id) => invoke('db:tag.delete', { id }),
  },

  checklist: {
    listByTask: (taskId) => invoke('db:checklist.listByTask', { task_id: taskId }),
    create: (input) => invoke('db:checklist.create', input),
    update: (input) => invoke('db:checklist.update', input),
    delete: (id) => invoke('db:checklist.delete', { id }),
  },
}

contextBridge.exposeInMainWorld('api', api)
