import { vi } from 'vitest'

import { err, ok } from '../../shared/result'
import type { AppError } from '../../shared/app-error'
import type { WindowApi } from '../../shared/window-api'

const unimplementedError: AppError = {
  code: 'TEST_UNIMPLEMENTED',
  message: 'Unimplemented window.api mock method (add per-test override).',
}

export function createWindowApiMock(): WindowApi {
  return {
    app: {
      getVersion: vi.fn<WindowApi['app']['getVersion']>(async () => ok('0.0.0')),
      getUserDataPath: vi.fn<WindowApi['app']['getUserDataPath']>(async () => ok('/tmp')),
      openPath: vi.fn<WindowApi['app']['openPath']>(async () => ok(undefined)),
      showItemInFolder: vi.fn<WindowApi['app']['showItemInFolder']>(async () => ok(undefined)),
    },

    data: {
      exportToFile: vi.fn<WindowApi['data']['exportToFile']>(async () => ok({ canceled: true })),
      importFromFile: vi.fn<WindowApi['data']['importFromFile']>(async () => ok({ canceled: true, imported: false })),
      resetAllData: vi.fn<WindowApi['data']['resetAllData']>(async () => ok(undefined)),
    },

    settings: {
      getLocaleState: vi.fn<WindowApi['settings']['getLocaleState']>(
        async () => ok({ locale: 'en', supportedLocales: ['en', 'zh-CN'] })
      ),
      setLocale: vi.fn<WindowApi['settings']['setLocale']>(
        async (locale) => ok({ locale, supportedLocales: ['en', 'zh-CN'] })
      ),

      getSidebarState: vi.fn<WindowApi['settings']['getSidebarState']>(async () => ok({ collapsedAreaIds: [] })),
      setSidebarState: vi.fn<WindowApi['settings']['setSidebarState']>(async (state) => ok(state)),

      getThemeState: vi.fn<WindowApi['settings']['getThemeState']>(
        async () => ok({ preference: 'system', effectiveTheme: 'light' })
      ),
      setThemePreference: vi.fn<WindowApi['settings']['setThemePreference']>(
        async (preference) => ok({ preference, effectiveTheme: preference === 'dark' ? 'dark' : 'light' })
      ),
      getFontSizeState: vi.fn<WindowApi['settings']['getFontSizeState']>(async () => ok({ step: 0 })),
      setFontSizeStep: vi.fn<WindowApi['settings']['setFontSizeStep']>(async (step) => ok({ step })),
    },

    trash: {
      list: vi.fn<WindowApi['trash']['list']>(async () => ok([])),
      restoreTask: vi.fn<WindowApi['trash']['restoreTask']>(async () => err(unimplementedError)),
      restoreProject: vi.fn<WindowApi['trash']['restoreProject']>(async () => err(unimplementedError)),
      purgeTask: vi.fn<WindowApi['trash']['purgeTask']>(async () => err(unimplementedError)),
      purgeProject: vi.fn<WindowApi['trash']['purgeProject']>(async () => err(unimplementedError)),
      empty: vi.fn<WindowApi['trash']['empty']>(async () => ok({ purged_count: 0 })),
    },

    task: {
      create: vi.fn<WindowApi['task']['create']>(async () => err(unimplementedError)),
      update: vi.fn<WindowApi['task']['update']>(async () => err(unimplementedError)),
      toggleDone: vi.fn<WindowApi['task']['toggleDone']>(async () => err(unimplementedError)),
      cancel: vi.fn<WindowApi['task']['cancel']>(async () => err(unimplementedError)),
      restore: vi.fn<WindowApi['task']['restore']>(async () => err(unimplementedError)),
      delete: vi.fn<WindowApi['task']['delete']>(async () => err(unimplementedError)),
      convertToProject: vi.fn<WindowApi['task']['convertToProject']>(async () => err(unimplementedError)),

      getDetail: vi.fn<WindowApi['task']['getDetail']>(async () => err(unimplementedError)),

      listInbox: vi.fn<WindowApi['task']['listInbox']>(async () => ok([])),
      listAnytime: vi.fn<WindowApi['task']['listAnytime']>(async () => ok([])),
      listSomeday: vi.fn<WindowApi['task']['listSomeday']>(async () => ok([])),
      listToday: vi.fn<WindowApi['task']['listToday']>(async () => ok([])),
      listUpcoming: vi.fn<WindowApi['task']['listUpcoming']>(async () => ok([])),
      listLogbook: vi.fn<WindowApi['task']['listLogbook']>(async () => ok([])),
      listProject: vi.fn<WindowApi['task']['listProject']>(async () => ok([])),
      countProjectDone: vi.fn<WindowApi['task']['countProjectDone']>(async () => ok({ count: 0 })),
      countProjectsProgress: vi.fn<WindowApi['task']['countProjectsProgress']>(async () => ok([])),
      countInbox: vi.fn<WindowApi['task']['countInbox']>(async () => ok({ count: 0 })),
      countToday: vi.fn<WindowApi['task']['countToday']>(async () => ok({ count: 0 })),
      listProjectDone: vi.fn<WindowApi['task']['listProjectDone']>(async () => ok([])),
      listArea: vi.fn<WindowApi['task']['listArea']>(async () => ok([])),

      search: vi.fn<WindowApi['task']['search']>(async () => ok([])),

      reorderBatch: vi.fn<WindowApi['task']['reorderBatch']>(async () => ok({ reordered: true })),
      setTags: vi.fn<WindowApi['task']['setTags']>(async () => ok({ updated: true })),
    },

    view: {
      listAnytime: vi.fn<WindowApi['view']['listAnytime']>(async () => ok([])),
      listSomeday: vi.fn<WindowApi['view']['listSomeday']>(async () => ok([])),
      listToday: vi.fn<WindowApi['view']['listToday']>(async () => ok([])),
      listUpcoming: vi.fn<WindowApi['view']['listUpcoming']>(async () => ok([])),
      reorderBatch: vi.fn<WindowApi['view']['reorderBatch']>(async () => ok({ reordered: true })),
    },

    project: {
      create: vi.fn<WindowApi['project']['create']>(async () => err(unimplementedError)),
      get: vi.fn<WindowApi['project']['get']>(async () => err(unimplementedError)),
      getDetail: vi.fn<WindowApi['project']['getDetail']>(async () => err(unimplementedError)),
      update: vi.fn<WindowApi['project']['update']>(async () => err(unimplementedError)),
      complete: vi.fn<WindowApi['project']['complete']>(async () => err(unimplementedError)),
      cancel: vi.fn<WindowApi['project']['cancel']>(async () => err(unimplementedError)),
      delete: vi.fn<WindowApi['project']['delete']>(async () => err(unimplementedError)),
      listOpen: vi.fn<WindowApi['project']['listOpen']>(async () => ok([])),
      listDone: vi.fn<WindowApi['project']['listDone']>(async () => ok([])),
      listOpenByArea: vi.fn<WindowApi['project']['listOpenByArea']>(async () => ok([])),

      setTags: vi.fn<WindowApi['project']['setTags']>(async () => ok({ updated: true })),

      listSections: vi.fn<WindowApi['project']['listSections']>(async () => ok([])),
      createSection: vi.fn<WindowApi['project']['createSection']>(async () => err(unimplementedError)),
      renameSection: vi.fn<WindowApi['project']['renameSection']>(async () => err(unimplementedError)),
      deleteSection: vi.fn<WindowApi['project']['deleteSection']>(async () => err(unimplementedError)),
      moveSection: vi.fn<WindowApi['project']['moveSection']>(async () => err(unimplementedError)),
      convertSectionToProject: vi.fn<WindowApi['project']['convertSectionToProject']>(async () => err(unimplementedError)),
      reorderSections: vi.fn<WindowApi['project']['reorderSections']>(async () => err(unimplementedError)),
    },

    area: {
      create: vi.fn<WindowApi['area']['create']>(async () => err(unimplementedError)),
      get: vi.fn<WindowApi['area']['get']>(async () => err(unimplementedError)),
      getDetail: vi.fn<WindowApi['area']['getDetail']>(async () => err(unimplementedError)),
      update: vi.fn<WindowApi['area']['update']>(async () => err(unimplementedError)),
      list: vi.fn<WindowApi['area']['list']>(async () => ok([])),
      delete: vi.fn<WindowApi['area']['delete']>(async () => err(unimplementedError)),

      setTags: vi.fn<WindowApi['area']['setTags']>(async () => ok({ updated: true })),
    },

    sidebar: {
      listModel: vi.fn<WindowApi['sidebar']['listModel']>(async () => err(unimplementedError)),
      reorderAreas: vi.fn<WindowApi['sidebar']['reorderAreas']>(async () => err(unimplementedError)),
      reorderProjects: vi.fn<WindowApi['sidebar']['reorderProjects']>(async () => err(unimplementedError)),
      moveProject: vi.fn<WindowApi['sidebar']['moveProject']>(async () => err(unimplementedError)),
    },

    tag: {
      create: vi.fn<WindowApi['tag']['create']>(async () => err(unimplementedError)),
      update: vi.fn<WindowApi['tag']['update']>(async () => err(unimplementedError)),
      list: vi.fn<WindowApi['tag']['list']>(async () => ok([])),
      delete: vi.fn<WindowApi['tag']['delete']>(async () => err(unimplementedError)),
    },

    checklist: {
      listByTask: vi.fn<WindowApi['checklist']['listByTask']>(async () => ok([])),
      create: vi.fn<WindowApi['checklist']['create']>(async () => err(unimplementedError)),
      update: vi.fn<WindowApi['checklist']['update']>(async () => err(unimplementedError)),
      delete: vi.fn<WindowApi['checklist']['delete']>(async () => err(unimplementedError)),
    },

    sync: {
      getState: vi.fn<WindowApi['sync']['getState']>(async () =>
        ok({ status: 'disabled', lastSyncAt: null, lastError: null, pendingCount: 0 })
      ),
      getConfig: vi.fn<WindowApi['sync']['getConfig']>(async () =>
        ok({ serverUrl: '', token: '', enabled: false })
      ),
      configure: vi.fn<WindowApi['sync']['configure']>(async () => ok(undefined)),
      disconnect: vi.fn<WindowApi['sync']['disconnect']>(async () => ok(undefined)),
      onStateChange: vi.fn<WindowApi['sync']['onStateChange']>(() => () => {}),
      onDataChanged: vi.fn<WindowApi['sync']['onDataChanged']>(() => () => {}),
    },
  }
}
