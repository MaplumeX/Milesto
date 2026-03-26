import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProjectProgressControl, ProjectProgressIndicator } from '../../src/features/projects/ProjectProgressControl'

describe('ProjectProgressControl', () => {
  it('renders a button with an a11y label', () => {
    const { getByRole } = render(
      <ProjectProgressControl status="open" doneCount={1} totalCount={2} size="list" onActivate={() => {}} />
    )

    expect(getByRole('button', { name: 'aria.projectProgressOpen' })).toBeInTheDocument()
  })

  it('renders done state with a done a11y label', () => {
    const { getByRole } = render(
      <ProjectProgressControl status="done" doneCount={0} totalCount={0} size="list" onActivate={() => {}} />
    )

    expect(getByRole('button', { name: 'aria.projectProgressDone' })).toBeInTheDocument()
  })

  it('renders cancelled state with a cancelled a11y label', () => {
    const { getByRole } = render(
      <ProjectProgressControl
        status="cancelled"
        doneCount={0}
        totalCount={0}
        size="list"
        onActivate={() => {}}
      />
    )

    expect(getByRole('button', { name: 'aria.projectProgressCancelled' })).toBeInTheDocument()
  })
})

describe('ProjectProgressIndicator', () => {
  it('renders none progress as an empty indicator (no --ppc-angle)', () => {
    const { container } = render(<ProjectProgressIndicator status="open" doneCount={0} totalCount={0} size="list" />)
    const el = container.querySelector<HTMLSpanElement>('span.project-progress-control')
    expect(el).not.toBeNull()
    expect(el?.dataset.progress).toBe('none')
    expect(el?.classList.contains('is-done')).toBe(false)
    expect(el?.style.getPropertyValue('--ppc-angle')).toBe('')
  })

  it('renders partial progress with an inline --ppc-angle style', () => {
    const { container } = render(<ProjectProgressIndicator status="open" doneCount={2} totalCount={5} size="list" />)
    const el = container.querySelector<HTMLSpanElement>('span.project-progress-control')
    expect(el).not.toBeNull()
    expect(el?.dataset.progress).toBe('partial')
    expect(el?.style.getPropertyValue('--ppc-angle')).toBe('144deg')
  })

  it('renders full progress without an inline --ppc-angle style (CSS sets 360deg)', () => {
    const { container } = render(<ProjectProgressIndicator status="open" doneCount={3} totalCount={3} size="list" />)
    const el = container.querySelector<HTMLSpanElement>('span.project-progress-control')
    expect(el).not.toBeNull()
    expect(el?.dataset.progress).toBe('full')
    expect(el?.style.getPropertyValue('--ppc-angle')).toBe('')
  })

  it('renders done progress with a check icon and done styling', () => {
    const { container } = render(<ProjectProgressIndicator status="done" doneCount={0} totalCount={0} size="list" />)
    const el = container.querySelector<HTMLSpanElement>('span.project-progress-control')
    expect(el).not.toBeNull()
    expect(el?.dataset.progress).toBe('done')
    expect(el?.classList.contains('is-done')).toBe(true)
    expect(el?.querySelector('svg')).not.toBeNull()
  })

  it('renders cancelled progress with an x icon and cancelled styling', () => {
    const { container } = render(
      <ProjectProgressIndicator status="cancelled" doneCount={0} totalCount={0} size="list" />
    )
    const el = container.querySelector<HTMLSpanElement>('span.project-progress-control')
    expect(el).not.toBeNull()
    expect(el?.dataset.progress).toBe('cancelled')
    expect(el?.classList.contains('is-cancelled')).toBe(true)
    expect(el?.querySelector('svg')).not.toBeNull()
  })
})
