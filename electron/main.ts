import { app, BrowserWindow, dialog, ipcMain, nativeTheme, session, shell } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'

import { z } from 'zod'

import { toAppError, type AppError } from '../shared/app-error'
import { err, ok, resultSchema } from '../shared/result'

import { DbWorkerClient } from './workers/db/db-worker-client'

import { LocaleSchema, getSupportedLocales, normalizeLocale, type Locale } from '../shared/i18n/locale'
import { translate } from '../shared/i18n/translate'

import {
  DataExportSchema,
  AreaDetailSchema,
  ProjectCompleteInputSchema,
  ProjectCompleteResultSchema,
  ProjectCreateInputSchema,
  ProjectDeleteInputSchema,
  ProjectDetailSchema,
  ProjectIdInputSchema,
  ProjectSetTagsInputSchema,
  ProjectSchema,
  ProjectSectionCreateInputSchema,
  ProjectSectionDeleteInputSchema,
  ProjectSectionReorderBatchInputSchema,
  ProjectSectionSchema,
  ProjectSectionRenameInputSchema,
  ProjectUpdateInputSchema,
  TagCreateInputSchema,
  TagSchema,
  TagUpdateInputSchema,
  TaskCreateInputSchema,
  TaskDeleteInputSchema,
  TaskReorderBatchInputSchema,
  TaskRestoreInputSchema,
  TaskDetailSchema,
  TaskIdInputSchema,
  TaskSchema,
  TaskSearchInputSchema,
  TaskSearchResultItemSchema,
  TaskSetTagsInputSchema,
  TaskToggleDoneInputSchema,
  TaskUpdateInputSchema,
  TaskListAnytimeInputSchema,
  TaskCountProjectDoneInputSchema,
  TaskCountProjectsProgressInputSchema,
  TaskCountProjectsProgressResultSchema,
  TaskCountResultSchema,
  TaskListInboxInputSchema,
  TaskListItemSchema,
  TaskListLogbookInputSchema,
  TaskListProjectDoneInputSchema,
  TaskListProjectInputSchema,
  TaskListSomedayInputSchema,
  TaskListTodayInputSchema,
  TaskListUpcomingInputSchema,
  TaskRolloverScheduledToTodayInputSchema,
  TaskRolloverScheduledToTodayResultSchema,
  AreaCreateInputSchema,
  AreaSetTagsInputSchema,
  AreaSchema,
  AreaUpdateInputSchema,
  AreaDeleteInputSchema,
  ChecklistItemCreateInputSchema,
  ChecklistItemSchema,
  ChecklistItemUpdateInputSchema,
  ChecklistItemDeleteInputSchema,
  SidebarListModelInputSchema,
  SidebarListModelSchema,
  SidebarMoveProjectInputSchema,
  SidebarMoveProjectResultSchema,
  SidebarReorderAreasInputSchema,
  SidebarReorderProjectsInputSchema,
  SidebarReorderResultSchema,
  SyncConnectionInputSchema,
  SyncSaveConfigurationInputSchema,
  SyncStateSchema,
  SyncTestConnectionResultSchema,
  TrashEmptyResultSchema,
  TrashEntrySchema,
  TrashListInputSchema,
  TrashPurgeResultSchema,
  TrashRestoreResultSchema,
  TrashRootIdInputSchema,
  ThemePreferenceSchema,
  ThemeStateSchema,
  type EffectiveTheme,
  type ThemePreference,
} from '../shared/schemas'
import { ElectronSyncCredentialsStore } from './sync/electron-sync-credentials-store'
import { createMainSyncBridge } from './sync/main-sync-bridge'
import { S3SyncRepository } from './sync/s3-sync-repository'
import { SyncService } from './sync/sync-service'
import { getWindowBackgroundColor } from './theme/window-background'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

const IS_SELF_TEST = process.env.MILESTO_SELF_TEST === '1'
const SELF_TEST_SUITE = process.env.MILESTO_SELF_TEST_SUITE ?? 'full'
const SELF_TEST_USER_DATA_DIR = IS_SELF_TEST
  ? path.join(process.env.APP_ROOT ?? __dirname, '.tmp', 'milesto-selftest', `${Date.now()}-${process.pid}`)
  : null

if (IS_SELF_TEST && SELF_TEST_USER_DATA_DIR) {
  // Keep self-tests isolated from real user data (separate DB file).
  app.setPath('userData', SELF_TEST_USER_DATA_DIR)
}

let isCspInstalled = false

function installCspOnce() {
  if (isCspInstalled) return
  isCspInstalled = true

  const cspParts = [
    "default-src 'self'",
    // Vite dev (react-refresh) uses a small inline preamble; avoid unsafe-eval, allow inline.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    VITE_DEV_SERVER_URL ? "connect-src 'self' ws:" : "connect-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
  ]
  const csp = cspParts.join('; ')

  // Apply CSP via headers (works for both dev server + file://).
  // Electron security baseline: at least disable `unsafe-eval`.
  // https://www.electronjs.org/docs/latest/tutorial/security
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders ?? {}
    headers['Content-Security-Policy'] = [csp]
    callback({ responseHeaders: headers })
  })
}

