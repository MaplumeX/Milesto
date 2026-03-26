import { type CSSProperties, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { Project } from '../../../shared/schemas/project'

type ProjectStatus = Project['status']

type ProgressKind = 'cancelled' | 'done' | 'none' | 'full' | 'partial'

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
    params.status === 'done' || params.status === 'cancelled'
      ? 100
      : safeTotal <= 0
        ? 0
        : Math.round((safeDone / safeTotal) * 100)

  const progressKind: ProgressKind =
    params.status === 'done'
      ? 'done'
      : params.status === 'cancelled'
        ? 'cancelled'
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

/**
 * After mount, enable CSS transitions for --ppc-angle so the initial
 * render is instant but subsequent updates animate smoothly.
 */
function useReadyAfterMount() {
  const ref = useRef(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      ref.current = true
    })
    return () => cancelAnimationFrame(id)
  }, [])
  return ref
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
  const readyRef = useReadyAfterMount()

  const model = getProgressModel({ status, doneCount, totalCount })

  const ariaLabel =
    status === 'done'
      ? t('aria.projectProgressDone')
      : status === 'cancelled'
        ? t('aria.projectProgressCancelled')
      : t('aria.projectProgressOpen', {
          percent: model.percent,
          doneCount: model.safeDone,
          totalCount: model.safeTotal,
          openCount: model.openCount,
        })
  const statusClassName =
    status === 'done' ? ' is-done' : status === 'cancelled' ? ' is-cancelled' : ''

  return (
    <button
      type="button"
      className={`project-progress-control${statusClassName}`}
      data-size={size ?? 'list'}
      data-progress={model.progressKind}
      data-ready={readyRef.current || undefined}
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
      {status === 'done' ? <CheckIcon /> : status === 'cancelled' ? <XIcon /> : null}
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
  const readyRef = useReadyAfterMount()
  const model = getProgressModel({ status, doneCount, totalCount })
  const statusClassName =
    status === 'done' ? ' is-done' : status === 'cancelled' ? ' is-cancelled' : ''

  return (
    <span
      className={`project-progress-control${statusClassName}`}
      data-size={size ?? 'list'}
      data-progress={model.progressKind}
      data-ready={readyRef.current || undefined}
      aria-hidden="true"
      style={model.style}
    >
      {status === 'done' ? <CheckIcon /> : status === 'cancelled' ? <XIcon /> : null}
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

function XIcon() {
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
      <path d="M5.5 5.5l9 9" />
      <path d="M14.5 5.5l-9 9" />
    </svg>
  )
}
