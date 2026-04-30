import { readFileSync } from 'node:fs'
import path from 'node:path'

import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProjectProgressControl, ProjectProgressIndicator } from '../../src/features/projects/ProjectProgressControl'

const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8')
const originalMatchMedia = window.matchMedia
const originalRequestAnimationFrame = window.requestAnimationFrame
const originalCancelAnimationFrame = window.cancelAnimationFrame

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string): MediaQueryList => {
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
    }),
  })
}

function mockAnimationFrame() {
  let nextFrameId = 0
  const frames = new Map<number, FrameRequestCallback>()

  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    writable: true,
    value: vi.fn((callback: FrameRequestCallback) => {
      const frameId = ++nextFrameId
      frames.set(frameId, callback)
      return frameId
    }),
  })
  Object.defineProperty(window, 'cancelAnimationFrame', {
    configurable: true,
    writable: true,
    value: vi.fn((frameId: number) => {
      frames.delete(frameId)
    }),
  })

  return {
    runNextFrame(timestamp: number) {
      const [frame] = frames.values()
      frames.clear()
      frame?.(timestamp)
    },
  }
}

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  })
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    writable: true,
    value: originalRequestAnimationFrame,
  })
  Object.defineProperty(window, 'cancelAnimationFrame', {
    configurable: true,
    writable: true,
    value: originalCancelAnimationFrame,
  })
})

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
  it('keeps the SVG fill inset so the border gap stays centered', () => {
    const svgRule = css.match(/\.project-progress-svg\s*\{[^}]*\}/)?.[0]
    expect(svgRule).toContain('inset: var(--ppc-gap);')
    expect(svgRule).toContain('width: calc(100% - (var(--ppc-gap) * 2));')
    expect(svgRule).toContain('height: calc(100% - (var(--ppc-gap) * 2));')
    expect(svgRule).not.toMatch(/top:|left:|--ppc-fill-size/)
    expect(css).not.toContain('stroke-dasharray')
  })

  it('does not rely on CSS path morphing for progress changes', () => {
    expect(css).not.toContain('--ppc-sector-path')
    expect(css).not.toMatch(/\bd\s*:\s*var\(/)
    expect(css).not.toMatch(/transition:\s*d\b/)
  })

  it('renders none progress as an empty SVG indicator', () => {
    const { container } = render(<ProjectProgressIndicator status="open" doneCount={0} totalCount={0} size="list" />)
    const el = container.querySelector<HTMLSpanElement>('span.project-progress-control')
    expect(el).not.toBeNull()
    expect(el?.dataset.progress).toBe('none')
    expect(el?.classList.contains('is-done')).toBe(false)
    expect(el?.querySelector('.project-progress-svg')).not.toBeNull()
    expect(el?.querySelector('.project-progress-fill')).toBeNull()
  })

  it('renders half progress as an exact SVG semicircle sector', () => {
    const { container } = render(<ProjectProgressIndicator status="open" doneCount={1} totalCount={2} size="list" />)
    const el = container.querySelector<HTMLSpanElement>('span.project-progress-control')
    const sector = el?.querySelector<SVGPathElement>('.project-progress-sector')
    expect(el).not.toBeNull()
    expect(el?.dataset.progress).toBe('partial')
    expect(sector).not.toBeNull()
    expect(sector?.getAttribute('d')).toBe('M 10 10 L 10 0 A 10 10 0 0 1 10 20 Z')
    expect(sector?.getAttribute('stroke-dasharray')).toBeNull()
  })

  it('updates partial progress immediately when reduced motion is active', () => {
    mockReducedMotion(true)
    const { container, rerender } = render(
      <ProjectProgressIndicator status="open" doneCount={1} totalCount={4} size="list" />
    )

    rerender(<ProjectProgressIndicator status="open" doneCount={2} totalCount={4} size="list" />)

    const sector = container.querySelector<SVGPathElement>('.project-progress-sector')
    expect(sector).not.toBeNull()
    expect(sector?.getAttribute('d')).toBe('M 10 10 L 10 0 A 10 10 0 0 1 10 20 Z')
  })

  it('animates progress updates by recomputing fixed-radius SVG sectors', () => {
    mockReducedMotion(false)
    const animationFrame = mockAnimationFrame()
    const { container, rerender } = render(
      <ProjectProgressIndicator status="open" doneCount={1} totalCount={4} size="list" />
    )

    rerender(<ProjectProgressIndicator status="open" doneCount={2} totalCount={4} size="list" />)
    act(() => {
      animationFrame.runNextFrame(0)
      animationFrame.runNextFrame(80)
    })

    const sector = container.querySelector<SVGPathElement>('.project-progress-sector')
    expect(sector).not.toBeNull()
    expect(sector?.getAttribute('d')).toContain('A 10 10')
    expect(sector?.getAttribute('d')).toMatch(/^M 10 10 L 10 0 A 10 10 0 [01] 1 /)
    expect(sector?.getAttribute('stroke-dasharray')).toBeNull()
  })

  it('renders open full progress as a full SVG fill without terminal icons', () => {
    const { container } = render(<ProjectProgressIndicator status="open" doneCount={3} totalCount={3} size="list" />)
    const el = container.querySelector<HTMLSpanElement>('span.project-progress-control')
    const fill = el?.querySelector<SVGCircleElement>('.project-progress-full')
    expect(el).not.toBeNull()
    expect(el?.dataset.progress).toBe('full')
    expect(fill).not.toBeNull()
    expect(fill?.getAttribute('cx')).toBe('10')
    expect(fill?.getAttribute('cy')).toBe('10')
    expect(fill?.getAttribute('r')).toBe('10')
    expect(fill?.getAttribute('stroke-dasharray')).toBeNull()
    expect(el?.querySelectorAll('svg')).toHaveLength(1)
  })

  it('renders done progress with a check icon and done styling', () => {
    const { container } = render(<ProjectProgressIndicator status="done" doneCount={0} totalCount={0} size="list" />)
    const el = container.querySelector<HTMLSpanElement>('span.project-progress-control')
    const fill = el?.querySelector<SVGCircleElement>('.project-progress-full')
    expect(el).not.toBeNull()
    expect(el?.dataset.progress).toBe('done')
    expect(el?.classList.contains('is-done')).toBe(true)
    expect(fill).not.toBeNull()
    expect(fill?.getAttribute('stroke-dasharray')).toBeNull()
    expect(el?.querySelectorAll('svg')).toHaveLength(2)
  })

  it('renders cancelled progress with an x icon and cancelled styling', () => {
    const { container } = render(
      <ProjectProgressIndicator status="cancelled" doneCount={0} totalCount={0} size="list" />
    )
    const el = container.querySelector<HTMLSpanElement>('span.project-progress-control')
    expect(el).not.toBeNull()
    expect(el?.dataset.progress).toBe('cancelled')
    expect(el?.classList.contains('is-cancelled')).toBe(true)
    expect(el?.querySelector('.project-progress-fill')).toBeNull()
    expect(el?.querySelectorAll('svg')).toHaveLength(2)
  })
})
