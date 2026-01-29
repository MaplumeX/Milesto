import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'

import { z } from 'zod'

import type { AppError } from '../shared/app-error'
import { err, ok, resultSchema } from '../shared/result'

import { DbWorkerClient } from './workers/db/db-worker-client'

import {
  DataExportSchema,
  ProjectCreateInputSchema,
  ProjectIdInputSchema,
  ProjectSchema,
  ProjectSectionCreateInputSchema,
  ProjectSectionDeleteInputSchema,
  ProjectSectionSchema,
  ProjectSectionRenameInputSchema,
  ProjectUpdateInputSchema,
  TagCreateInputSchema,
  TagSchema,
  TagUpdateInputSchema,
  TaskCreateInputSchema,
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
  TaskListBaseInputSchema,
  TaskListItemSchema,
  TaskListLogbookInputSchema,
  TaskListProjectInputSchema,
  TaskListTodayInputSchema,
  TaskListUpcomingInputSchema,
  AreaCreateInputSchema,
  AreaSchema,
  AreaUpdateInputSchema,
  AreaDeleteInputSchema,
  ChecklistItemCreateInputSchema,
  ChecklistItemSchema,
  ChecklistItemUpdateInputSchema,
  ChecklistItemDeleteInputSchema,
} from '../shared/schemas'

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

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function registerIpcHandlers(dbWorker: DbWorkerClient) {
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

    // Placeholder until DB worker is wired. Still provides a safe flow and does not expose raw fs.
    const result = await dialog.showSaveDialog({
      title: 'Export Milesto Data',
      defaultPath: path.join(app.getPath('downloads'), `milesto-export-${Date.now()}.json`),
      filters: [{ name: 'JSON', extensions: ['json'] }],
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

    const result = await dialog.showOpenDialog({
      title: 'Import Milesto Data',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
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

  // DB IPC (Renderer -> Main -> DB Worker)
  handleDb('db:task.create', 'task.create', TaskCreateInputSchema, TaskSchema)
  handleDb('db:task.update', 'task.update', TaskUpdateInputSchema, TaskSchema)
  handleDb('db:task.toggleDone', 'task.toggleDone', TaskToggleDoneInputSchema, TaskSchema)
  handleDb('db:task.restore', 'task.restore', TaskRestoreInputSchema, TaskSchema)
  handleDb('db:task.getDetail', 'task.getDetail', TaskIdInputSchema, TaskDetailSchema)

  handleDb('db:task.listBase', 'task.listBase', TaskListBaseInputSchema, z.array(TaskListItemSchema))
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
  handleDb('db:project.update', 'project.update', ProjectUpdateInputSchema, ProjectSchema)
  handleDb('db:project.listOpen', 'project.listOpen', z.object({}), z.array(ProjectSchema))
  handleDb('db:project.listDone', 'project.listDone', z.object({}), z.array(ProjectSchema))
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

  handleDb('db:area.create', 'area.create', AreaCreateInputSchema, AreaSchema)
  handleDb('db:area.update', 'area.update', AreaUpdateInputSchema, AreaSchema)
  handleDb('db:area.list', 'area.list', z.object({}), z.array(AreaSchema))
  handleDb('db:area.get', 'area.get', AreaDeleteInputSchema, AreaSchema)
  handleDb('db:area.delete', 'area.delete', AreaDeleteInputSchema, z.object({ deleted: z.boolean() }))

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
    createWindow()
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

  app.whenReady().then(() => {
    const dbPath = path.join(app.getPath('userData'), 'milesto.db')
    const workerScriptPath = path.join(__dirname, 'workers', 'db', 'db-worker.js')
    const dbWorker = new DbWorkerClient(workerScriptPath, dbPath)

    app.on('will-quit', () => {
      void dbWorker.terminate()
    })

    registerIpcHandlers(dbWorker)
    installCspOnce()
    createWindow()
  })
}
