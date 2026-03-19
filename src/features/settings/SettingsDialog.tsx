import { useEffect, useId, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { GeneralSettingsPanel } from './GeneralSettingsPanel'
import { SyncSettingsPanel } from './SyncSettingsPanel'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export type SettingsTabId = 'general' | 'sync'

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []

  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.getAttribute('aria-hidden') === 'true') return false
    if (element.tabIndex < 0) return false
    return element.offsetParent !== null || element === document.activeElement
  })
}

export function SettingsDialog({
  isOpen,
  activeTab,
  onClose,
  onTabChange,
}: {
  isOpen: boolean
  activeTab: SettingsTabId
  onClose: () => void
  onTabChange: (tab: SettingsTabId) => void
}) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const titleId = useId()
  const generalTabId = useId()
  const syncTabId = useId()

  const tabs = useMemo(
    () =>
      [
        { id: 'general' as const, label: t('settings.generalTab'), tabId: generalTabId },
        { id: 'sync' as const, label: t('settings.syncTab'), tabId: syncTabId },
      ] satisfies Array<{ id: SettingsTabId; label: string; tabId: string }>,
    [generalTabId, syncTabId, t]
  )

  useEffect(() => {
    if (!isOpen) return

    const handle = window.setTimeout(() => {
      closeButtonRef.current?.focus()
    }, 0)

    function focusFirstElement() {
      const focusable = getFocusableElements(dialogRef.current)
      ;(focusable[0] ?? dialogRef.current)?.focus()
    }

    function handleFocusIn(event: FocusEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (dialogRef.current?.contains(target)) return
      window.setTimeout(() => {
        focusFirstElement()
      }, 0)
    }

    document.addEventListener('focusin', handleFocusIn)
    return () => {
      window.clearTimeout(handle)
      document.removeEventListener('focusin', handleFocusIn)
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div
      className="settings-dialog-overlay"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        onClose()
      }}
    >
      <div
        ref={dialogRef}
        id="settings-dialog"
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-settings-dialog="true"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onClose()
            return
          }

          if (event.key !== 'Tab') return

          const focusable = getFocusableElements(dialogRef.current)
          if (focusable.length === 0) {
            event.preventDefault()
            dialogRef.current?.focus()
            return
          }

          const first = focusable[0]
          const last = focusable[focusable.length - 1]
          const active = document.activeElement instanceof HTMLElement ? document.activeElement : null

          if (event.shiftKey) {
            if (active === first || !active || !dialogRef.current?.contains(active)) {
              event.preventDefault()
              last?.focus()
            }
            return
          }

          if (active === last || !active || !dialogRef.current?.contains(active)) {
            event.preventDefault()
            first?.focus()
          }
        }}
      >
        <div className="settings-dialog-header">
          <div className="settings-dialog-heading">
            <h2 id={titleId} className="settings-dialog-title">
              {t('settings.title')}
            </h2>

            <div className="settings-dialog-tablist" role="tablist" aria-label={t('settings.title')}>
              {tabs.map((tab) => {
                const isSelected = tab.id === activeTab
                return (
                  <button
                    key={tab.id}
                    id={tab.tabId}
                    type="button"
                    role="tab"
                    className="settings-dialog-tab"
                    aria-selected={isSelected}
                    aria-controls={`settings-panel-${tab.id}`}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => onTabChange(tab.id)}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="settings-dialog-close"
            aria-label={t('common.close')}
            data-settings-dialog-close="true"
            onClick={onClose}
          >
            {t('common.close')}
          </button>
        </div>

        <div className="settings-dialog-body">
          {activeTab === 'general' ? (
            <div
              id="settings-panel-general"
              className="settings-dialog-panel"
              role="tabpanel"
              aria-labelledby={generalTabId}
            >
              <GeneralSettingsPanel />
            </div>
          ) : null}

          {activeTab === 'sync' ? (
            <div
              id="settings-panel-sync"
              className="settings-dialog-panel"
              role="tabpanel"
              aria-labelledby={syncTabId}
            >
              <SyncSettingsPanel />
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  )
}
