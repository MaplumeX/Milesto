import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const cachedProjectTitleById = new Map<string, string | null>()
const pendingProjectTitleById = new Map<string, Promise<string | null>>()

async function loadProjectTitle(projectId: string): Promise<string | null> {
  const cached = cachedProjectTitleById.get(projectId)
  if (cached !== undefined) return cached

  const pending = pendingProjectTitleById.get(projectId)
  if (pending) return pending

  const request = (async () => {
    const res = await window.api.project.get(projectId)
    if (!res.ok) return null
    const title = res.data.title ?? null
    cachedProjectTitleById.set(projectId, title)
    return title
  })()

  pendingProjectTitleById.set(projectId, request)

  try {
    return await request
  } finally {
    pendingProjectTitleById.delete(projectId)
  }
}

export function TaskProjectAffiliation({
  projectId,
  projectTitle,
  overrideLabel,
}: {
  projectId: string | null
  projectTitle?: string | null
  overrideLabel?: string | null
}) {
  const { t } = useTranslation()
  const trimmedOverrideLabel = overrideLabel?.trim() || null
  const trimmedPropTitle = projectTitle?.trim()
  const [resolvedTitle, setResolvedTitle] = useState<string | null>(trimmedPropTitle ?? null)

  useEffect(() => {
    if (trimmedOverrideLabel) return

    if (!projectId) {
      setResolvedTitle(null)
      return
    }

    if (trimmedPropTitle && trimmedPropTitle.length > 0) {
      cachedProjectTitleById.set(projectId, trimmedPropTitle)
      setResolvedTitle(trimmedPropTitle)
      return
    }

    const cached = cachedProjectTitleById.get(projectId)
    if (cached !== undefined) {
      setResolvedTitle(cached?.trim() ? cached.trim() : null)
      return
    }

    let cancelled = false

    void (async () => {
      const title = await loadProjectTitle(projectId)
      if (cancelled) return
      setResolvedTitle(title?.trim() ? title.trim() : null)
    })()

    return () => {
      cancelled = true
    }
  }, [projectId, trimmedOverrideLabel, trimmedPropTitle])

  if (trimmedOverrideLabel) {
    return <span className="task-project-affiliation">{trimmedOverrideLabel}</span>
  }

  if (!projectId) return null

  const label = resolvedTitle && resolvedTitle.length > 0 ? resolvedTitle : t('project.untitled')

  return <span className="task-project-affiliation">{label}</span>
}
