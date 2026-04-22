import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../../shared/app-error'
import type { Tag } from '../../../shared/schemas/tag'

export type TagPickerCreateResult =
  | { ok: true; tag: Tag }
  | { ok: false; error: AppError }

export type TagPickerProps = {
  tags: Tag[]
  selectedTagIds: string[]
  onToggle: (tagId: string, selected: boolean) => void
  onCreate: (title: string) => Promise<TagPickerCreateResult>
  onRefresh?: () => void
  createError?: AppError | null
  persistError?: AppError | null
}

function normalizeTagTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function TagPicker({
  tags,
  selectedTagIds,
  onToggle,
  onCreate,
  onRefresh,
  createError: externalCreateError,
  persistError: externalPersistError,
}: TagPickerProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Map<number, HTMLButtonElement | null>>(new Map())

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const [localCreateError, setLocalCreateError] = useState<AppError | null>(null)

  const selectedSet = useMemo(() => new Set(selectedTagIds), [selectedTagIds])

  const filteredTags = useMemo(() => {
    if (!query.trim()) return tags
    const normalized = normalizeTagTitle(query)
    return tags.filter((tag) => normalizeTagTitle(tag.title).includes(normalized))
  }, [tags, query])

  const showCreateOption = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) return false
    const normalized = normalizeTagTitle(trimmed)
    return !tags.some((tag) => normalizeTagTitle(tag.title) === normalized)
  }, [query, tags])

  const itemCount = filteredTags.length + (showCreateOption ? 1 : 0)

  // Reset active index when filter changes.
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Scroll active item into view.
  useEffect(() => {
    const el = itemRefs.current.get(activeIndex)
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Let IME composition finish before handling Enter.
    if (e.nativeEvent.isComposing) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      setActiveIndex((prev) => Math.min(itemCount - 1, prev + 1))
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      setActiveIndex((prev) => Math.max(0, prev - 1))
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (activeIndex < filteredTags.length) {
        const tag = filteredTags[activeIndex]
        if (tag) {
          onToggle(tag.id, !selectedSet.has(tag.id))
        }
      } else if (showCreateOption) {
        void handleCreate()
      }
      return
    }
  }

  const handleCreate = useCallback(async () => {
    const title = query.trim()
    if (!title || isCreating) return

    setIsCreating(true)
    setLocalCreateError(null)

    const res = await onCreate(title)
    setIsCreating(false)

    if (!res.ok) {
      setLocalCreateError(res.error)
      return
    }

    setQuery('')
    onToggle(res.tag.id, true)
    onRefresh?.()
  }, [query, isCreating, onCreate, onToggle, onRefresh])

  const createError = externalCreateError ?? localCreateError
  const persistError = externalPersistError

  const setItemRef = useCallback((index: number) => {
    return (el: HTMLButtonElement | null) => {
      itemRefs.current.set(index, el)
    }
  }, [])

  return (
    <div className="tag-picker" onKeyDown={handleKeyDown}>
      <input
        ref={inputRef}
        className="input tag-picker-input"
        placeholder={t('taskEditor.newTagPlaceholder')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (localCreateError) setLocalCreateError(null)
        }}
      />

      {createError ? (
        <div className="error" style={{ margin: '8px 0 0' }}>
          <div className="error-code">{createError.code}</div>
          <div>{createError.message}</div>
        </div>
      ) : null}

      {persistError ? (
        <div className="error" style={{ margin: '8px 0 0' }}>
          <div className="error-code">{persistError.code}</div>
          <div>{persistError.message}</div>
        </div>
      ) : null}

      <div ref={listRef} className="tag-picker-list" role="listbox" aria-label={t('taskEditor.tagsLabel')}>
        {filteredTags.map((tag, index) => {
          const isSelected = selectedSet.has(tag.id)
          const isActive = activeIndex === index

          return (
            <div
              key={tag.id}
              className={`tag-picker-item${isActive ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
              role="option"
              aria-selected={isSelected}
            >
              <button
                ref={setItemRef(index)}
                type="button"
                className="tag-picker-row"
                onClick={() => onToggle(tag.id, !isSelected)}
              >
                <span
                  className="tag-picker-swatch"
                  style={{ background: tag.color ?? 'transparent' }}
                  aria-hidden="true"
                />
                <span className="tag-picker-title">{tag.title}</span>
                <span className="tag-picker-check" aria-hidden="true">
                  {isSelected ? (
                    <svg viewBox="0 0 12 10" fill="none" width="12" height="10">
                      <path
                        d="M1 5L4.25 8.25L11 1.5"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
              </button>
            </div>
          )
        })}

        {showCreateOption ? (
          <button
            ref={setItemRef(filteredTags.length)}
            type="button"
            className={`tag-picker-create${activeIndex === filteredTags.length ? ' is-active' : ''}`}
            onClick={() => void handleCreate()}
            disabled={isCreating}
          >
            <span className="tag-picker-create-label">
              {isCreating ? t('common.loading') : `${t('common.addTag')} 「${query.trim()}」`}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
