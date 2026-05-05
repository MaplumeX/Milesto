import { Calendar, Clock, Tag, ChevronDown, Sun, CalendarCheck, FileText, CircleX } from 'lucide-react'

export function CalendarIcon({ className }: { className?: string }) {
  return <Calendar size="1em" className={className} />
}

export function ClockIcon({ className }: { className?: string }) {
  return <Clock size="1em" className={className} />
}

export function TagIcon({ className }: { className?: string }) {
  return <Tag size="1em" className={className} />
}

export function ChevronDownIcon({ className }: { className?: string }) {
  return <ChevronDown size="1em" className={className} strokeWidth={2.2} />
}

export function SunIcon({ className }: { className?: string }) {
  return <Sun size="1em" className={className} />
}

export function TodayIcon({ className }: { className?: string }) {
  return <CalendarCheck size="1em" className={className} />
}

export function NoteIcon({ className }: { className?: string }) {
  return <FileText size="1em" className={className} />
}

export function CircleXIcon({ className }: { className?: string }) {
  return <CircleX size="1em" className={className} />
}
