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
  sync: {
    getState: () => invoke('sync:getState'),
    getCredentials: () => invoke('sync:getCredentials'),
    testConnection: (input) => invoke('sync:testConnection', input),
    saveConfiguration: (input) => invoke('sync:saveConfiguration', input),
    enable: () => invoke('sync:enable'),
    disable: () => invoke('sync:disable'),
    syncNow: () => invoke('sync:syncNow'),
  },
  trash: {
    list: () => invoke('db:trash.list', {}),
    restoreTask: (id) => invoke('db:trash.restoreTask', { id }),
    restoreProject: (id) => invoke('db:trash.restoreProject', { id }),
    purgeTask: (id) => invoke('db:trash.purgeTask', { id }),
    purgeProject: (id) => invoke('db:trash.purgeProject', { id }),
    empty: () => invoke('db:trash.empty', {}),
  },
  task: {
    create: (input) => invoke('db:task.create', input),
    update: (input) => invoke('db:task.update', input),
    toggleDone: (id, done, scope) => invoke('db:task.toggleDone', { id, done, scope }),
    cancel: (id, scope) => invoke('db:task.cancel', { id, scope }),
    restore: (id, scope) => invoke('db:task.restore', { id, scope }),
    delete: (id) => invoke('db:task.delete', { id }),

    getDetail: (id, scope) => invoke('db:task.getDetail', { id, scope }),

    listInbox: () => invoke('db:task.listInbox', {}),
    listAnytime: () => invoke('db:task.listAnytime', {}),
    listSomeday: () => invoke('db:task.listSomeday', {}),
    listToday: (date) => invoke('db:task.listToday', { date }),
    listUpcoming: (fromDate) => invoke('db:task.listUpcoming', { from_date: fromDate }),
    listLogbook: () => invoke('db:task.listLogbook', {}),
    listProject: (projectId, scope) => invoke('db:task.listProject', { project_id: projectId, scope }),
    countProjectDone: (projectId, scope) => invoke('db:task.countProjectDone', { project_id: projectId, scope }),
    countProjectsProgress: (projectIds) =>
      invoke('db:task.countProjectsProgress', { project_ids: projectIds }),
    listProjectDone: (projectId, scope) => invoke('db:task.listProjectDone', { project_id: projectId, scope }),
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
    setTags: (taskId, tagIds, scope) =>
      invoke('db:task.setTags', {
        task_id: taskId,
        tag_ids: tagIds,
        scope,
      }),
  },

  project: {
    create: (input) => invoke('db:project.create', input),
    get: (id, scope) => invoke('db:project.get', { id, scope }),
    getDetail: (id, scope) => invoke('db:project.getDetail', { id, scope }),
    update: (input) => invoke('db:project.update', input),
    complete: (id, scope) => invoke('db:project.complete', { id, scope }),
    cancel: (id, scope) => invoke('db:project.cancel', { id, scope }),
    delete: (id) => invoke('db:project.delete', { id }),
    listOpen: () => invoke('db:project.listOpen', {}),
    listDone: () => invoke('db:project.listDone', {}),
    listOpenByArea: (areaId) => invoke('db:project.listOpenByArea', { area_id: areaId }),

    setTags: (projectId, tagIds, scope) =>
      invoke('db:project.setTags', {
        project_id: projectId,
        tag_ids: tagIds,
        scope,
      }),

    listSections: (projectId, scope) => invoke('db:project.section.list', { project_id: projectId, scope }),
    createSection: (projectId, title, scope) =>
      invoke('db:project.section.create', { project_id: projectId, title, scope }),
    renameSection: (id, title, scope) => invoke('db:project.section.rename', { id, title, scope }),
    deleteSection: (id) => invoke('db:project.section.delete', { id }),
    reorderSections: (projectId, orderedSectionIds, scope) =>
      invoke('db:project.section.reorderBatch', {
        project_id: projectId,
        ordered_section_ids: orderedSectionIds,
        scope,
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
    delete: (id, scope) => invoke('db:checklist.delete', { id, scope }),
  },
}

contextBridge.exposeInMainWorld('api', api)
