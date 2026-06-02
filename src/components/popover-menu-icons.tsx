import type { ReactNode } from 'react'
import {
  ChevronLeft,
  CircleX,
  Trash2,
  CircleCheck,
  Clock,
  ArrowRightLeft,
  ExternalLink,
  Pencil,
  RotateCcw,
  Calendar,
  Tag,
} from 'lucide-react'

function PopoverMenuIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function BackMenuIcon() {
  return <ChevronLeft strokeWidth={1.9} />
}

export function CancelMenuIcon() {
  return <CircleX strokeWidth={1.9} />
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
  return <Trash2 strokeWidth={1.9} />
}

export function DoneMenuIcon() {
  return <CircleCheck strokeWidth={1.9} />
}

export function DueMenuIcon() {
  return <Clock strokeWidth={1.9} />
}

export function MoveMenuIcon() {
  return <ArrowRightLeft strokeWidth={1.9} />
}

export function OpenMenuIcon() {
  return <ExternalLink strokeWidth={1.9} />
}

export function RenameMenuIcon() {
  return <Pencil strokeWidth={1.9} />
}

export function RestoreMenuIcon() {
  return <RotateCcw strokeWidth={1.9} />
}

export function ScheduleMenuIcon() {
  return <Calendar strokeWidth={1.9} />
}

export function TagMenuIcon() {
  return <Tag strokeWidth={1.9} />
}
