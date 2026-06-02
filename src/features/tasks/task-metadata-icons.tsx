import { Calendar, Clock, Tag, ChevronDown, Sun, CalendarCheck, FileText, CircleX } from 'lucide-react'

export function CalendarIcon({ className }: { className?: string }) {
  return <Calendar className={className} />
}

export function ClockIcon({ className }: { className?: string }) {
  return <Clock className={className} />
}

export function TagIcon({ className }: { className?: string }) {
  return <Tag className={className} />
}

export function ChevronDownIcon({ className }: { className?: string }) {
  return <ChevronDown strokeWidth={2.2} className={className} />
}

export function SunIcon({ className }: { className?: string }) {
  return <Sun className={className} />
}

export function TodayIcon({ className }: { className?: string }) {
  return <CalendarCheck className={className} />
}

export function NoteIcon({ className }: { className?: string }) {
  return <FileText className={className} />
}

export function CircleXIcon({ className }: { className?: string }) {
  return <CircleX className={className} />
}
