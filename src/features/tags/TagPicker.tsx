import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Check, Plus } from 'lucide-react'

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
  const [activeIndex, setActiveIndex] = useState(-1)
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
    setActiveIndex(-1)
  }, [query])

  // Scroll active item into view.
  useEffect(() => {
    if (activeIndex < 0) return
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
      setActiveIndex((prev) => Math.max(-1, prev - 1))
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (activeIndex < 0) return
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
      <div className="tag-picker-input-wrap">
        <Search className="tag-picker-input-icon" size={14} />
        <input
          ref={inputRef}
          className="tag-picker-input"
          placeholder={t('taskEditor.newTagPlaceholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (localCreateError) setLocalCreateError(null)
          }}
        />
      </div>

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
                <span className="tag-picker-title">{tag.title}</span>
                <span className="tag-picker-check" aria-hidden="true">
                  {isSelected ? <Check size={12} /> : null}
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
            <Plus className="tag-picker-create-icon" size={12} />
            <span className="tag-picker-create-label">
              {isCreating ? t('common.loading') : `${t('common.addTag')}「${query.trim()}」`}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
