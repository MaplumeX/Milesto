import { ChatOpenAI } from '@langchain/openai'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages'
import type { StructuredToolInterface } from '@langchain/core/tools'

import type { AiConfig } from '../../shared/schemas/chat'

export type RuntimeCallbacks = {
  onToken: (delta: string) => void
  onToolCall: (name: string, args: unknown) => void
  onToolResult: (name: string, result: string) => void
  onDone: () => void
  onError: (error: { code: string; message: string }) => void
}

export type AgentRuntime = {
  send: (sessionId: string, message: string, history: BaseMessage[], signal: AbortSignal) => Promise<void>
  abort: () => void
}

export function createAgentRuntime(config: AiConfig, tools: StructuredToolInterface[], callbacks: RuntimeCallbacks): AgentRuntime {
  const llm = new ChatOpenAI({
    model: config.model,
    streaming: true,
    configuration: { baseURL: config.baseUrl, apiKey: config.apiKey },
  })

  const agent = createReactAgent({
    llm,
    tools,
    prompt: new SystemMessage(
      'You are Milesto assistant, a helpful task-management AI. ' +
        'You can read tasks from Today, Inbox, Anytime, Someday, Upcoming, Logbook, Project, and Area. ' +
        'You can also search tasks and view task details. ' +
        'Reply in the same language as the user.',
    ),
  })

  let inflightController: AbortController | null = null

  return {
    async send(_sessionId: string, message: string, history: BaseMessage[], signal: AbortSignal) {
      inflightController = new AbortController()

      // Combine external signal with our own controller
      const combinedSignal = combineAbortSignals(inflightController.signal, signal)

      const inputs = { messages: [...history, new HumanMessage(message)] }

      try {
        const stream = agent.streamEvents(inputs, { version: 'v2', signal: combinedSignal })

        for await (const ev of stream) {
          if (combinedSignal.aborted) break

          switch (ev.event) {
            case 'on_chat_model_stream': {
              const chunk = ev.data?.chunk
              if (chunk && typeof chunk.content === 'string' && chunk.content.length > 0) {
                callbacks.onToken(chunk.content)
              }
              break
            }
            case 'on_tool_start': {
              callbacks.onToolCall(ev.name, ev.data?.input)
              break
            }
            case 'on_tool_end': {
              const output = typeof ev.data?.output === 'string' ? ev.data.output : JSON.stringify(ev.data?.output)
              callbacks.onToolResult(ev.name, output)
              break
            }
            case 'on_chain_end': {
              if (ev.name === 'LangGraph') {
                callbacks.onDone()
              }
              break
            }
          }
        }

        // If we exited the loop without an explicit on_chain_end, still call onDone
        // unless we were aborted.
        if (!combinedSignal.aborted) {
          callbacks.onDone()
        }
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e))
        if (error.name === 'AbortError') {
          // Expected on abort — still notify done so main process cleans up inflightRuns
          callbacks.onDone()
          return
        }
        callbacks.onError({ code: 'AGENT_RUNTIME_ERROR', message: error.message })
      } finally {
        inflightController = null
      }
    },

    abort() {
      inflightController?.abort()
      inflightController = null
    },
  }
}

function combineAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController()

  function onAbort() {
    controller.abort()
  }

  if (a.aborted || b.aborted) {
    controller.abort()
    return controller.signal
  }

  a.addEventListener('abort', onAbort, { once: true })
  b.addEventListener('abort', onAbort, { once: true })

  return controller.signal
}
