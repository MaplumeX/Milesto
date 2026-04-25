import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type PopoverMenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode
}

export const PopoverMenuItem = forwardRef<HTMLButtonElement, PopoverMenuItemProps>(function PopoverMenuItem(
  { children, className, icon, type = 'button', ...props },
  ref
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={`task-inline-popover-item${className ? ` ${className}` : ''}`}
    >
      {icon ? (
        <span className="task-inline-popover-item-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="task-inline-popover-item-label">{children}</span>
    </button>
  )
})
