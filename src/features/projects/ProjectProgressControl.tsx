import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'

import type { Project } from '../../../shared/schemas/project'

type ProjectStatus = Project['status']

type ProgressKind = 'cancelled' | 'done' | 'none' | 'full' | 'partial'

const PROGRESS_SVG_CENTER = 10
const PROGRESS_SVG_RADIUS = 10
const PROGRESS_SWEEP_ANIMATION_MS = 160
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function formatSvgNumber(value: number): string {
  return Number(value.toFixed(3)).toString()
}

function getProgressSectorPath(progressRatio: number): string {
  const safeRatio = Math.max(0, Math.min(1, progressRatio))
  const angle = safeRatio * Math.PI * 2
  const endX = PROGRESS_SVG_CENTER + PROGRESS_SVG_RADIUS * Math.sin(angle)
  const endY = PROGRESS_SVG_CENTER - PROGRESS_SVG_RADIUS * Math.cos(angle)
  const largeArcFlag = safeRatio > 0.5 ? 1 : 0

  return [
    `M ${PROGRESS_SVG_CENTER} ${PROGRESS_SVG_CENTER}`,
    `L ${PROGRESS_SVG_CENTER} ${PROGRESS_SVG_CENTER - PROGRESS_SVG_RADIUS}`,
    `A ${PROGRESS_SVG_RADIUS} ${PROGRESS_SVG_RADIUS} 0 ${largeArcFlag} 1 ${formatSvgNumber(endX)} ${formatSvgNumber(endY)}`,
    'Z',
  ].join(' ')
}

function getPrefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  )
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getPrefersReducedMotion)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY)
    const update = () => setPrefersReducedMotion(mediaQuery.matches)
    update()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', update)
      return () => mediaQuery.removeEventListener('change', update)
    }

    mediaQuery.addListener(update)
    return () => mediaQuery.removeListener(update)
  }, [])

  return prefersReducedMotion
}

function useAnimatedProgressRatio(targetRatio: number, animate: boolean): number {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [displayedRatio, setDisplayedRatio] = useState(targetRatio)
  const displayedRatioRef = useRef(targetRatio)

  useEffect(() => {
    if (
      prefersReducedMotion ||
      !animate ||
      typeof window === 'undefined' ||
      typeof window.requestAnimationFrame !== 'function'
    ) {
      displayedRatioRef.current = targetRatio
      setDisplayedRatio(targetRatio)
      return
    }

    const startRatio = displayedRatioRef.current
    if (startRatio === targetRatio) return

    let animationFrameId: number | null = null
    let startedAt: number | null = null

    const tick = (timestamp: number) => {
      if (startedAt === null) startedAt = timestamp

      const elapsed = timestamp - startedAt
      const progress = Math.min(1, elapsed / PROGRESS_SWEEP_ANIMATION_MS)
      const nextRatio = startRatio + (targetRatio - startRatio) * easeOutCubic(progress)
      displayedRatioRef.current = nextRatio
      setDisplayedRatio(nextRatio)

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(tick)
        return
      }

      displayedRatioRef.current = targetRatio
      setDisplayedRatio(targetRatio)
    }

    animationFrameId = window.requestAnimationFrame(tick)

    return () => {
      if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId)
    }
  }, [animate, prefersReducedMotion, targetRatio])

  return displayedRatio
}

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
  progressRatio: number
} {
  const safeTotal = Math.max(0, Math.floor(params.totalCount))
  const safeDone = Math.max(0, Math.min(safeTotal, Math.floor(params.doneCount)))
  const openCount = Math.max(0, safeTotal - safeDone)
  const progressRatio = safeTotal > 0 ? safeDone / safeTotal : 0

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

  return { safeTotal, safeDone, openCount, percent, progressKind, progressRatio }
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
      aria-label={ariaLabel}
      disabled={disabled}
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
      <ProgressPie progressKind={model.progressKind} progressRatio={model.progressRatio} />
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
  const model = getProgressModel({ status, doneCount, totalCount })
  const statusClassName =
    status === 'done' ? ' is-done' : status === 'cancelled' ? ' is-cancelled' : ''

  return (
    <span
      className={`project-progress-control${statusClassName}`}
      data-size={size ?? 'list'}
      data-progress={model.progressKind}
      aria-hidden="true"
    >
      <ProgressPie progressKind={model.progressKind} progressRatio={model.progressRatio} />
      {status === 'done' ? <CheckIcon /> : status === 'cancelled' ? <XIcon /> : null}
    </span>
  )
}

function ProgressPie({
  progressKind,
  progressRatio,
}: {
  progressKind: ProgressKind
  progressRatio: number
}) {
  const targetRatio =
    progressKind === 'done' || progressKind === 'full'
      ? 1
      : progressKind === 'partial'
        ? progressRatio
        : 0
  const visibleRatio = useAnimatedProgressRatio(
    targetRatio,
    progressKind === 'partial' || progressKind === 'full'
  )
  const sectorPath = visibleRatio > 0 && visibleRatio < 1 ? getProgressSectorPath(visibleRatio) : null

  return (
    <svg className="project-progress-svg" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {visibleRatio >= 1 ? (
        <circle
          className="project-progress-fill project-progress-full"
          cx={PROGRESS_SVG_CENTER}
          cy={PROGRESS_SVG_CENTER}
          r={PROGRESS_SVG_RADIUS}
        />
      ) : sectorPath ? (
        <path className="project-progress-fill project-progress-sector" d={sectorPath} />
      ) : null}
    </svg>
  )
}

function CheckIcon() {
  return <Check size="1em" strokeWidth={2.4} />
}

function XIcon() {
  return <X size="1em" strokeWidth={2.4} />
}
