import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../components/Button'

type ConfirmDialogProps = {
  action: string
  summary: string
  onApprove: () => void
  onReject: () => void
}

export function ConfirmDialog({ action, summary, onApprove, onReject }: ConfirmDialogProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDivElement>(null)
  const approveButtonRef = useRef<HTMLButtonElement>(null)

  // Focus the approve button when dialog opens
  useEffect(() => {
    approveButtonRef.current?.focus()
  }, [])

  // Handle Escape key to reject
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onReject()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onReject])

  // Click outside to reject
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onReject()
    }
  }

  return (
    <div
      ref={dialogRef}
      className="chat-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-confirm-title"
      onClick={handleOverlayClick}
    >
      <div className="chat-confirm-dialog">
        <div className="chat-confirm-header" id="chat-confirm-title">
          {t('chat.confirmTitle')}
        </div>
        <div className="chat-confirm-body">
          <div className="chat-confirm-action">{action}</div>
          <div className="chat-confirm-summary">{summary}</div>
        </div>
        <div className="chat-confirm-actions">
          <Button variant="ghost" onClick={onReject}>
            {t('chat.confirmCancel')}
          </Button>
          <Button variant="danger" onClick={onApprove} ref={approveButtonRef}>
            {t('chat.confirmExecute')}
          </Button>
        </div>
      </div>
    </div>
  )
}
