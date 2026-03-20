import { useEffect, useRef, useState, type ButtonHTMLAttributes } from 'react'

import { getBottomBarIconDefinition, type BottomBarIconKey } from './bottom-bar-icons'

const TOOLTIP_HOVER_DELAY_MS = 350

export function BottomBarActionButton({
  label,
  iconKey,
  className,
  type = 'button',
  onBlur,
  onClick,
  onFocus,
  onPointerDown,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string
  iconKey: BottomBarIconKey
}) {
  const iconDefinition = getBottomBarIconDefinition(iconKey)
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const hoverTimerRef = useRef<number | null>(null)
  const suppressHoverRef = useRef(false)
  const isPointerPressRef = useRef(false)

  function clearHoverTimer() {
    if (hoverTimerRef.current === null) return
    window.clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
  }

  useEffect(() => {
    return () => {
      clearHoverTimer()
    }
  }, [])

  return (
    <span
      className="content-bottom-action"
      data-tooltip-visible={isTooltipVisible ? 'true' : 'false'}
      onMouseEnter={() => {
        clearHoverTimer()
        if (suppressHoverRef.current) return
        hoverTimerRef.current = window.setTimeout(() => {
          hoverTimerRef.current = null
          if (suppressHoverRef.current) return
          setIsTooltipVisible(true)
        }, TOOLTIP_HOVER_DELAY_MS)
      }}
      onMouseLeave={() => {
        clearHoverTimer()
        isPointerPressRef.current = false
        suppressHoverRef.current = false
        setIsTooltipVisible(false)
      }}
    >
      <button
        {...props}
        type={type}
        className={`button button-ghost content-bottom-action-button${className ? ` ${className}` : ''}`}
        aria-label={label}
        onFocus={(e) => {
          onFocus?.(e)
          clearHoverTimer()
          if (isPointerPressRef.current) return
          setIsTooltipVisible(true)
        }}
        onBlur={(e) => {
          onBlur?.(e)
          clearHoverTimer()
          isPointerPressRef.current = false
          setIsTooltipVisible(false)
        }}
        onPointerDown={(e) => {
          onPointerDown?.(e)
          isPointerPressRef.current = true
        }}
        onClick={(e) => {
          onClick?.(e)
          clearHoverTimer()
          isPointerPressRef.current = false
          suppressHoverRef.current = true
          setIsTooltipVisible(false)
        }}
      >
        <span className="content-bottom-action-icon" data-bottom-bar-icon={iconKey} aria-hidden="true">
          {iconDefinition.icon}
        </span>
      </button>
      <span className="content-bottom-action-tooltip" aria-hidden="true">
        {label}
      </span>
    </span>
  )
}
