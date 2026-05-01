type MetaTagChipProps = {
  title: string
  onRemove: () => void
  removeLabel: string
}

export function MetaTagChip({ title, onRemove, removeLabel }: MetaTagChipProps) {
  return (
    <span className="meta-tag-chip">
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
        ×
      </button>
    </span>
  )
}
