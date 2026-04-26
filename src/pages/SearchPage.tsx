import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import type { AppError } from '../../shared/app-error'
import type {
  TaskSearchResultItem,
  ProjectSearchResultItem,
  AreaSearchResultItem,
  TaskSearchScope,
} from '../../shared/schemas/search'
import { isClosedTaskStatus } from '../../shared/schemas/common'
import { getLocalToday } from '../lib/use-local-today'

const SCOPES: TaskSearchScope[] = [
  'anywhere',
  'inbox',
  'today',
  'upcoming',
  'anytime',
  'someday',
  'logbook',
  'trash',
]

type SearchResultItem =
  | { kind: 'task'; data: TaskSearchResultItem }
  | { kind: 'project'; data: ProjectSearchResultItem }
  | { kind: 'area'; data: AreaSearchResultItem }

export function SearchPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const query = searchParams.get('q') ?? ''
  const scope = (searchParams.get('scope') as TaskSearchScope | null) ?? 'anywhere'

  const [draftQuery, setDraftQuery] = useState(query)
  const [taskResults, setTaskResults] = useState<TaskSearchResultItem[]>([])
  const [projectResults, setProjectResults] = useState<ProjectSearchResultItem[]>([])
  const [areaResults, setAreaResults] = useState<AreaSearchResultItem[]>([])
  const [error, setError] = useState<AppError | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const today = getLocalToday()

  useEffect(() => {
    setDraftQuery(query)
  }, [query])

  useEffect(() => {
    if (!query) {
      setTaskResults([])
      setProjectResults([])
      setAreaResults([])
      return
    }

    setIsLoading(true)
    setError(null)

    void (async () => {
      const options: { includeLogbook?: boolean; scope?: TaskSearchScope; date?: string } =
        {}
      if (scope !== 'anywhere') {
        options.scope = scope
        if (scope === 'today' || scope === 'upcoming') {
          options.date = today
        }
      }

      const [taskRes, projectRes, areaRes] = await Promise.all([
        window.api.task.search(query, options),
        window.api.project.search(query),
        window.api.area.search(query),
      ])

      setIsLoading(false)

      if (!taskRes.ok) {
        setError(taskRes.error)
        setTaskResults([])
      } else {
        setTaskResults(taskRes.data)
      }

      if (!projectRes.ok) {
        setProjectResults([])
      } else {
        setProjectResults(projectRes.data)
      }

      if (!areaRes.ok) {
        setAreaResults([])
      } else {
        setAreaResults(areaRes.data)
      }
    })()
  }, [query, scope, today])

  function handleScopeChange(nextScope: TaskSearchScope) {
    setSearchParams({ q: query, scope: nextScope })
  }

  function jumpToTask(item: TaskSearchResultItem) {
    const todayNow = getLocalToday()
    const to = (() => {
      if (isClosedTaskStatus(item.status)) return '/logbook'
      if (item.scheduled_at === todayNow) return '/today'
      if (item.scheduled_at && item.scheduled_at > todayNow) return '/upcoming'
      if (item.project_id) return `/projects/${item.project_id}`
      if (item.is_inbox) return '/inbox'
      if (item.is_someday) return '/someday'
      return '/anytime'
    })()
    navigate(to)
  }

  const allResults: SearchResultItem[] = [
    ...taskResults.map((r) => ({ kind: 'task' as const, data: r })),
    ...projectResults.map((r) => ({ kind: 'project' as const, data: r })),
    ...areaResults.map((r) => ({ kind: 'area' as const, data: r })),
  ]

  useEffect(() => {
    const trimmed = draftQuery.trim()
    if (trimmed === query) return

    const handle = window.setTimeout(() => {
      setSearchParams({ q: trimmed, scope })
    }, 200)

    return () => window.clearTimeout(handle)
  }, [draftQuery, scope, query, setSearchParams])

  const resultCount = allResults.length

  return (
    <div className="search-page">
      <div className="search-page-header">
        <input
          ref={inputRef}
          className="input search-page-input"
          placeholder={t('search.placeholder')}
          value={draftQuery}
          onChange={(e) => setDraftQuery(e.target.value)}
          autoFocus
        />

        <div className="search-scope-bar" role="radiogroup" aria-label={t('search.scope')}>
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scope === s}
              className={`search-scope-pill${scope === s ? ' is-active' : ''}`}
              onClick={() => handleScopeChange(s)}
            >
              {t(`search.scope.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {error ? <ErrorBanner error={error} /> : null}

      {isLoading ? (
        <div className="search-page-loading">{t('common.loading')}</div>
      ) : (
        <>
          {query && (
            <div className="search-page-count">
              {t('search.resultCount', { count: resultCount })}
            </div>
          )}

          <div className="search-page-list" role="listbox" aria-label={t('search.results')}>
            {allResults.map((item) => (
              <SearchResultRow
                key={`${item.kind}-${item.data.id}`}
                item={item}
                onClick={() => {
                  if (item.kind === 'task') {
                    jumpToTask(item.data)
                  } else if (item.kind === 'project') {
                    navigate(`/projects/${item.data.id}`)
                  } else {
                    navigate(`/areas/${item.data.id}`)
                  }
                }}
              />
            ))}
          </div>

          {!isLoading && query && allResults.length === 0 && !error && (
            <div className="search-page-empty">{t('search.noResults')}</div>
          )}
        </>
      )}
    </div>
  )
}

function SearchResultRow({
  item,
  onClick,
}: {
  item: SearchResultItem
  onClick: () => void
}) {
  const { t } = useTranslation()

  const title = (() => {
    if (item.kind === 'task') {
      return item.data.title.trim() ? item.data.title : t('task.untitled')
    }
    if (item.kind === 'project') {
      return item.data.title.trim() ? item.data.title : t('project.untitled')
    }
    return item.data.title.trim() ? item.data.title : t('area.untitled')
  })()

  const hint = (() => {
    if (item.kind === 'task') {
      const data = item.data
      if (data.snippet) return data.snippet
      if (data.is_someday) return t('nav.someday')
      if (data.scheduled_at) {
        const today = getLocalToday()
        return data.scheduled_at === today ? t('nav.today') : data.scheduled_at
      }
      if (data.is_inbox) return t('nav.inbox')
      if (data.project_id) return t('shell.project')
      return t('nav.anytime')
    }
    if (item.kind === 'project') return t('shell.project')
    return t('shell.area')
  })()

  const kindLabel = item.kind === 'task' ? t('shell.task') : item.kind === 'project' ? t('shell.project') : t('shell.area')

  return (
    <div
      className="search-result-row"
      role="option"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div className="search-result-kind">{kindLabel}</div>
      <div className="search-result-title">{title}</div>
      <div className="search-result-hint">{hint}</div>
    </div>
  )
}

function ErrorBanner({ error }: { error: AppError }) {
  return (
    <div className="error">
      <div className="error-code">{error.code}</div>
      <div>{error.message}</div>
    </div>
  )
}
