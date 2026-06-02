import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { Settings, Cloud, type LucideIcon } from 'lucide-react'

import { GeneralSettingsPanel } from './GeneralSettingsPanel'
import { SyncSettingsPanel } from './SyncSettingsPanel'

type SettingsTab = 'general' | 'sync'

const SIDEBAR_ITEMS: { key: SettingsTab; Icon: LucideIcon }[] = [
  { key: 'general', Icon: Settings },
  { key: 'sync', Icon: Cloud },
]

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

const panelTransition = {
  initial: { opacity: 0, x: 8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
  transition: { duration: 0.15 },
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
  const tabPanelId = useId()
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

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
          <h2 id={titleId} className="settings-dialog-title">
            {t('settings.title')}
          </h2>

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
          <nav className="settings-sidebar" aria-label={t('settings.title')}>
            <div className="settings-sidebar-nav" role="tablist">
              {SIDEBAR_ITEMS.map(({ key, Icon }, index) => (
                <motion.button
                  key={key}
                  id={`settings-tab-${key}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === key}
                  aria-controls={tabPanelId}
                  data-active={activeTab === key}
                  className={`settings-sidebar-item${activeTab === key ? ' settings-sidebar-item--active' : ''}`}
                  onClick={() => setActiveTab(key)}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, delay: index * 0.05 }}
                >
                  <Icon size={16} strokeWidth={1.8} />
                  <span>{key === 'general' ? t('settings.generalTab') : t('settings.syncTab')}</span>
                </motion.button>
              ))}
            </div>
          </nav>

          <div className="settings-content" role="tabpanel" id={tabPanelId} aria-labelledby={`settings-tab-${activeTab}`}>
            <AnimatePresence mode="wait">
              {activeTab === 'general' ? (
                <motion.div key="general" {...panelTransition}>
                  <GeneralSettingsPanel />
                </motion.div>
              ) : (
                <motion.div key="sync" {...panelTransition}>
                  <SyncSettingsPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
