import type { ComponentType, MouseEvent } from 'react'

type MetaDateBadgeProps = {
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>
  value: string
  iconColor: string
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  onClear: () => void
  ariaLabel: string
}

export function MetaDateBadge({ icon: Icon, value, iconColor, onClick, onClear, ariaLabel }: MetaDateBadgeProps) {
  return (
    <span className="meta-date-badge">
      <button
        type="button"
        className="meta-date-badge-value"
        aria-label={ariaLabel}
        onClick={onClick}
      >
        <Icon className="meta-date-badge-icon" style={{ color: iconColor }} />
        <span className="meta-date-badge-text">{value}</span>
      </button>
      <button
        type="button"
        className="meta-date-badge-clear"
        aria-label="Clear"
        onClick={(e) => {
          e.stopPropagation()
          onClear()
        }}
      >
        ×
      </button>
    </span>
  )
}
