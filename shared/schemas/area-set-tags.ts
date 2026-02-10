import { z } from 'zod'

import { IdSchema } from './common'

const UniqueIdListSchema = z.array(IdSchema).superRefine((ids, ctx) => {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id)
    seen.add(id)
  }

  if (dupes.size > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'tag_ids contains duplicates.',
      params: { duplicate_tag_ids: Array.from(dupes) },
    })
  }
})

export const AreaSetTagsInputSchema = z.object({
  area_id: IdSchema,
  tag_ids: UniqueIdListSchema,
})

export type AreaSetTagsInput = z.infer<typeof AreaSetTagsInputSchema>
