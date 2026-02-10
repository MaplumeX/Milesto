import { z } from 'zod'

import { AreaSchema } from './area'
import { TagSchema } from './tag'

export const AreaDetailSchema = z.object({
  area: AreaSchema,
  tags: z.array(TagSchema),
})

export type AreaDetail = z.infer<typeof AreaDetailSchema>
