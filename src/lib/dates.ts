export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Parse a local-date string (YYYY-MM-DD) into a Date at local midnight.
// Do NOT use `new Date('YYYY-MM-DD')` because that is treated as UTC and can shift days by timezone.
export function parseLocalDate(localDate: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate)
  if (!m) return null

  const year = Number(m[1])
  const monthIndex = Number(m[2]) - 1
  const day = Number(m[3])
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null

  const date = new Date(year, monthIndex, day)

  // Reject impossible dates like 2026-02-31 (JS rolls them over).
  if (date.getFullYear() !== year) return null
  if (date.getMonth() !== monthIndex) return null
  if (date.getDate() !== day) return null

  return date
}