function getAllowedRendererUrlPrefixes(): string[] {
  if (VITE_DEV_SERVER_URL) return [VITE_DEV_SERVER_URL]
  // Allow any file under dist/ (index.html + assets).
  return [pathToFileURL(RENDERER_DIST + path.sep).toString()]
}

function isValidIpcSender(event: Electron.IpcMainInvokeEvent): boolean {
  const url = event.senderFrame.url
  return getAllowedRendererUrlPrefixes().some((prefix) => url.startsWith(prefix))
}

function invalidSenderError(event: Electron.IpcMainInvokeEvent): AppError {
  return {
    code: 'IPC_INVALID_SENDER',
    message: 'IPC sender is not trusted.',
    details: { url: event.senderFrame.url },
  }
}

function ensureTrustedSender(event: Electron.IpcMainInvokeEvent): AppError | null {
  return isValidIpcSender(event) ? null : invalidSenderError(event)
}

const PathPayloadSchema = z.object({ path: z.string().min(1) })

const ResultStringSchema = resultSchema(z.string())
const ResultVoidSchema = resultSchema(z.undefined())
const ExportResultSchema = resultSchema(
  z.object({
    canceled: z.boolean(),
    filePath: z.string().optional(),
  })
)
const ImportResultSchema = resultSchema(
  z.object({
    canceled: z.boolean(),
    imported: z.boolean(),
  })
)

const LocaleStateSchema = z.object({
  locale: LocaleSchema,
  supportedLocales: z.array(LocaleSchema),
})
const LocaleStateResultSchema = resultSchema(LocaleStateSchema)
const SetLocalePayloadSchema = z.object({ locale: z.unknown() })

const SidebarStateSchema = z.object({
  collapsedAreaIds: z.array(z.string()),
})
const SidebarStateResultSchema = resultSchema(SidebarStateSchema)
const SetSidebarStatePayloadSchema = z.object({ state: z.unknown() })

const ThemeStateResultSchema = resultSchema(ThemeStateSchema)
const SetThemePreferencePayloadSchema = z.object({ preference: z.unknown() })
const SyncStateResultSchema = resultSchema(SyncStateSchema)
const SyncTestConnectionResultResponseSchema = resultSchema(SyncTestConnectionResultSchema)

const DbLocaleRowSchema = z.object({ locale: z.string().nullable() })
const DbSetLocaleResultSchema = z.object({ locale: z.string() })

const DbThemePreferenceRowSchema = z.object({ preference: z.string().nullable() })
const DbSetThemePreferenceResultSchema = z.object({ preference: z.string() })

const DbSidebarStateSchema = SidebarStateSchema

