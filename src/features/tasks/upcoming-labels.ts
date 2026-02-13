import { formatLocalDate } from '../../lib/dates'

type SupportedLocale = 'en' | 'zh-CN'

function normalizeLocale(locale: string): SupportedLocale {
  return locale === 'zh-CN' ? 'zh-CN' : 'en'
}

function intlLocale(locale: SupportedLocale): string {
  return locale === 'zh-CN' ? 'zh-CN' : 'en-US'
}

export function formatUpcomingDayHeader(date: Date, localeInput: string): string {
  const locale = normalizeLocale(localeInput)
  const month = date.getMonth() + 1
  const day = date.getDate()

  const weekday = new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'short' }).format(date)

  if (locale === 'zh-CN') return `${month}.${day} ${weekday}`
  return `${month}/${day} ${weekday}`
}

export function formatUpcomingMonthHeader(params: {
  month: Date
  locale: string
  rangeStart?: Date
  rangeEnd?: Date
  baseYear?: number
}): string {
  const locale = normalizeLocale(params.locale)

  const year = params.month.getFullYear()
  const monthNum = params.month.getMonth() + 1
  const monthName = new Intl.DateTimeFormat(intlLocale(locale), { month: 'short' }).format(params.month)

  const showYear = typeof params.baseYear === 'number' && year !== params.baseYear

  const monthLabel = (() => {
    if (locale === 'zh-CN') return showYear ? `${year}年${monthNum}月` : `${monthNum}月`
    return showYear ? `${monthName} ${year}` : monthName
  })()

  const hasRange = Boolean(params.rangeStart && params.rangeEnd)
  if (!hasRange) return monthLabel

  const startDay = params.rangeStart?.getDate()
  const endDay = params.rangeEnd?.getDate()
  if (!startDay || !endDay) return monthLabel

  if (locale === 'zh-CN') return `${monthLabel}（${startDay}-${endDay}）`
  return `${monthLabel} (${startDay}-${endDay})`
}

export function formatUpcomingMonthTaskPrefix(date: Date, localeInput: string): string {
  const locale = normalizeLocale(localeInput)
  const month = date.getMonth() + 1
  const day = date.getDate()
  if (locale === 'zh-CN') return `${month}.${day}`
  return `${month}/${day}`
}

export function formatUpcomingLocalDateKey(date: Date): string {
  return formatLocalDate(date)
}
