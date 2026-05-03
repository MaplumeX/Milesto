import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../components/Button'

type ChatComposerProps = {
  onSend: (content: string) => void
  isLoading: boolean
  onAbort: () => void
  disabled?: boolean
  disabledHint?: string
}

export function ChatComposer({ onSend, isLoading, onAbort, disabled, disabledHint }: ChatComposerProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isLoading || disabled) return
    onSend(trimmed)
    setValue('')
    // Reset textarea height
    const el = textareaRef.current
    if (el) el.style.height = 'auto'
  }, [value, isLoading, disabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    // Auto-resize
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

  return (
    <div className="chat-composer">
      {disabled ? (
        <div className="chat-composer-disabled">{disabledHint || t('chat.errorDisabled')}</div>
      ) : (
        <>
          <textarea
            ref={textareaRef}
            className="chat-composer-input"
            placeholder={t('chat.placeholder')}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
          />
          {isLoading ? (
            <Button variant="ghost" onClick={onAbort} aria-label={t('chat.stop')}>
              <span className="chat-composer-stop-icon" aria-hidden="true" />
              {t('chat.stop')}
            </Button>
          ) : (
            <Button disabled={!value.trim()} onClick={handleSend} aria-label={t('chat.send')}>
              {t('chat.send')}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
