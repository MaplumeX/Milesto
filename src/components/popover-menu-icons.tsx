import type { ReactNode } from 'react'

type PopoverMenuIconProps = {
  children: ReactNode
  fill?: string
  strokeWidth?: number
}

function PopoverMenuIcon({ children, fill = 'none', strokeWidth = 1.9 }: PopoverMenuIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function BackMenuIcon() {
  return (
    <PopoverMenuIcon>
      <path d="m15 18-6-6 6-6" />
    </PopoverMenuIcon>
  )
}

export function CancelMenuIcon() {
  return (
    <PopoverMenuIcon>
      <circle cx="12" cy="12" r="8" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </PopoverMenuIcon>
  )
}

export function ConvertMenuIcon() {
  return (
    <PopoverMenuIcon>
      <path d="M5 7h6v6H5z" />
      <path d="M13 11h6v6h-6z" />
      <path d="m11 10 2 2" />
      <path d="m13 9v3h-3" />
    </PopoverMenuIcon>
  )
}

export function DeleteMenuIcon() {
  return (
    <PopoverMenuIcon>
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M8 10v7M12 10v7M16 10v7" />
      <path d="M6 7l1 12h10l1-12" />
    </PopoverMenuIcon>
  )
}

export function DoneMenuIcon() {
  return (
    <PopoverMenuIcon>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12.5 2.3 2.3 4.7-5.3" />
    </PopoverMenuIcon>
  )
}

export function DueMenuIcon() {
  return (
    <PopoverMenuIcon>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </PopoverMenuIcon>
  )
}

export function MoveMenuIcon() {
  return (
    <PopoverMenuIcon>
      <path d="M5 8h12" />
      <path d="m13 4 4 4-4 4" />
      <path d="M19 16H7" />
      <path d="m11 12-4 4 4 4" />
    </PopoverMenuIcon>
  )
}

export function OpenMenuIcon() {
  return (
    <PopoverMenuIcon>
      <path d="M5 19h14V9h-5V5H5z" />
      <path d="M14 5h5v5" />
      <path d="m13 11 6-6" />
    </PopoverMenuIcon>
  )
}

export function RenameMenuIcon() {
  return (
    <PopoverMenuIcon>
      <path d="M4 20h4.5L18.5 10a2.8 2.8 0 0 0-4-4L4.5 16H4z" />
      <path d="m13.5 7.5 3 3" />
    </PopoverMenuIcon>
  )
}

export function RestoreMenuIcon() {
  return (
    <PopoverMenuIcon>
      <path d="M7 8h8a5 5 0 1 1-4.1 7.9" />
      <path d="M7 4v4h4" />
    </PopoverMenuIcon>
  )
}

export function ScheduleMenuIcon() {
  return (
    <PopoverMenuIcon>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </PopoverMenuIcon>
  )
}

export function TagMenuIcon() {
  return (
    <PopoverMenuIcon>
      <path d="M8.5 7.5h.01" />
      <path d="M4 10V4h6l8.5 8.5-6 6L4 10z" />
    </PopoverMenuIcon>
  )
}
