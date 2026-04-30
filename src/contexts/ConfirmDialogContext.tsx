import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

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

type ConfirmOptions = {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
}

type ConfirmRequest = ConfirmOptions & {
  id: number
  resolve: (value: boolean) => void
}

type ConfirmDialogContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null)

let nextId = 1

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ConfirmRequest[]>([])
  const queueRef = useRef(queue)
  queueRef.current = queue

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    const selfTestWindow = window as Window & { __milestoAutoConfirm?: boolean }
    if (selfTestWindow.__milestoAutoConfirm) {
      return Promise.resolve(true)
    }
    const id = nextId++
    return new Promise((resolve) => {
      const request: ConfirmRequest = { ...options, id, resolve }
      setQueue((prev) => [...prev, request])
    })
  }, [])

  const current = queue[0] ?? null

  const handleResolve = useCallback((value: boolean) => {
    const req = queueRef.current[0]
    if (req) {
      req.resolve(value)
    }
    setQueue((prev) => prev.slice(1))
  }, [])

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      {current ? (
        <ConfirmDialog
          key={current.id}
          isOpen
          title={current.title}
          message={current.message}
          confirmText={current.confirmText}
          cancelText={current.cancelText}
          variant={current.variant}
          onConfirm={() => handleResolve(true)}
          onCancel={() => handleResolve(false)}
        />
      ) : null}
    </ConfirmDialogContext.Provider>
  )
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmDialogContext)
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmDialogProvider')
  }
  return ctx.confirm
}

function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'default',
  onConfirm,
  onCancel,
}: {
  isOpen: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) return
    const handle = window.setTimeout(() => {
      confirmButtonRef.current?.focus()
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
      className="confirm-dialog-overlay"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        onCancel()
      }}
    >
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onCancel()
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
        <div className="confirm-dialog-message">
          {title ? (
            <div id={titleId} className="confirm-dialog-title">
              {title}
            </div>
          ) : null}
          <div className="confirm-dialog-body">{message}</div>
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" className="button button-ghost" onClick={onCancel}>
            {cancelText ?? t('shell.cancel')}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className={`button${variant === 'danger' ? ' button-danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmText ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
