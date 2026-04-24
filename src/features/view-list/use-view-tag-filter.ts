import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Tag } from '../../../shared/schemas/tag'
import type { ViewListItem } from '../../../shared/schemas/view-list'

export function useViewTagFilter(items: ViewListItem[]) {
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  const loadTags = useCallback(async () => {
    const res = await window.api.tag.list()
    if (res.ok) {
      setAllTags(res.data)
    }
  }, [])

  useEffect(() => {
    void loadTags()
  }, [loadTags])

  useEffect(() => {
    setSelectedTagIds([])
  }, [items])

  const availableTags = useMemo(() => {
    const usedTagIds = new Set<string>()
    for (const item of items) {
      for (const tagId of item.tag_ids ?? []) {
        usedTagIds.add(tagId)
      }
    }
    return allTags.filter((tag) => usedTagIds.has(tag.id))
  }, [allTags, items])

  const filteredItems = useMemo(() => {
    if (selectedTagIds.length === 0) return items
    return items.filter((item) => {
      const itemTagIds = item.tag_ids ?? []
      return selectedTagIds.some((id) => itemTagIds.includes(id))
    })
  }, [items, selectedTagIds])

  return {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    filteredItems,
    hasFilter: selectedTagIds.length > 0,
  }
}
