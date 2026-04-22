import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Tag } from '../../../shared/schemas/tag'
import type { TaskListItem } from '../../../shared/schemas/task-list'

export function useTaskTagFilter(tasks: TaskListItem[]) {
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

  // Reset selection when tasks change to avoid stale filters.
  useEffect(() => {
    setSelectedTagIds([])
  }, [tasks])

  const availableTags = useMemo(() => {
    const usedTagIds = new Set<string>()
    for (const task of tasks) {
      for (const tagId of task.tag_ids ?? []) {
        usedTagIds.add(tagId)
      }
    }
    return allTags.filter((tag) => usedTagIds.has(tag.id))
  }, [allTags, tasks])

  const filteredTasks = useMemo(() => {
    if (selectedTagIds.length === 0) return tasks
    return tasks.filter((task) => {
      const taskTagIds = task.tag_ids ?? []
      return selectedTagIds.some((id) => taskTagIds.includes(id))
    })
  }, [tasks, selectedTagIds])

  const hasFilter = selectedTagIds.length > 0

  return {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    filteredTasks,
    hasFilter,
  }
}
