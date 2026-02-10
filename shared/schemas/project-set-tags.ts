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

export const ProjectSetTagsInputSchema = z.object({
  project_id: IdSchema,
  tag_ids: UniqueIdListSchema,
})

export type ProjectSetTagsInput = z.infer<typeof ProjectSetTagsInputSchema>
