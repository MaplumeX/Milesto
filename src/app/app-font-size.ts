import {
  BASE_ROOT_FONT_SIZE_PX,
  DEFAULT_FONT_SIZE_STEP,
  FONT_SIZE_SCALE_PERCENT_BY_STEP,
  FontSizeStepSchema,
  type FontSizeStep,
} from '../../shared/schemas'

export function getRootFontSizePx(step: FontSizeStep): string {
  const percent = FONT_SIZE_SCALE_PERCENT_BY_STEP[step]
  return `${(BASE_ROOT_FONT_SIZE_PX * percent) / 100}px`
}

export function applyAppFontSize(step: FontSizeStep, root: HTMLElement = document.documentElement) {
  const parsed = FontSizeStepSchema.safeParse(step)
  const safeStep = parsed.success ? parsed.data : DEFAULT_FONT_SIZE_STEP

  root.style.fontSize = getRootFontSizePx(safeStep)
  root.dataset.fontSizeStep = String(safeStep)
}
