import type { ChangeEvent, CSSProperties, InputHTMLAttributes, ReactNode } from 'react'

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
        <svg className="checkbox-control-mark" viewBox="0 0 12 10" fill="none">
          {mark === 'x' ? (
            <>
              <path
                d="M1.75 1.75L10.25 8.25"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10.25 1.75L1.75 8.25"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : (
            <path
              d="M1 5L4.25 8.25L11 1.5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </span>
      {children}
    </label>
  )
}
