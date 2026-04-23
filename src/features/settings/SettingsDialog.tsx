import { useEffect, useId, useRef, useState } from 'react'
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
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const titleId = useId()
  const [activeTab, setActiveTab] = useState<'general' | 'sync'>('general')

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

        <div className="settings-dialog-tabs">
          <button
            type="button"
            className={`settings-dialog-tab ${activeTab === 'general' ? 'settings-dialog-tab--active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            {t('settings.generalTab')}
          </button>
          <button
            type="button"
            className={`settings-dialog-tab ${activeTab === 'sync' ? 'settings-dialog-tab--active' : ''}`}
            onClick={() => setActiveTab('sync')}
          >
            {t('settings.syncTab')}
          </button>
        </div>

        <div className="settings-dialog-body">
          <div className="settings-dialog-panel">
            {activeTab === 'general' ? <GeneralSettingsPanel /> : <SyncSettingsPanel />}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
