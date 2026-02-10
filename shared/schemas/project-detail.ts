import { z } from 'zod'

import { ProjectSchema } from './project'
import { TagSchema } from './tag'

export const ProjectDetailSchema = z.object({
  project: ProjectSchema,
  tags: z.array(TagSchema),
})

export type ProjectDetail = z.infer<typeof ProjectDetailSchema>
