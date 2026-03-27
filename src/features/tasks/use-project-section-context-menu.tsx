import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../../shared/app-error'
import type { EntityScope } from '../../../shared/schemas/common'
import type { Project, ProjectSection } from '../../../shared/schemas/project'

type ProjectSectionContextMenuView = 'root' | 'move'

type ProjectSectionContextMenuState = {
  section: ProjectSection
  projectId: string
  scope: EntityScope
  anchorX: number
  anchorY: number
  restoreFocusEl: HTMLElement | null
  view: ProjectSectionContextMenuView
}

type OpenProjectSectionContextMenuInput = {
  section: ProjectSection
  projectId: string
  scope?: EntityScope
  anchorX: number
  anchorY: number
  restoreFocusEl?: HTMLElement | null
}

function getMenuWidth(view: ProjectSectionContextMenuView): number {
  return view === 'root' ? 188 : 236
}

export function useProjectSectionContextMenu({
  scope = 'active',
  enabled = true,
  onMutate,
  onSectionRemoved,
}: {
  scope?: EntityScope
  enabled?: boolean
  onMutate: () => Promise<void>
  onSectionRemoved?: (sectionId: string) => void
}) {
  const { t } = useTranslation()
  const [menuState, setMenuState] = useState<ProjectSectionContextMenuState | null>(null)
  const [actionError, setActionError] = useState<AppError | null>(null)
  const [moveTargets, setMoveTargets] = useState<Project[]>([])
  const [moveTargetsError, setMoveTargetsError] = useState<AppError | null>(null)
  const [moveTargetsLoading, setMoveTargetsLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const closeMenu = useCallback((opts?: { restoreFocus?: boolean }) => {
    const current = menuState
    setMenuState(null)
    setActionError(null)
    setMoveTargets([])
    setMoveTargetsError(null)
    setMoveTargetsLoading(false)

    if (!current || !opts?.restoreFocus) return

    window.setTimeout(() => {
      if (current.restoreFocusEl?.isConnected) current.restoreFocusEl.focus()
    }, 0)
  }, [menuState])

  const openProjectSectionContextMenu = useCallback(
    ({
      section,
      projectId,
      scope: nextScope,
      anchorX,
      anchorY,
      restoreFocusEl = null,
    }: OpenProjectSectionContextMenuInput) => {
      if (!enabled) return

      setActionError(null)
      setMoveTargets([])
      setMoveTargetsError(null)
      setMoveTargetsLoading(false)
      setMenuState({
        section,
        projectId,
        scope: nextScope ?? scope,
        anchorX,
        anchorY,
        restoreFocusEl,
        view: 'root',
      })
    },
    [enabled, scope]
  )

  useEffect(() => {
    if (!menuState) return

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) return
      if (!(event.target instanceof Node)) return
      if (menuRef.current?.contains(event.target)) return
      closeMenu({ restoreFocus: true })
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      closeMenu({ restoreFocus: true })
    }

    function handleClose() {
      closeMenu({ restoreFocus: false })
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('resize', handleClose)
    window.addEventListener('scroll', handleClose, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('resize', handleClose)
      window.removeEventListener('scroll', handleClose, true)
    }
  }, [closeMenu, menuState])

  useEffect(() => {
    if (!menuState || menuState.view !== 'move') return

    let cancelled = false
    setMoveTargetsLoading(true)
    setMoveTargetsError(null)

    void (async () => {
      const res = await window.api.project.listOpen()
      if (cancelled) return
      if (!res.ok) {
        setMoveTargetsError(res.error)
        setMoveTargetsLoading(false)
        return
      }

      setMoveTargets(res.data)
      setMoveTargetsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [menuState])

  async function handleDeleteSection() {
    if (!menuState) return

    setActionError(null)
    const confirmed = confirm(t('section.deleteConfirm'))
    if (!confirmed) return

    const res = await window.api.project.deleteSection(menuState.section.id)
    if (!res.ok) {
      setActionError(res.error)
      return
    }

    onSectionRemoved?.(menuState.section.id)
    await onMutate()
    closeMenu({ restoreFocus: false })
  }

  async function handleMoveSection(targetProjectId: string) {
    if (!menuState) return

    setActionError(null)
    if (targetProjectId === menuState.section.project_id) {
      closeMenu({ restoreFocus: true })
      return
    }

    const res = await window.api.project.moveSection(menuState.section.id, targetProjectId)
    if (!res.ok) {
      setActionError(res.error)
      return
    }

    if (!res.data.moved) {
      closeMenu({ restoreFocus: true })
      return
    }

    onSectionRemoved?.(menuState.section.id)
    await onMutate()
    closeMenu({ restoreFocus: false })
  }

  const menuNode = useMemo(() => {
    if (!menuState) return null

    const viewportPadding = 12
    const width = getMenuWidth(menuState.view)
    const left = Math.min(
      Math.max(viewportPadding, menuState.anchorX),
      window.innerWidth - width - viewportPadding
    )
    const top = Math.min(
      Math.max(viewportPadding, menuState.anchorY),
      window.innerHeight - viewportPadding
    )

    return createPortal(
      <div
        ref={menuRef}
        className="task-inline-popover"
        role="dialog"
        aria-label={t('aria.sectionActions')}
        style={{
          position: 'fixed',
          top,
          left,
          width,
          zIndex: 60,
        }}
      >
        <div className="task-inline-popover-body">
          {menuState.view === 'root' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button
                type="button"
                className="task-inline-popover-item"
                onClick={() => {
                  setActionError(null)
                  setMoveTargetsError(null)
                  setMenuState((current) => (current ? { ...current, view: 'move' } : current))
                }}
              >
                {t('common.move')}
              </button>
              <button
                type="button"
                className="task-inline-popover-item"
                onClick={() => {
                  void handleDeleteSection()
                }}
              >
                {t('common.delete')}
              </button>
            </div>
          ) : (
            <>
              <div className="row" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => {
                    setActionError(null)
                    setMenuState((current) => (current ? { ...current, view: 'root' } : current))
                  }}
                >
                  {t('common.back')}
                </button>
                <div className="task-inline-popover-title">{t('common.move')}</div>
              </div>

              {moveTargetsLoading ? <div style={{ marginTop: 8 }}>{t('common.loading')}</div> : null}

              {moveTargetsError ? (
                <div className="error" style={{ margin: '10px 0 0' }}>
                  <div className="error-code">{moveTargetsError.code}</div>
                  <div>{moveTargetsError.message}</div>
                </div>
              ) : null}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
                {moveTargets.map((project) => {
                  const isCurrent = project.id === menuState.section.project_id
                  const label = project.title.trim() ? project.title : t('project.untitled')
                  return (
                    <button
                      key={project.id}
                      type="button"
                      className={`task-inline-popover-item${isCurrent ? ' is-selected' : ''}`}
                      aria-pressed={isCurrent}
                      onClick={() => {
                        void handleMoveSection(project.id)
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {actionError ? (
            <div className="error" style={{ margin: '10px 0 0' }}>
              <div className="error-code">{actionError.code}</div>
              <div>{actionError.message}</div>
            </div>
          ) : null}
        </div>
      </div>,
      document.body
    )
  }, [actionError, handleDeleteSection, menuState, moveTargets, moveTargetsError, moveTargetsLoading, t])

  return { openProjectSectionContextMenu, closeMenu, menuNode }
}
