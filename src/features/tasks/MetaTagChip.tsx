import { X } from 'lucide-react'

type MetaTagChipProps = {
  title: string
  onRemove: () => void
  removeLabel: string
  color?: string | null
}

export function MetaTagChip({ title, onRemove, removeLabel, color }: MetaTagChipProps) {
  const style: React.CSSProperties | undefined = color
    ? {
        borderColor: color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
      }
    : undefined

  return (
    <span className="meta-tag-chip" style={style}>
      <span className="meta-tag-chip-text">{title}</span>
      <button
        type="button"
        className="meta-tag-chip-clear"
        aria-label={removeLabel}
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
      >
        <X size={12} />
      </button>
    </span>
  )
}
