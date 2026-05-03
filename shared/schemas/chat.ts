import { z } from 'zod'

import { IdSchema, IsoDateTimeSchema } from './common'

// Chat session — a single conversation thread the user can rename/delete.
// Multiple sessions per app, all persisted locally in better-sqlite3.
export const ChatSessionSchema = z.object({
  id: IdSchema,
  title: z.string(),
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
})

export type ChatSession = z.infer<typeof ChatSessionSchema>

// Chat message — one turn in a session.
// `role` mirrors langgraph BaseMessage classes:
//   - user → HumanMessage
//   - assistant → AIMessage (may include tool_calls)
//   - tool → ToolMessage (must carry tool_call_id)
//   - system → SystemMessage
// `tool_calls` is the assistant's planned tool invocations (LangChain's
// AIMessage.tool_calls shape). Stored as JSON; null for non-assistant messages
// or assistant messages that did not call tools.
// `tool_call_id` is the originating tool call id when role === 'tool'.
export const ChatMessageRoleSchema = z.enum(['user', 'assistant', 'tool', 'system'])
export type ChatMessageRole = z.infer<typeof ChatMessageRoleSchema>

export const ChatMessageSchema = z.object({
  id: IdSchema,
  session_id: IdSchema,
  role: ChatMessageRoleSchema,
  content: z.string(),
  tool_calls: z.array(z.unknown()).nullable(),
  tool_call_id: z.string().nullable(),
  created_at: IsoDateTimeSchema,
})

export type ChatMessage = z.infer<typeof ChatMessageSchema>

// Inputs for chat session management IPC actions.
export const ChatSessionCreateInputSchema = z.object({
  title: z.string().optional(),
})
export type ChatSessionCreateInput = z.infer<typeof ChatSessionCreateInputSchema>

export const ChatSessionRenameInputSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
})
export type ChatSessionRenameInput = z.infer<typeof ChatSessionRenameInputSchema>

export const ChatSessionIdInputSchema = z.object({
  id: IdSchema,
})
export type ChatSessionIdInput = z.infer<typeof ChatSessionIdInputSchema>

export const ChatMessageListInputSchema = z.object({
  session_id: IdSchema,
})
export type ChatMessageListInput = z.infer<typeof ChatMessageListInputSchema>

export const ChatMessageInsertInputSchema = z.object({
  session_id: IdSchema,
  role: ChatMessageRoleSchema,
  content: z.string(),
  tool_calls: z.array(z.unknown()).nullable().optional(),
  tool_call_id: z.string().nullable().optional(),
})
export type ChatMessageInsertInput = z.infer<typeof ChatMessageInsertInputSchema>

// AI provider configuration. ⚠️ apiKey is stored plaintext in app_settings for
// this iteration — explicit acknowledged risk in the PRD; the next iteration
// will switch to safeStorage. Do NOT silently encrypt here.
export const AiConfigSchema = z.object({
  enabled: z.boolean(),
  baseUrl: z.string().trim().url(),
  apiKey: z.string(),
  model: z.string(),
})
export type AiConfig = z.infer<typeof AiConfigSchema>

export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
}
