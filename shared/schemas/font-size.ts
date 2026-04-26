import { z } from 'zod'

export const BASE_ROOT_FONT_SIZE_PX = 12
export const DEFAULT_FONT_SIZE_STEP = 0

export const FONT_SIZE_STEPS = [-3, -2, -1, 0, 1, 2, 3] as const
export const FONT_SIZE_STEP_MIN = FONT_SIZE_STEPS[0]
export const FONT_SIZE_STEP_MAX = FONT_SIZE_STEPS[FONT_SIZE_STEPS.length - 1]

export const FONT_SIZE_SCALE_PERCENT_BY_STEP = {
  [-3]: 88,
  [-2]: 94,
  [-1]: 97,
  0: 100,
  1: 106,
  2: 116,
  3: 126,
} as const satisfies Record<(typeof FONT_SIZE_STEPS)[number], number>

export const FontSizeStepSchema = z.union([
  z.literal(-3),
  z.literal(-2),
  z.literal(-1),
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
])
export type FontSizeStep = z.infer<typeof FontSizeStepSchema>

export const FontSizeStateSchema = z.object({
  step: FontSizeStepSchema,
})
export type FontSizeState = z.infer<typeof FontSizeStateSchema>
