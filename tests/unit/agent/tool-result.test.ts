import { describe, expect, it } from 'vitest'
import { formatToolResult } from '../../../electron/agent/tools/tool-result'
import { ok, err } from '../../../shared/result'

describe('formatToolResult', () => {
  it('formats ok result as JSON with ok:true and data', () => {
    const result = ok({ id: 'task-1', title: 'Buy milk' })
    const formatted = formatToolResult(result)
    expect(JSON.parse(formatted)).toEqual({
      ok: true,
      data: { id: 'task-1', title: 'Buy milk' },
    })
  })

  it('formats err result as JSON with ok:false, code and message', () => {
    const result = err({
      code: 'NOT_FOUND',
      message: 'Task not found.',
    })
    const formatted = formatToolResult(result)
    expect(JSON.parse(formatted)).toEqual({
      ok: false,
      code: 'NOT_FOUND',
      message: 'Task not found.',
    })
  })

  it('formats ok result with array data', () => {
    const result = ok([{ id: '1' }, { id: '2' }])
    const formatted = formatToolResult(result)
    expect(JSON.parse(formatted)).toEqual({
      ok: true,
      data: [{ id: '1' }, { id: '2' }],
    })
  })

  it('formats err result with validation error', () => {
    const result = err({
      code: 'VALIDATION_FAILED',
      message: 'Invalid payload.',
      details: { issues: ['title is required'] },
    })
    const formatted = formatToolResult(result)
    // details should NOT be included in the formatted output
    expect(JSON.parse(formatted)).toEqual({
      ok: false,
      code: 'VALIDATION_FAILED',
      message: 'Invalid payload.',
    })
  })
})
