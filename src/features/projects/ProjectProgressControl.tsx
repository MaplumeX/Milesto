import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import type { Project } from '../../../shared/schemas/project'

type ProjectStatus = Project['status']

type ProgressKind = 'done' | 'none' | 'full' | 'partial'

function getProgressModel(params: {
  status: ProjectStatus
  doneCount: number
  totalCount: number
}): {
  safeTotal: number
  safeDone: number
  openCount: number
  percent: number
  progressKind: ProgressKind
  style: CSSProperties | undefined
} {
  const safeTotal = Math.max(0, Math.floor(params.totalCount))
  const safeDone = Math.max(0, Math.min(safeTotal, Math.floor(params.doneCount)))
  const openCount = Math.max(0, safeTotal - safeDone)

  const percent =
    params.status === 'done'
      ? 100
      : safeTotal <= 0
        ? 0
        : Math.round((safeDone / safeTotal) * 100)

  const progressKind: ProgressKind =
    params.status === 'done'
      ? 'done'
      : safeTotal <= 0 || safeDone <= 0
        ? 'none'
        : safeDone >= safeTotal
          ? 'full'
          : 'partial'

  const angleDeg = safeTotal > 0 ? (safeDone / safeTotal) * 360 : 0
  const style =
    progressKind === 'partial'
      ? ({ ['--ppc-angle' as never]: `${angleDeg}deg` } as CSSProperties)
      : undefined

  return { safeTotal, safeDone, openCount, percent, progressKind, style }
}

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

  const model = getProgressModel({ status, doneCount, totalCount })

  const ariaLabel =
    status === 'done'
      ? t('aria.projectProgressDone')
      : t('aria.projectProgressOpen', {
          percent: model.percent,
          doneCount: model.safeDone,
          totalCount: model.safeTotal,
          openCount: model.openCount,
        })

  return (
    <button
      type="button"
      className={`project-progress-control${status === 'done' ? ' is-done' : ''}`}
      data-size={size ?? 'list'}
      data-progress={model.progressKind}
      aria-label={ariaLabel}
      disabled={disabled}
      style={model.style}
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

export function ProjectProgressIndicator({
  status,
  doneCount,
  totalCount,
  size,
}: {
  status: ProjectStatus
  doneCount: number
  totalCount: number
  size?: 'list' | 'header'
}) {
  const model = getProgressModel({ status, doneCount, totalCount })

  return (
    <span
      className={`project-progress-control${status === 'done' ? ' is-done' : ''}`}
      data-size={size ?? 'list'}
      data-progress={model.progressKind}
      aria-hidden="true"
      style={model.style}
    >
      {status === 'done' ? <CheckIcon /> : null}
    </span>
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
