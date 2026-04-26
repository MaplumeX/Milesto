import { Children } from 'react'
import type { ReactNode } from 'react'

type PopoverMenuGroupProps = {
  children: ReactNode
}

export function PopoverMenuGroup({ children }: PopoverMenuGroupProps) {
  const validChildren = Children.toArray(children).filter(Boolean)
  if (validChildren.length === 0) return null
  return <div className="task-inline-popover-group">{validChildren}</div>
}
