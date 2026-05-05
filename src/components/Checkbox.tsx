import type { ChangeEvent, CSSProperties, InputHTMLAttributes, ReactNode } from 'react'
import { Check, X } from 'lucide-react'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children' | 'className' | 'style'> & {
  ariaLabel?: string
  children?: ReactNode
  className?: string
  style?: CSSProperties
  controlClassName?: string
  mark?: 'check' | 'x'
  onCheckedChange?: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void
}

function joinClassNames(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ')
}

export function Checkbox({
  ariaLabel,
  children,
  className,
  style,
  controlClassName,
  mark = 'check',
  disabled,
  onChange,
  onCheckedChange,
  ...inputProps
}: CheckboxProps) {
  return (
    <label className={joinClassNames('checkbox', disabled && 'is-disabled', className)} style={style}>
      <input
        {...inputProps}
        type="checkbox"
        className="checkbox-input"
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(event) => {
          onChange?.(event)
          onCheckedChange?.(event.target.checked, event)
        }}
      />
      <span
        className={joinClassNames('checkbox-control', controlClassName)}
        data-mark={mark}
        aria-hidden="true"
      >
        <span className="checkbox-control-mark" aria-hidden="true">
          {mark === 'x' ? <X strokeWidth={1.7} /> : <Check strokeWidth={1.7} />}
        </span>
      </span>
      {children}
    </label>
  )
}