function getEffectiveThemeFromNative(): EffectiveTheme {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

function resolveEffectiveTheme(preference: ThemePreference): EffectiveTheme {
  if (preference === 'light') return 'light'
  if (preference === 'dark') return 'dark'
  return getEffectiveThemeFromNative()
}

function resolveEffectiveThemeForApp(preference: ThemePreference): EffectiveTheme {
  if (!IS_SELF_TEST) return resolveEffectiveTheme(preference)
  return preference === 'dark' ? 'dark' : 'light'
}

function applyThemeSource(preference: ThemePreference) {
  if (IS_SELF_TEST) {
    nativeTheme.themeSource = preference === 'dark' ? 'dark' : 'light'
    return
  }

  nativeTheme.themeSource = preference
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function loadThemePreference(dbWorker: DbWorkerClient): Promise<ThemePreference> {
  const persistedRes = await dbWorker.request('settings.getThemePreference', {})
  if (!persistedRes.ok) return 'system'

  const parsed = DbThemePreferenceRowSchema.safeParse(persistedRes.data)
  const persisted = parsed.success ? parsed.data.preference : null
  if (!persisted) return 'system'

  const allowlisted = ThemePreferenceSchema.safeParse(persisted)
  return allowlisted.success ? allowlisted.data : 'system'
}

async function resolveThemeState(dbWorker: DbWorkerClient): Promise<{ preference: ThemePreference; effectiveTheme: EffectiveTheme }> {
  const preference = await loadThemePreference(dbWorker)

  // Self-test mode stays deterministic for `system`, but explicit dark should still render dark.
  applyThemeSource(preference)
  return { preference, effectiveTheme: resolveEffectiveThemeForApp(preference) }
}

function createWindow(opts?: { backgroundColor?: string }) {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    backgroundColor: opts?.backgroundColor,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    const url = new URL(VITE_DEV_SERVER_URL)
    if (IS_SELF_TEST) url.searchParams.set('selfTest', '1')
    if (IS_SELF_TEST && process.env.MILESTO_SELF_TEST_REDUCED_MOTION === '1') {
      url.searchParams.set('reducedMotion', '1')
    }
    win.loadURL(url.toString())
  } else {
    // win.loadFile('dist/index.html')
    const htmlPath = path.join(RENDERER_DIST, 'index.html')
    if (IS_SELF_TEST) {
      win.loadFile(htmlPath, {
        query: {
          selfTest: '1',
          ...(process.env.MILESTO_SELF_TEST_REDUCED_MOTION === '1' ? { reducedMotion: '1' } : {}),
        },
      })
    } else {
      win.loadFile(htmlPath)
    }
  }

  if (IS_SELF_TEST) {
    win.webContents.once('did-finish-load', async () => {
      if (!win) return
      try {
        const fnName =
          SELF_TEST_SUITE === 'search'
            ? '__milestoRunSearchSmokeTest'
            : SELF_TEST_SUITE === 'project'
              ? '__milestoRunProjectSelfTest'
            : SELF_TEST_SUITE === 'sidebar'
              ? '__milestoRunSidebarSelfTest'
              : SELF_TEST_SUITE === 'trash'
                ? '__milestoRunTrashSelfTest'
              : '__milestoRunSelfTest'
        const result = (await win.webContents.executeJavaScript(
          `
            (async () => {
              const start = Date.now()
              while (typeof window[${JSON.stringify(fnName)}] !== 'function') {
                if (Date.now() - start > 15000) {
                  throw new Error('self-test function not registered (timeout)')
                }
                await new Promise((r) => setTimeout(r, 50))
              }
              return window[${JSON.stringify(fnName)}]()
            })()
          `
        )) as unknown

        const parsed = result as { ok?: unknown; failures?: unknown }
        const ok = parsed && parsed.ok === true
        const failures = Array.isArray(parsed.failures) ? parsed.failures : []

        // Report to stdout so CLI can assert success.
        console.log('[MILESTO_SELF_TEST]', JSON.stringify({ suite: SELF_TEST_SUITE, ok, failures }))

        app.exit(ok ? 0 : 1)
      } catch (e) {
        console.error('[MILESTO_SELF_TEST] failed', e)
        app.exit(1)
      }
    })
  }
}

function registerIpcHandlers(
  dbWorker: DbWorkerClient,
  syncBridge: ReturnType<typeof createMainSyncBridge>,
  syncService: SyncService,
  credentialsStore: ElectronSyncCredentialsStore
) {
  const supportedLocales = getSupportedLocales()
  let cachedEffectiveLocale: Locale | null = null
  const syncMutationActions = new Set([
    'task.create',
    'task.update',
    'task.toggleDone',
    'task.restore',
    'task.delete',
    'task.reorderBatch',
    'task.setTags',
    'project.create',
    'project.update',
    'project.complete',
    'project.delete',
    'project.setTags',
    'project.section.create',
    'project.section.rename',
    'project.section.reorderBatch',
    'project.section.delete',
    'area.create',
    'area.update',
    'area.delete',
    'area.setTags',
    'sidebar.reorderAreas',
    'sidebar.reorderProjects',
    'sidebar.moveProject',
    'tag.create',
    'tag.update',
    'tag.delete',
    'checklist.create',
    'checklist.update',
    'checklist.delete',
  ])

  async function resolveEffectiveLocale(): Promise<Locale> {
    if (IS_SELF_TEST) return 'en'
    if (cachedEffectiveLocale) return cachedEffectiveLocale

    const persistedRes = await dbWorker.request('settings.getLocale', {})
    if (persistedRes.ok) {
      const parsed = DbLocaleRowSchema.safeParse(persistedRes.data)
      const persisted = parsed.success ? parsed.data.locale : null

      if (persisted) {
        const allowlisted = LocaleSchema.safeParse(persisted)
        if (allowlisted.success) {
          cachedEffectiveLocale = allowlisted.data
          return cachedEffectiveLocale
        }
      }
    }

    // Fallback chain: system locale (normalized) -> en.
    cachedEffectiveLocale = normalizeLocale(app.getLocale())
    return cachedEffectiveLocale
  }

  function handleDb<TPayload, TData>(
    channel: string,
    action: string,
    payloadSchema: z.ZodType<TPayload>,
    dataSchema: z.ZodType<TData>
  ) {
    const responseSchema = resultSchema(dataSchema)

    ipcMain.handle(channel, async (event, payload) => {
      const senderErr = ensureTrustedSender(event)
      if (senderErr) return responseSchema.parse(err(senderErr))

      const parsedPayload = payloadSchema.safeParse(payload)
      if (!parsedPayload.success) {
        return responseSchema.parse(
          err({
            code: 'VALIDATION_FAILED',
            message: 'Invalid payload.',
            details: { issues: parsedPayload.error.issues },
          })
        )
      }

      const res = await dbWorker.request(action, parsedPayload.data)
      if (!res.ok) return responseSchema.parse(err(res.error))

      const parsedData = dataSchema.safeParse(res.data)
      if (!parsedData.success) {
        return responseSchema.parse(
          err({
            code: 'DB_INVALID_RETURN',
            message: 'Invalid DB return value.',
            details: { issues: parsedData.error.issues, action },
          })
        )
      }

      if (syncMutationActions.has(action)) {
        await syncService.notifyLocalChange()
      }

      return responseSchema.parse(ok(parsedData.data))
    })
  }

  ipcMain.handle('app:getVersion', async (event) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return ResultStringSchema.parse(err(senderErr))
    return ResultStringSchema.parse(ok(app.getVersion()))
  })

  ipcMain.handle('app:getUserDataPath', async (event) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return ResultStringSchema.parse(err(senderErr))
    return ResultStringSchema.parse(ok(app.getPath('userData')))
  })

  ipcMain.handle('app:openPath', async (event, payload) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return ResultVoidSchema.parse(err(senderErr))

    const parsed = PathPayloadSchema.safeParse(payload)
    if (!parsed.success) {
      return ResultVoidSchema.parse(
        err({
          code: 'VALIDATION_FAILED',
          message: 'Invalid payload.',
          details: { issues: parsed.error.issues },
        })
      )
    }

    const maybeError = await shell.openPath(parsed.data.path)
    if (maybeError) {
      return ResultVoidSchema.parse(
        err({
          code: 'OPEN_PATH_FAILED',
          message: 'Failed to open path.',
          details: { error: maybeError },
        })
      )
    }

    return ResultVoidSchema.parse(ok(undefined))
  })

  ipcMain.handle('app:showItemInFolder', async (event, payload) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return ResultVoidSchema.parse(err(senderErr))

    const parsed = PathPayloadSchema.safeParse(payload)
    if (!parsed.success) {
      return ResultVoidSchema.parse(
        err({
          code: 'VALIDATION_FAILED',
          message: 'Invalid payload.',
          details: { issues: parsed.error.issues },
        })
      )
    }

    shell.showItemInFolder(parsed.data.path)
    return ResultVoidSchema.parse(ok(undefined))
  })

  ipcMain.handle('data:exportToFile', async (event) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return ExportResultSchema.parse(err(senderErr))

    const locale = await resolveEffectiveLocale()

    // Placeholder until DB worker is wired. Still provides a safe flow and does not expose raw fs.
    const result = await dialog.showSaveDialog({
      title: translate(locale, 'dialog.export.title'),
      defaultPath: path.join(app.getPath('downloads'), `milesto-export-${Date.now()}.json`),
      filters: [{ name: translate(locale, 'fileFilter.json'), extensions: ['json'] }],
    })

    if (result.canceled || !result.filePath) {
      return ExportResultSchema.parse(ok({ canceled: true }))
    }

    const exportRes = await dbWorker.request('data.export', { app_version: app.getVersion() })
    if (!exportRes.ok) return ExportResultSchema.parse(err(exportRes.error))

    const parsedData = DataExportSchema.safeParse(exportRes.data)
    if (!parsedData.success) {
      return ExportResultSchema.parse(
        err({
          code: 'DB_INVALID_RETURN',
          message: 'Invalid export data.',
          details: { issues: parsedData.error.issues },
        })
      )
    }

    await fs.writeFile(result.filePath, JSON.stringify(parsedData.data, null, 2), 'utf-8')

    return ExportResultSchema.parse(ok({ canceled: false, filePath: result.filePath }))
  })

  ipcMain.handle('data:importFromFile', async (event) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return ImportResultSchema.parse(err(senderErr))

    const locale = await resolveEffectiveLocale()

    const result = await dialog.showOpenDialog({
      title: translate(locale, 'dialog.import.title'),
      properties: ['openFile'],
      filters: [{ name: translate(locale, 'fileFilter.json'), extensions: ['json'] }],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return ImportResultSchema.parse(ok({ canceled: true, imported: false }))
    }

    try {
      const raw = await fs.readFile(result.filePaths[0]!, 'utf-8')
      const json = JSON.parse(raw) as unknown

      const parsedData = DataExportSchema.safeParse(json)
      if (!parsedData.success) {
        return ImportResultSchema.parse(
          err({
            code: 'IMPORT_INVALID_JSON',
            message: 'Invalid import file.',
            details: { issues: parsedData.error.issues },
          })
        )
      }

      const importRes = await dbWorker.request('data.importOverwrite', {
        mode: 'overwrite',
        data: parsedData.data,
      })
      if (!importRes.ok) return ImportResultSchema.parse(err(importRes.error))

      return ImportResultSchema.parse(ok({ canceled: false, imported: true }))
    } catch (e) {
      return ImportResultSchema.parse(
        err({
          code: 'IMPORT_READ_FAILED',
          message: 'Failed to import file.',
          details: { error: String(e) },
        })
      )
    }
  })

  ipcMain.handle('data:resetAllData', async (event) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return ResultVoidSchema.parse(err(senderErr))

    const res = await dbWorker.request('db.resetAllData', {})
    if (!res.ok) return ResultVoidSchema.parse(err(res.error))
    return ResultVoidSchema.parse(ok(undefined))
  })

  ipcMain.handle('settings:getLocaleState', async (event) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return LocaleStateResultSchema.parse(err(senderErr))

    const locale = await resolveEffectiveLocale()
    return LocaleStateResultSchema.parse(ok({ locale, supportedLocales }))
  })

  ipcMain.handle('settings:setLocale', async (event, payload) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return LocaleStateResultSchema.parse(err(senderErr))

    const parsed = SetLocalePayloadSchema.safeParse(payload)
    if (!parsed.success) {
      return LocaleStateResultSchema.parse(
        err({
          code: 'VALIDATION_FAILED',
          message: 'Invalid payload.',
          details: { issues: parsed.error.issues },
        })
      )
    }

    // Self-test mode forces English regardless of persisted preference.
    if (IS_SELF_TEST) {
      cachedEffectiveLocale = 'en'
      return LocaleStateResultSchema.parse(ok({ locale: 'en', supportedLocales }))
    }

    const nextLocale = normalizeLocale(parsed.data.locale)
    const res = await dbWorker.request('settings.setLocale', { locale: nextLocale })
    if (!res.ok) return LocaleStateResultSchema.parse(err(res.error))

    const parsedData = DbSetLocaleResultSchema.safeParse(res.data)
    if (!parsedData.success) {
      return LocaleStateResultSchema.parse(
        err({
          code: 'DB_INVALID_RETURN',
          message: 'Invalid DB return value.',
          details: { issues: parsedData.error.issues, action: 'settings.setLocale' },
        })
      )
    }

    const effective = normalizeLocale(parsedData.data.locale)
    cachedEffectiveLocale = effective
    return LocaleStateResultSchema.parse(ok({ locale: effective, supportedLocales }))
  })

  ipcMain.handle('settings:getSidebarState', async (event) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return SidebarStateResultSchema.parse(err(senderErr))

    const res = await dbWorker.request('settings.getSidebarState', {})
    if (!res.ok) return SidebarStateResultSchema.parse(err(res.error))

    const parsedData = DbSidebarStateSchema.safeParse(res.data)
    if (!parsedData.success) {
      return SidebarStateResultSchema.parse(
        err({
          code: 'DB_INVALID_RETURN',
          message: 'Invalid DB return value.',
          details: { issues: parsedData.error.issues, action: 'settings.getSidebarState' },
        })
      )
    }

    return SidebarStateResultSchema.parse(ok(parsedData.data))
  })

  ipcMain.handle('settings:setSidebarState', async (event, payload) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return SidebarStateResultSchema.parse(err(senderErr))

    const parsedPayload = SetSidebarStatePayloadSchema.safeParse(payload)
    if (!parsedPayload.success) {
      return SidebarStateResultSchema.parse(
        err({
          code: 'VALIDATION_FAILED',
          message: 'Invalid payload.',
          details: { issues: parsedPayload.error.issues },
        })
      )
    }

    const parsedState = SidebarStateSchema.safeParse(parsedPayload.data.state)
    if (!parsedState.success) {
      return SidebarStateResultSchema.parse(
        err({
          code: 'VALIDATION_FAILED',
          message: 'Invalid payload.',
          details: { issues: parsedState.error.issues },
        })
      )
    }

    const res = await dbWorker.request('settings.setSidebarState', parsedState.data)
    if (!res.ok) return SidebarStateResultSchema.parse(err(res.error))

    const parsedData = DbSidebarStateSchema.safeParse(res.data)
    if (!parsedData.success) {
      return SidebarStateResultSchema.parse(
        err({
          code: 'DB_INVALID_RETURN',
          message: 'Invalid DB return value.',
          details: { issues: parsedData.error.issues, action: 'settings.setSidebarState' },
        })
      )
    }

    return SidebarStateResultSchema.parse(ok(parsedData.data))
  })

  ipcMain.handle('settings:getThemeState', async (event) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return ThemeStateResultSchema.parse(err(senderErr))

    const state = await resolveThemeState(dbWorker)
    return ThemeStateResultSchema.parse(ok(state))
  })

  ipcMain.handle('settings:setThemePreference', async (event, payload) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return ThemeStateResultSchema.parse(err(senderErr))

    const parsedPayload = SetThemePreferencePayloadSchema.safeParse(payload)
    if (!parsedPayload.success) {
      return ThemeStateResultSchema.parse(
        err({
          code: 'VALIDATION_FAILED',
          message: 'Invalid payload.',
          details: { issues: parsedPayload.error.issues },
        })
      )
    }

    const preferenceParsed = ThemePreferenceSchema.safeParse(parsedPayload.data.preference)
    if (!preferenceParsed.success) {
      return ThemeStateResultSchema.parse(
        err({
          code: 'VALIDATION_FAILED',
          message: 'Invalid theme preference.',
          details: { issues: preferenceParsed.error.issues },
        })
      )
    }

    const preference = preferenceParsed.data

    const res = await dbWorker.request('settings.setThemePreference', { preference })
    if (!res.ok) return ThemeStateResultSchema.parse(err(res.error))

    const parsedData = DbSetThemePreferenceResultSchema.safeParse(res.data)
    if (!parsedData.success) {
      return ThemeStateResultSchema.parse(
        err({
          code: 'DB_INVALID_RETURN',
          message: 'Invalid DB return value.',
          details: { issues: parsedData.error.issues, action: 'settings.setThemePreference' },
        })
      )
    }

    const dbPreferenceParsed = ThemePreferenceSchema.safeParse(parsedData.data.preference)
    if (!dbPreferenceParsed.success) {
      return ThemeStateResultSchema.parse(
        err({
          code: 'DB_INVALID_RETURN',
          message: 'Invalid DB return value.',
          details: { issues: dbPreferenceParsed.error.issues, action: 'settings.setThemePreference' },
        })
      )
    }

    const persistedPreference = dbPreferenceParsed.data

    // Apply effective theme immediately (no restart).
    const state = {
      preference: persistedPreference,
      effectiveTheme: resolveEffectiveThemeForApp(persistedPreference),
    } satisfies { preference: ThemePreference; effectiveTheme: EffectiveTheme }

    applyThemeSource(persistedPreference)

    if (win) {
      win.setBackgroundColor(getWindowBackgroundColor(state.effectiveTheme))
    }

    return ThemeStateResultSchema.parse(ok(state))
  })

  async function readSyncState(): Promise<z.infer<typeof SyncStateSchema>> {
    return await syncService.getState()
  }

  ipcMain.handle('sync:getState', async (event) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return SyncStateResultSchema.parse(err(senderErr))

    try {
      return SyncStateResultSchema.parse(ok(await readSyncState()))
    } catch (error) {
      return SyncStateResultSchema.parse(
        err(
          toAppError(error, {
            code: 'SYNC_STATE_FAILED',
            message: 'Failed to load sync state.',
          })
        )
      )
    }
  })

  ipcMain.handle('sync:testConnection', async (event, payload) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return SyncTestConnectionResultResponseSchema.parse(err(senderErr))

    const parsed = SyncConnectionInputSchema.safeParse(payload)
    if (!parsed.success) {
      return SyncTestConnectionResultResponseSchema.parse(
        err({
          code: 'VALIDATION_FAILED',
          message: 'Invalid payload.',
          details: { issues: parsed.error.issues },
        })
      )
    }

    try {
      const repository = new S3SyncRepository()
      await repository.ensureReady(parsed.data.config, parsed.data.credentials)
      return SyncTestConnectionResultResponseSchema.parse(ok({ reachable: true }))
    } catch (error) {
      return SyncTestConnectionResultResponseSchema.parse(
        err(
          toAppError(error, {
            code: 'SYNC_CONNECTION_FAILED',
            message: 'Failed to connect to the sync repository.',
          })
        )
      )
    }
  })

  ipcMain.handle('sync:saveConfiguration', async (event, payload) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return SyncStateResultSchema.parse(err(senderErr))

    const parsed = SyncSaveConfigurationInputSchema.safeParse(payload)
    if (!parsed.success) {
      return SyncStateResultSchema.parse(
        err({
          code: 'VALIDATION_FAILED',
          message: 'Invalid payload.',
          details: { issues: parsed.error.issues },
        })
      )
    }

    try {
      if (parsed.data.credentials?.access_key_id && parsed.data.credentials.secret_access_key) {
        await credentialsStore.save({
          access_key_id: parsed.data.credentials.access_key_id,
          secret_access_key: parsed.data.credentials.secret_access_key,
          session_token: parsed.data.credentials.session_token ?? undefined,
        })
      }

      await syncBridge.saveConfiguration({
        config: parsed.data.config,
        device_name: parsed.data.device_name,
      })
      await syncService.start()

      return SyncStateResultSchema.parse(ok(await readSyncState()))
    } catch (error) {
      return SyncStateResultSchema.parse(
        err(
          toAppError(error, {
            code: 'SYNC_SAVE_FAILED',
            message: 'Failed to save sync configuration.',
          })
        )
      )
    }
  })

  ipcMain.handle('sync:enable', async (event) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return SyncStateResultSchema.parse(err(senderErr))

    try {
      const currentState = await syncBridge.getState()
      if (!currentState.config) {
        return SyncStateResultSchema.parse(
          err({
            code: 'SYNC_CONFIG_MISSING',
            message: 'Sync repository configuration is missing.',
          })
        )
      }

      if (!credentialsStore.isAvailable()) {
        return SyncStateResultSchema.parse(
          err({
            code: 'SYNC_SECURE_STORAGE_UNAVAILABLE',
            message: 'Secure storage is unavailable on this device.',
          })
        )
      }

      const credentials = await credentialsStore.load()
      const repository = new S3SyncRepository()
      await repository.ensureReady(currentState.config, credentials)

      await syncBridge.setEnabled(true)
      return SyncStateResultSchema.parse(ok(await syncService.syncNow()))
    } catch (error) {
      return SyncStateResultSchema.parse(
        err(
          toAppError(error, {
            code: 'SYNC_ENABLE_FAILED',
            message: 'Failed to enable sync.',
          })
        )
      )
    }
  })

  ipcMain.handle('sync:disable', async (event) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return SyncStateResultSchema.parse(err(senderErr))

    try {
      await syncBridge.setEnabled(false)
      return SyncStateResultSchema.parse(ok(await syncService.syncNow()))
    } catch (error) {
      return SyncStateResultSchema.parse(
        err(
          toAppError(error, {
            code: 'SYNC_DISABLE_FAILED',
            message: 'Failed to disable sync.',
          })
        )
      )
    }
  })

  ipcMain.handle('sync:syncNow', async (event) => {
    const senderErr = ensureTrustedSender(event)
    if (senderErr) return SyncStateResultSchema.parse(err(senderErr))

    try {
      return SyncStateResultSchema.parse(ok(await syncService.syncNow()))
    } catch (error) {
      return SyncStateResultSchema.parse(
        err(
          toAppError(error, {
            code: 'SYNC_CYCLE_FAILED',
            message: 'Failed to run sync.',
          })
        )
      )
    }
  })

  // DB IPC (Renderer -> Main -> DB Worker)
  handleDb('db:trash.list', 'trash.list', TrashListInputSchema, z.array(TrashEntrySchema))
  handleDb('db:trash.restoreTask', 'trash.restoreTask', TrashRootIdInputSchema, TrashRestoreResultSchema)
  handleDb('db:trash.restoreProject', 'trash.restoreProject', TrashRootIdInputSchema, TrashRestoreResultSchema)
  handleDb('db:trash.purgeTask', 'trash.purgeTask', TrashRootIdInputSchema, TrashPurgeResultSchema)
  handleDb('db:trash.purgeProject', 'trash.purgeProject', TrashRootIdInputSchema, TrashPurgeResultSchema)
  handleDb('db:trash.empty', 'trash.empty', TrashListInputSchema, TrashEmptyResultSchema)

  handleDb('db:task.create', 'task.create', TaskCreateInputSchema, TaskSchema)
  handleDb('db:task.update', 'task.update', TaskUpdateInputSchema, TaskSchema)
  handleDb('db:task.toggleDone', 'task.toggleDone', TaskToggleDoneInputSchema, TaskSchema)
  handleDb('db:task.restore', 'task.restore', TaskRestoreInputSchema, TaskSchema)
  handleDb('db:task.delete', 'task.delete', TaskDeleteInputSchema, z.object({ deleted: z.boolean() }))
  handleDb('db:task.getDetail', 'task.getDetail', TaskIdInputSchema, TaskDetailSchema)

  handleDb('db:task.listInbox', 'task.listInbox', TaskListInboxInputSchema, z.array(TaskListItemSchema))
  handleDb('db:task.listAnytime', 'task.listAnytime', TaskListAnytimeInputSchema, z.array(TaskListItemSchema))
  handleDb('db:task.listSomeday', 'task.listSomeday', TaskListSomedayInputSchema, z.array(TaskListItemSchema))
  handleDb('db:task.listToday', 'task.listToday', TaskListTodayInputSchema, z.array(TaskListItemSchema))
  handleDb(
    'db:task.listUpcoming',
    'task.listUpcoming',
    TaskListUpcomingInputSchema,
    z.array(TaskListItemSchema)
  )
  handleDb(
    'db:task.listLogbook',
    'task.listLogbook',
    TaskListLogbookInputSchema,
    z.array(TaskListItemSchema)
  )
  handleDb(
    'db:task.listProject',
    'task.listProject',
    TaskListProjectInputSchema,
    z.array(TaskListItemSchema)
  )
  handleDb(
    'db:task.countProjectDone',
    'task.countProjectDone',
    TaskCountProjectDoneInputSchema,
    TaskCountResultSchema
  )
  handleDb(
    'db:task.countProjectsProgress',
    'task.countProjectsProgress',
    TaskCountProjectsProgressInputSchema,
    TaskCountProjectsProgressResultSchema
  )
  handleDb(
    'db:task.listProjectDone',
    'task.listProjectDone',
    TaskListProjectDoneInputSchema,
    z.array(TaskListItemSchema)
  )
  handleDb('db:task.listArea', 'task.listArea', z.object({ area_id: z.string() }), z.array(TaskListItemSchema))
  handleDb(
    'db:task.search',
    'task.search',
    TaskSearchInputSchema,
    z.array(TaskSearchResultItemSchema)
  )
  handleDb('db:task.reorderBatch', 'task.reorderBatch', TaskReorderBatchInputSchema, z.object({ reordered: z.boolean() }))
  handleDb('db:task.setTags', 'task.setTags', TaskSetTagsInputSchema, z.object({ updated: z.boolean() }))

  handleDb('db:project.create', 'project.create', ProjectCreateInputSchema, ProjectSchema)
  handleDb('db:project.get', 'project.get', ProjectIdInputSchema, ProjectSchema)
  handleDb('db:project.getDetail', 'project.getDetail', ProjectIdInputSchema, ProjectDetailSchema)
  handleDb('db:project.update', 'project.update', ProjectUpdateInputSchema, ProjectSchema)
  handleDb('db:project.complete', 'project.complete', ProjectCompleteInputSchema, ProjectCompleteResultSchema)
  handleDb('db:project.delete', 'project.delete', ProjectDeleteInputSchema, z.object({ deleted: z.boolean() }))
  handleDb('db:project.listOpen', 'project.listOpen', z.object({}), z.array(ProjectSchema))
  handleDb('db:project.listDone', 'project.listDone', z.object({}), z.array(ProjectSchema))
  handleDb('db:project.setTags', 'project.setTags', ProjectSetTagsInputSchema, z.object({ updated: z.boolean() }))
  handleDb(
    'db:project.listOpenByArea',
    'project.listOpenByArea',
    z.object({ area_id: z.string() }),
    z.array(ProjectSchema)
  )
  handleDb('db:project.section.list', 'project.section.list', z.object({ project_id: z.string() }), z.array(ProjectSectionSchema))
  handleDb('db:project.section.create', 'project.section.create', ProjectSectionCreateInputSchema, ProjectSectionSchema)
  handleDb('db:project.section.rename', 'project.section.rename', ProjectSectionRenameInputSchema, ProjectSectionSchema)
  handleDb('db:project.section.delete', 'project.section.delete', ProjectSectionDeleteInputSchema, z.object({ deleted: z.boolean(), moved_to_section_id: z.string().nullable() }))
  handleDb(
    'db:project.section.reorderBatch',
    'project.section.reorderBatch',
    ProjectSectionReorderBatchInputSchema,
    z.object({ reordered: z.boolean() })
  )

  handleDb('db:area.create', 'area.create', AreaCreateInputSchema, AreaSchema)
  handleDb('db:area.update', 'area.update', AreaUpdateInputSchema, AreaSchema)
  handleDb('db:area.list', 'area.list', z.object({}), z.array(AreaSchema))
  handleDb('db:area.get', 'area.get', AreaDeleteInputSchema, AreaSchema)
  handleDb('db:area.getDetail', 'area.getDetail', AreaDeleteInputSchema, AreaDetailSchema)
  handleDb('db:area.delete', 'area.delete', AreaDeleteInputSchema, z.object({ deleted: z.boolean() }))
  handleDb('db:area.setTags', 'area.setTags', AreaSetTagsInputSchema, z.object({ updated: z.boolean() }))

  handleDb('db:sidebar.listModel', 'sidebar.listModel', SidebarListModelInputSchema, SidebarListModelSchema)
  handleDb('db:sidebar.reorderAreas', 'sidebar.reorderAreas', SidebarReorderAreasInputSchema, SidebarReorderResultSchema)
  handleDb(
    'db:sidebar.reorderProjects',
    'sidebar.reorderProjects',
    SidebarReorderProjectsInputSchema,
    SidebarReorderResultSchema
  )
  handleDb('db:sidebar.moveProject', 'sidebar.moveProject', SidebarMoveProjectInputSchema, SidebarMoveProjectResultSchema)

  handleDb('db:tag.create', 'tag.create', TagCreateInputSchema, TagSchema)
  handleDb('db:tag.update', 'tag.update', TagUpdateInputSchema, TagSchema)
  handleDb('db:tag.list', 'tag.list', z.object({}), z.array(TagSchema))
  handleDb('db:tag.delete', 'tag.delete', z.object({ id: z.string() }), z.object({ deleted: z.boolean() }))

  handleDb('db:checklist.listByTask', 'checklist.listByTask', z.object({ task_id: z.string() }), z.array(ChecklistItemSchema))
  handleDb('db:checklist.create', 'checklist.create', ChecklistItemCreateInputSchema, ChecklistItemSchema)
  handleDb('db:checklist.update', 'checklist.update', ChecklistItemUpdateInputSchema, ChecklistItemSchema)
  handleDb('db:checklist.delete', 'checklist.delete', ChecklistItemDeleteInputSchema, z.object({ deleted: z.boolean() }))
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow({ backgroundColor: getWindowBackgroundColor(getEffectiveThemeFromNative()) })
  }
})

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  app.whenReady().then(async () => {
    if (IS_SELF_TEST && SELF_TEST_USER_DATA_DIR) {
      // Ensure the userData directory exists before the DB worker opens the file.
      await fs.mkdir(SELF_TEST_USER_DATA_DIR, { recursive: true })
    }

    const dbPath = path.join(app.getPath('userData'), 'milesto.db')
    const workerScriptPath = path.join(__dirname, 'workers', 'db', 'db-worker.js')
    const dbWorker = new DbWorkerClient(workerScriptPath, dbPath)
    const syncBridge = createMainSyncBridge(dbWorker)
    const credentialsStore = new ElectronSyncCredentialsStore({
      persistence: {
        loadEncrypted: async () => await syncBridge.getEncryptedCredentials(),
        saveEncrypted: async (encryptedBlob) => {
          await syncBridge.saveEncryptedCredentials(encryptedBlob)
        },
        clearEncrypted: async () => {
          await syncBridge.clearEncryptedCredentials()
        },
      },
    })
    const syncService = new SyncService({
      db: syncBridge,
      credentialsStore,
      repositoryFactory: () => new S3SyncRepository(),
    })

    app.on('will-quit', () => {
      syncService.stop()
      void dbWorker.terminate()
    })

    const themeState = await resolveThemeState(dbWorker)

    const today = TaskRolloverScheduledToTodayInputSchema.parse({ today: formatLocalDate(new Date()) }).today
    const rolloverRes = await dbWorker.request('task.rolloverScheduledToToday', { today })
    if (!rolloverRes.ok) {
      const msg = `startup rollover failed: ${rolloverRes.error.code}: ${rolloverRes.error.message}`
      if (IS_SELF_TEST) {
        console.error('[MILESTO_SELF_TEST]', msg)
        app.exit(1)
        return
      }
      console.error('[milesto]', msg)
    } else {
      const parsed = TaskRolloverScheduledToTodayResultSchema.safeParse(rolloverRes.data)
      if (!parsed.success) {
        const msg = 'startup rollover returned invalid data'
        if (IS_SELF_TEST) {
          console.error('[MILESTO_SELF_TEST]', msg)
          app.exit(1)
          return
        }
        console.error('[milesto]', msg)
      }
    }

    await syncService.start()

    app.on('browser-window-focus', () => {
      syncService.setForegroundState(true)
    })
    app.on('browser-window-blur', () => {
      syncService.setForegroundState(false)
    })

    registerIpcHandlers(dbWorker, syncBridge, syncService, credentialsStore)
    installCspOnce()
    createWindow({ backgroundColor: getWindowBackgroundColor(themeState.effectiveTheme) })
  })
}
