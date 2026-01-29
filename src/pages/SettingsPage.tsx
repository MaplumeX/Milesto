import { useEffect, useState } from 'react'

import type { AppError } from '../../shared/app-error'

export function SettingsPage() {
  const [version, setVersion] = useState<string>('')
  const [userDataPath, setUserDataPath] = useState<string>('')
  const [error, setError] = useState<AppError | null>(null)
  const [lastExportPath, setLastExportPath] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const [verRes, pathRes] = await Promise.all([
        window.api.app.getVersion(),
        window.api.app.getUserDataPath(),
      ])
      if (!verRes.ok) {
        setError(verRes.error)
        return
      }
      if (!pathRes.ok) {
        setError(pathRes.error)
        return
      }
      setError(null)
      setVersion(verRes.data)
      setUserDataPath(pathRes.data)
    })()
  }, [])

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
      </header>

      {error ? (
        <div className="error">
          <div className="error-code">{error.code}</div>
          <div>{error.message}</div>
        </div>
      ) : null}

      <div className="settings-grid">
        <section className="card">
          <h2 className="card-title">Data</h2>
          <div className="row">
            <button
              type="button"
              className="button"
              onClick={() => {
                void (async () => {
                  const res = await window.api.data.exportToFile()
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  if (res.data.canceled) return
                  if (res.data.filePath) setLastExportPath(res.data.filePath)
                })()
              }}
            >
              Export…
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                void (async () => {
                  const res = await window.api.data.importFromFile()
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                })()
              }}
            >
              Import…
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                const confirmed = confirm('Reset all local data?')
                if (!confirmed) return
                void (async () => {
                  const res = await window.api.data.resetAllData()
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                })()
              }}
            >
              Reset All Data
            </button>
          </div>

          {lastExportPath ? (
            <div className="row">
              <div className="mono">{lastExportPath}</div>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  void window.api.app.showItemInFolder(lastExportPath)
                }}
              >
                Show In Folder
              </button>
            </div>
          ) : null}
        </section>

        <section className="card">
          <h2 className="card-title">About</h2>
          <div className="row">
            <div>Version</div>
            <div className="mono">{version}</div>
          </div>
          <div className="row">
            <div>User data</div>
            <div className="mono">{userDataPath}</div>
          </div>
          <div className="row">
            <div>Shortcuts</div>
            <div className="mono">Cmd/Ctrl+K (Command Palette)</div>
          </div>
          <div className="row">
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                void window.api.app.openPath(userDataPath)
              }}
            >
              Open Data Folder
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
