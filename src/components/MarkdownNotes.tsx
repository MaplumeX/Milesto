import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'

export type MarkdownNotesProps = {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  onFocus?: () => void
  onBlur?: () => void
  rows?: number
  style?: React.CSSProperties
  id?: string
}

export function MarkdownNotes({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
  textareaRef,
  onFocus,
  onBlur,
  rows,
  style,
  id,
}: MarkdownNotesProps) {
  const [isEditing, setIsEditing] = useState(() => Boolean(autoFocus))
  const internalRef = useRef<HTMLTextAreaElement | null>(null)

  const setRef = (el: HTMLTextAreaElement | null) => {
    internalRef.current = el
    if (textareaRef) {
      const mutableRef = textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>
      mutableRef.current = el
    }
  }

  useEffect(() => {
    if (!isEditing) return
    const el = internalRef.current
    if (!el) return
    el.focus()
    if (autoFocus) {
      const pos = el.value.length
      el.setSelectionRange(pos, pos)
    }
  }, [isEditing, autoFocus])

  if (isEditing) {
    return (
      <textarea
        id={id}
        ref={setRef}
        className={className}
        style={style}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={() => {
          setIsEditing(false)
          onBlur?.()
        }}
        placeholder={placeholder}
      />
    )
  }

  if (!value.trim()) {
    return (
      <div
        id={id}
        className={className}
        style={{ ...style, cursor: 'text', color: 'var(--muted)' }}
        onClick={() => setIsEditing(true)}
      >
        {placeholder ?? ''}
      </div>
    )
  }

  return (
    <div
      id={id}
      className={`markdown-body${className ? ` ${className}` : ''}`}
      style={{ ...style, cursor: 'text' }}
      onClick={() => setIsEditing(true)}
    >
      <ReactMarkdown>{value}</ReactMarkdown>
    </div>
  )
}
