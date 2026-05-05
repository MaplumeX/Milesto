import {
  ChevronLeft,
  CircleX,
  ArrowRightLeft,
  Trash2,
  CircleCheck,
  Clock,
  ExternalLink,
  Pencil,
  RotateCcw,
  Calendar,
  Tag,
} from 'lucide-react'

export function BackMenuIcon() {
  return <ChevronLeft size="1em" strokeWidth={1.9} />
}

export function CancelMenuIcon() {
  return <CircleX size="1em" strokeWidth={1.9} />
}

export function ConvertMenuIcon() {
  return <ArrowRightLeft size="1em" strokeWidth={1.9} />
}

export function DeleteMenuIcon() {
  return <Trash2 size="1em" strokeWidth={1.9} />
}

export function DoneMenuIcon() {
  return <CircleCheck size="1em" strokeWidth={1.9} />
}

export function DueMenuIcon() {
  return <Clock size="1em" strokeWidth={1.9} />
}

export function MoveMenuIcon() {
  return <ArrowRightLeft size="1em" strokeWidth={1.9} />
}

export function OpenMenuIcon() {
  return <ExternalLink size="1em" strokeWidth={1.9} />
}

export function RenameMenuIcon() {
  return <Pencil size="1em" strokeWidth={1.9} />
}

export function RestoreMenuIcon() {
  return <RotateCcw size="1em" strokeWidth={1.9} />
}

export function ScheduleMenuIcon() {
  return <Calendar size="1em" strokeWidth={1.9} />
}

export function TagMenuIcon() {
  return <Tag size="1em" strokeWidth={1.9} />
}
