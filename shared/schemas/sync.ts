import { z } from 'zod'

import { AppErrorSchema } from '../app-error'

import { AreaSchema } from './area'
import { ChecklistItemSchema } from './checklist'
import { IdSchema, IsoDateTimeSchema, LocalDateSchema } from './common'
import { ProjectSchema, ProjectSectionSchema } from './project'
import { TagSchema } from './tag'
import { TaskSchema } from './task'

export const SyncRepositoryConfigSchema = z.object({
  endpoint: z.string().min(1),
  region: z.string().min(1),
  bucket: z.string().min(1),
  prefix: z.string().default(''),
  force_path_style: z.boolean().default(false),
})

export type SyncRepositoryConfig = z.infer<typeof SyncRepositoryConfigSchema>

export const SyncCredentialsSchema = z.object({
  access_key_id: z.string().min(1),
  secret_access_key: z.string().min(1),
})

export type SyncCredentials = z.infer<typeof SyncCredentialsSchema>

export const SyncCredentialUpdateSchema = z
  .object({
    access_key_id: z.string().min(1).optional(),
    secret_access_key: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    const hasAccess = value.access_key_id !== undefined
    const hasSecret = value.secret_access_key !== undefined

    if (hasAccess !== hasSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'access_key_id and secret_access_key must be provided together.',
        path: hasAccess ? ['secret_access_key'] : ['access_key_id'],
      })
    }
  })

export type SyncCredentialUpdate = z.infer<typeof SyncCredentialUpdateSchema>

export const SyncConnectionInputSchema = z.object({
  config: SyncRepositoryConfigSchema,
  credentials: SyncCredentialsSchema,
})

export type SyncConnectionInput = z.infer<typeof SyncConnectionInputSchema>

export const SyncSaveConfigurationInputSchema = z.object({
  config: SyncRepositoryConfigSchema,
  device_name: z.string().min(1),
  credentials: SyncCredentialUpdateSchema.optional(),
})

export type SyncSaveConfigurationInput = z.infer<typeof SyncSaveConfigurationInputSchema>

export const SyncVisibleErrorSchema = AppErrorSchema.pick({
  code: true,
  message: true,
})

export type SyncVisibleError = z.infer<typeof SyncVisibleErrorSchema>

export const SyncStatusModeSchema = z.enum(['disabled', 'idle', 'syncing', 'error'])

export type SyncStatusMode = z.infer<typeof SyncStatusModeSchema>

export const SyncStateSchema = z.object({
  enabled: z.boolean(),
  mode: SyncStatusModeSchema,
  device_id: IdSchema,
  device_name: z.string(),
  config: SyncRepositoryConfigSchema.nullable(),
  has_stored_credentials: z.boolean(),
  pending_outbox_count: z.number().int().nonnegative(),
  last_successful_sync_at: IsoDateTimeSchema.nullable(),
  last_attempted_sync_at: IsoDateTimeSchema.nullable(),
  last_error: SyncVisibleErrorSchema.nullable(),
})

export type SyncState = z.infer<typeof SyncStateSchema>

export const SyncTestConnectionResultSchema = z.object({
  reachable: z.literal(true),
})

export type SyncTestConnectionResult = z.infer<typeof SyncTestConnectionResultSchema>

export const SyncSyncNowResultSchema = SyncStateSchema

export type SyncSyncNowResult = z.infer<typeof SyncSyncNowResultSchema>

export const SyncVersionSchema = z.string().min(1)

export type SyncVersion = z.infer<typeof SyncVersionSchema>

export const SyncEntityTypeSchema = z.enum([
  'task',
  'project',
  'area',
  'tag',
  'project_section',
  'checklist_item',
])

export type SyncEntityType = z.infer<typeof SyncEntityTypeSchema>

export const SyncRelationTypeSchema = z.enum(['task_tag', 'project_tag', 'area_tag'])

export type SyncRelationType = z.infer<typeof SyncRelationTypeSchema>

const SyncTaskEntitySchema = TaskSchema
const SyncProjectEntitySchema = ProjectSchema
const SyncAreaEntitySchema = AreaSchema
const SyncTagEntitySchema = TagSchema
const SyncProjectSectionEntitySchema = ProjectSectionSchema
const SyncChecklistItemEntitySchema = ChecklistItemSchema

export const SyncEntityPayloadSchema = z.union([
  SyncTaskEntitySchema,
  SyncProjectEntitySchema,
  SyncAreaEntitySchema,
  SyncTagEntitySchema,
  SyncProjectSectionEntitySchema,
  SyncChecklistItemEntitySchema,
])

export type SyncEntityPayload = z.infer<typeof SyncEntityPayloadSchema>

export const SyncRelationPayloadSchema = z.union([
  z.object({
    task_id: IdSchema,
    tag_id: IdSchema,
    created_at: IsoDateTimeSchema,
    updated_at: IsoDateTimeSchema,
    deleted_at: IsoDateTimeSchema.nullable(),
  }),
  z.object({
    project_id: IdSchema,
    tag_id: IdSchema,
    position: z.number().int().nullable(),
    created_at: IsoDateTimeSchema,
    updated_at: IsoDateTimeSchema,
    deleted_at: IsoDateTimeSchema.nullable(),
  }),
  z.object({
    area_id: IdSchema,
    tag_id: IdSchema,
    position: z.number().int().nullable(),
    created_at: IsoDateTimeSchema,
    updated_at: IsoDateTimeSchema,
    deleted_at: IsoDateTimeSchema.nullable(),
  }),
])

export type SyncRelationPayload = z.infer<typeof SyncRelationPayloadSchema>

