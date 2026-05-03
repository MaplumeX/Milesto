import { randomUUID } from 'node:crypto'

export type ConfirmRequest = {
  messageId: string
  action: string
  summary: string
}

export type ConfirmCallbacks = {
  onConfirmRequest: (req: ConfirmRequest) => void
}

export type ConfirmGate = (action: string, summary: string) => Promise<boolean>

/**
 * Creates a confirm gate that pauses tool execution until the user
 * approves or rejects a high-risk action via IPC.
 *
 * The gate is async-await friendly: tools await it, and the LangGraph
 * loop naturally pauses while waiting for user input.
 */
export function createConfirmGate(callbacks: ConfirmCallbacks): {
  confirmGate: ConfirmGate
  resolveConfirm: (messageId: string, approve: boolean) => boolean
} {
  const pending = new Map<string, { resolve: (value: boolean) => void }>()

  const confirmGate: ConfirmGate = async (action, summary) => {
    const messageId = randomUUID()

    return new Promise<boolean>((resolve) => {
      pending.set(messageId, { resolve })
      callbacks.onConfirmRequest({ messageId, action, summary })
    })
  }

  const resolveConfirm = (messageId: string, approve: boolean): boolean => {
    const entry = pending.get(messageId)
    if (!entry) return false
    entry.resolve(approve)
    pending.delete(messageId)
    return true
  }

  return { confirmGate, resolveConfirm }
}
