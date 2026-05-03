import { describe, expect, it, vi } from 'vitest'

import { createConfirmGate } from '../../../electron/agent/confirm-gate'

describe('createConfirmGate', () => {
  it('emits confirm request and resolves true when approved', async () => {
    const onConfirmRequest = vi.fn()
    const { confirmGate, resolveConfirm } = createConfirmGate({ onConfirmRequest })

    const promise = confirmGate('task.delete', '删除任务 "Test"')

    expect(onConfirmRequest).toHaveBeenCalledTimes(1)
    const req = onConfirmRequest.mock.calls[0]![0]
    expect(req.action).toBe('task.delete')
    expect(req.summary).toBe('删除任务 "Test"')
    expect(typeof req.messageId).toBe('string')

    const resolved = resolveConfirm(req.messageId, true)
    expect(resolved).toBe(true)

    const result = await promise
    expect(result).toBe(true)
  })

  it('resolves false when rejected', async () => {
    const onConfirmRequest = vi.fn()
    const { confirmGate, resolveConfirm } = createConfirmGate({ onConfirmRequest })

    const promise = confirmGate('project.delete', '删除项目 "P"')

    const req = onConfirmRequest.mock.calls[0]![0]
    const resolved = resolveConfirm(req.messageId, false)
    expect(resolved).toBe(true)

    const result = await promise
    expect(result).toBe(false)
  })

  it('returns false for unknown messageId', () => {
    const onConfirmRequest = vi.fn()
    const { resolveConfirm } = createConfirmGate({ onConfirmRequest })

    const resolved = resolveConfirm('non-existent-id', true)
    expect(resolved).toBe(false)
  })

  it('supports multiple concurrent confirmations', async () => {
    const onConfirmRequest = vi.fn()
    const { confirmGate, resolveConfirm } = createConfirmGate({ onConfirmRequest })

    const promise1 = confirmGate('task.delete', '删除任务 A')
    const promise2 = confirmGate('project.delete', '删除项目 B')

    expect(onConfirmRequest).toHaveBeenCalledTimes(2)

    const req1 = onConfirmRequest.mock.calls[0]![0]
    const req2 = onConfirmRequest.mock.calls[1]![0]

    // Resolve in reverse order
    resolveConfirm(req2.messageId, false)
    resolveConfirm(req1.messageId, true)

    const [result1, result2] = await Promise.all([promise1, promise2])
    expect(result1).toBe(true)
    expect(result2).toBe(false)
  })
})