export const SyncEntityPutOperationSchema = z.object({
  kind: z.literal('entity.put'),
  entity_type: SyncEntityTypeSchema,
  changed_fields: z.array(z.string()).min(1),
  field_versions: z.record(z.string(), SyncVersionSchema),
  entity: SyncEntityPayloadSchema,
})

export type SyncEntityPutOperation = z.infer<typeof SyncEntityPutOperationSchema>

export const SyncRelationPutOperationSchema = z.object({
  kind: z.literal('relation.put'),
  relation_type: SyncRelationTypeSchema,
  version: SyncVersionSchema,
  relation: SyncRelationPayloadSchema,
})

export type SyncRelationPutOperation = z.infer<typeof SyncRelationPutOperationSchema>

export const SyncListPutOperationSchema = z.object({
  kind: z.literal('list.put'),
  list_scope: z.string().min(1),
  version: SyncVersionSchema,
  updated_at: IsoDateTimeSchema,
  ordered_ids: z.array(IdSchema),
})

export type SyncListPutOperation = z.infer<typeof SyncListPutOperationSchema>

export const SyncBatchOperationSchema = z.union([
  SyncEntityPutOperationSchema,
  SyncRelationPutOperationSchema,
  SyncListPutOperationSchema,
])

export type SyncBatchOperation = z.infer<typeof SyncBatchOperationSchema>

export const SyncBatchSchema = z.object({
  batch_id: z.string().min(1),
  source_device_id: IdSchema,
  sequence_number: z.number().int().positive(),
  created_at: IsoDateTimeSchema,
  version: SyncVersionSchema,
  operations: z.array(SyncBatchOperationSchema),
})

export type SyncBatch = z.infer<typeof SyncBatchSchema>

export const SyncConflictEventSchema = z.object({
  id: IdSchema,
  scope: z.string().min(1),
  source_device_id: IdSchema,
  incoming_version: SyncVersionSchema,
  winning_version: SyncVersionSchema,
  created_at: IsoDateTimeSchema,
  code: z.string().min(1),
  message: z.string().min(1),
})

export type SyncConflictEvent = z.infer<typeof SyncConflictEventSchema>

export const SyncPendingOutboxBatchSchema = z.object({
  batch_id: z.string().min(1),
  sequence_number: z.number().int().positive(),
  created_at: IsoDateTimeSchema,
  retry_count: z.number().int().nonnegative(),
  last_error: SyncVisibleErrorSchema.nullable(),
  batch: SyncBatchSchema,
})

export type SyncPendingOutboxBatch = z.infer<typeof SyncPendingOutboxBatchSchema>

export const SyncApplyRemoteBatchInputSchema = z.object({
  batch: SyncBatchSchema,
})

export type SyncApplyRemoteBatchInput = z.infer<typeof SyncApplyRemoteBatchInputSchema>

export const SyncApplyRemoteBatchResultSchema = z.object({
  applied: z.boolean(),
  duplicate: z.boolean(),
})

export type SyncApplyRemoteBatchResult = z.infer<typeof SyncApplyRemoteBatchResultSchema>

export const SyncMarkOutboxUploadedInputSchema = z.object({
  batch_ids: z.array(z.string().min(1)).min(1),
  uploaded_at: IsoDateTimeSchema,
})

export type SyncMarkOutboxUploadedInput = z.infer<typeof SyncMarkOutboxUploadedInputSchema>

export const SyncSetCredentialsBlobInputSchema = z.object({
  encrypted_blob: z.string().min(1),
})

export type SyncSetCredentialsBlobInput = z.infer<typeof SyncSetCredentialsBlobInputSchema>

export const SyncStatusUpdateInputSchema = z.object({
  last_attempted_sync_at: IsoDateTimeSchema.nullable().optional(),
  last_successful_sync_at: IsoDateTimeSchema.nullable().optional(),
  last_error: SyncVisibleErrorSchema.nullable().optional(),
})

export type SyncStatusUpdateInput = z.infer<typeof SyncStatusUpdateInputSchema>

export const SyncDbStateSchema = z.object({
  device_id: IdSchema,
  device_name: z.string(),
  enabled: z.boolean(),
  config: SyncRepositoryConfigSchema.nullable(),
  has_stored_credentials: z.boolean(),
  pending_outbox_count: z.number().int().nonnegative(),
  last_successful_sync_at: IsoDateTimeSchema.nullable(),
  last_attempted_sync_at: IsoDateTimeSchema.nullable(),
  last_error: SyncVisibleErrorSchema.nullable(),
  latest_conflict: SyncConflictEventSchema.nullable(),
})

export type SyncDbState = z.infer<typeof SyncDbStateSchema>

export const SyncRepositoryDescriptorSchema = z.object({
  endpoint: z.string().min(1),
  region: z.string().min(1),
  bucket: z.string().min(1),
  prefix: z.string(),
})

export type SyncRepositoryDescriptor = z.infer<typeof SyncRepositoryDescriptorSchema>

export const SyncDeviceInfoSchema = z.object({
  device_id: IdSchema,
  device_name: z.string(),
  updated_at: IsoDateTimeSchema,
})

export type SyncDeviceInfo = z.infer<typeof SyncDeviceInfoSchema>

export const SyncSnapshotDescriptorSchema = z.object({
  source_device_id: IdSchema,
  sequence_number: z.number().int().positive(),
  created_at: IsoDateTimeSchema,
})

export type SyncSnapshotDescriptor = z.infer<typeof SyncSnapshotDescriptorSchema>

export const SyncCursorSchema = z.object({
  source_device_id: IdSchema,
  last_applied_sequence: z.number().int().nonnegative(),
  updated_at: IsoDateTimeSchema,
})

export type SyncCursor = z.infer<typeof SyncCursorSchema>

export const SyncLocalDateSchema = LocalDateSchema
