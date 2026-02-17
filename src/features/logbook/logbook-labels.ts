type SupportedLocale = 'en' | 'zh-CN'

function normalizeLocale(locale: string): SupportedLocale {
  return locale === 'zh-CN' ? 'zh-CN' : 'en'
}

function intlLocale(locale: SupportedLocale): string {
  return locale === 'zh-CN' ? 'zh-CN' : 'en-US'
}

export function formatLogbookMonthHeader(params: {
  monthKey: string
  locale: string
  baseYear: number
}): string {
  const locale = normalizeLocale(params.locale)

  const m = /^(\d{4})-(\d{2})$/.exec(params.monthKey)
  if (!m) return params.monthKey

  const year = Number(m[1])
  const monthNum = Number(m[2])
  if (!Number.isFinite(year) || !Number.isFinite(monthNum)) return params.monthKey

  const showYear = year !== params.baseYear

  if (locale === 'zh-CN') return showYear ? `${year}年${monthNum}月` : `${monthNum}月`

  const date = new Date(year, monthNum - 1, 1)
  const monthName = new Intl.DateTimeFormat(intlLocale(locale), { month: 'short' }).format(date)
  return showYear ? `${monthName} ${year}` : monthName
}

export function formatLogbookDatePrefix(date: Date): string {
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${month}/${day}`
}
