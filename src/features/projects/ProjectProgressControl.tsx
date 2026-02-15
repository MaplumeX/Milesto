import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { Project } from '../../../shared/schemas/project'

type ProjectStatus = Project['status']

export function ProjectProgressControl({
  status,
  doneCount,
  totalCount,
  size,
  disabled,
  onActivate,
}: {
  status: ProjectStatus
  doneCount: number
  totalCount: number
  size?: 'list' | 'header'
  disabled?: boolean
  onActivate?: () => void | Promise<void>
}) {
  const { t } = useTranslation()

  const safeTotal = Math.max(0, Math.floor(totalCount))
  const safeDone = Math.max(0, Math.min(safeTotal, Math.floor(doneCount)))
  const openCount = Math.max(0, safeTotal - safeDone)

  const percent = useMemo(() => {
    if (status === 'done') return 100
    if (safeTotal <= 0) return 0
    return Math.round((safeDone / safeTotal) * 100)
  }, [safeDone, safeTotal, status])

  const progressKind = useMemo(() => {
    if (status === 'done') return 'done'
    if (safeTotal <= 0 || safeDone <= 0) return 'none'
    if (safeDone >= safeTotal) return 'full'
    return 'partial'
  }, [safeDone, safeTotal, status])

  const ariaLabel =
    status === 'done'
      ? t('aria.projectProgressDone')
      : t('aria.projectProgressOpen', {
          percent,
          doneCount: safeDone,
          totalCount: safeTotal,
          openCount,
        })

  const angleDeg = safeTotal > 0 ? (safeDone / safeTotal) * 360 : 0
  const style =
    progressKind === 'partial'
      ? ({ ['--ppc-angle' as never]: `${angleDeg}deg` } as React.CSSProperties)
      : undefined

  return (
    <button
      type="button"
      className={`project-progress-control${status === 'done' ? ' is-done' : ''}`}
      data-size={size ?? 'list'}
      data-progress={progressKind}
      aria-label={ariaLabel}
      disabled={disabled}
      style={style}
      onPointerDown={(e) => {
        e.stopPropagation()
      }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (disabled) return
        void onActivate?.()
      }}
    >
      {status === 'done' ? <CheckIcon /> : null}
    </button>
  )
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 10.5l3.1 3.1L15.7 6" />
    </svg>
  )
}
