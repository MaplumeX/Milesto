import { useCallback, useRef } from 'react'

import { TaskEditorPaper, type TaskEditorPaperHandle } from './TaskEditorPaper'

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',')

  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
  )
}

export function TaskEditorOverlayPaper({
  taskId,
  onClose,
}: {
  taskId: string
  onClose: () => void
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<TaskEditorPaperHandle | null>(null)
  const isClosingRef = useRef(false)

  const attemptClose = useCallback(async () => {
    if (isClosingRef.current) return
    isClosingRef.current = true
    try {
      const ok = (await editorRef.current?.flushPendingChanges()) ?? true
      if (!ok) {
        editorRef.current?.focusTitle()
        return
      }
      onClose()
    } finally {
      isClosingRef.current = false
    }
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      className="overlay-paper-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Task editor"
      tabIndex={-1}
      onKeyDownCapture={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          void attemptClose()
          return
        }

        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          e.stopPropagation()
          void attemptClose()
          return
        }

        if (e.key !== 'Tab') return
        const root = overlayRef.current
        if (!root) return

        const focusable = getFocusableElements(root)
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement

        if (e.shiftKey) {
          if (active === first) {
            e.preventDefault()
            last.focus()
          }
          return
        }

        if (active === last) {
          e.preventDefault()
          first.focus()
        }
      }}
    >
      <div className="overlay-paper-scrim" />

      <div className="overlay-paper-scroll">
        <TaskEditorPaper ref={editorRef} taskId={taskId} onRequestClose={() => void attemptClose()} />
      </div>
    </div>
  )
}
