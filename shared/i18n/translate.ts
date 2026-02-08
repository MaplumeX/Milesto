import type { Locale } from './locale'
import { messageCatalogs, messagesEn } from './messages'

function getByPath(root: unknown, key: string): unknown {
  const parts = key.split('.').filter(Boolean)
  let cur: unknown = root
  for (const part of parts) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

// Minimal translator for Main (native dialogs). Renderer uses i18next.
export function translate(locale: Locale, key: string): string {
  const catalog = messageCatalogs[locale]
  const v = getByPath(catalog, key)
  if (typeof v === 'string') return v

  const fallback = getByPath(messagesEn, key)
  if (typeof fallback === 'string') return fallback

  // Developer error: missing key in both catalogs.
  return key
}
