const SYNC_URL_ERROR = 'Sync server URL must use http:// or https://.'
const SYNC_ENDPOINT_PATH = 'sync'

function appendSyncEndpoint(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '')
  if (normalized === '') return `/${SYNC_ENDPOINT_PATH}`
  if (normalized.endsWith(`/${SYNC_ENDPOINT_PATH}`)) return normalized
  return `${normalized}/${SYNC_ENDPOINT_PATH}`
}

export function toSyncWebSocketUrl(serverUrl: string): string {
  let url: URL

  try {
    url = new URL(serverUrl.trim())
  } catch {
    throw new Error(SYNC_URL_ERROR)
  }

  switch (url.protocol) {
    case 'http:':
      url.protocol = 'ws:'
      break
    case 'https:':
      url.protocol = 'wss:'
      break
    case 'ws:':
    case 'wss:':
      break
    default:
      throw new Error(SYNC_URL_ERROR)
  }

  url.pathname = appendSyncEndpoint(url.pathname)
  url.search = ''
  url.hash = ''
  return url.toString()
}
