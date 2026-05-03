import type { Result } from '../../../shared/result'

/**
 * Format a Result<T> into a JSON string that the LLM can parse.
 * Never throws — always returns a string.
 */
export function formatToolResult<T>(result: Result<T>): string {
  if (result.ok) {
    return JSON.stringify({ ok: true, data: result.data })
  }
  return JSON.stringify({
    ok: false,
    code: result.error.code,
    message: result.error.message,
  })
}
