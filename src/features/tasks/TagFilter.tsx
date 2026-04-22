import { useTranslation } from 'react-i18next'

import type { Tag } from '../../../shared/schemas/tag'

export function TagFilter({
  tags,
  selectedTagIds,
  onChange,
}: {
  tags: Tag[]
  selectedTagIds: string[]
  onChange: (selectedTagIds: string[]) => void
}) {
  const { t } = useTranslation()

  if (tags.length === 0) return null

  const handleTagClick = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId))
    } else {
      onChange([...selectedTagIds, tagId])
    }
  }

  const handleClear = () => {
    onChange([])
  }

  const hasSelection = selectedTagIds.length > 0

  return (
    <div className="tag-filter">
      <button
        type="button"
        className={`tag-filter-pill${!hasSelection ? ' is-active' : ''}`}
        onClick={handleClear}
      >
        {t('common.all')}
      </button>
      {tags.map((tag) => {
        const isActive = selectedTagIds.includes(tag.id)
        return (
          <button
            key={tag.id}
            type="button"
            className={`tag-filter-pill${isActive ? ' is-active' : ''}`}
            onClick={() => handleTagClick(tag.id)}
          >
            {tag.color ? (
              <span
                className="tag-filter-swatch"
                style={{ backgroundColor: tag.color }}
              />
            ) : null}
            <span>{tag.title}</span>
          </button>
        )
      })}
    </div>
  )
}
