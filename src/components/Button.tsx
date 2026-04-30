import { forwardRef } from 'react'
import clsx from 'clsx'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'danger'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = 'default', type = 'button', className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={clsx(
          'button',
          variant === 'ghost' && 'button-ghost',
          variant === 'danger' && 'button-danger',
          className
        )}
        {...rest}
      />
    )
  }
)
