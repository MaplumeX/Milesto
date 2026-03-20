import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BottomBarActionButton } from '../../src/app/BottomBarActionButton'

describe('BottomBarActionButton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders an icon-only button with a separate hover tooltip label', () => {
    const { container } = render(<BottomBarActionButton label="搜索" iconKey="search" />)

    const button = screen.getByRole('button', { name: '搜索' })
    expect(button).not.toHaveAttribute('title')
    expect(button.textContent).toBe('')
    expect(button.querySelector('svg')).not.toBeNull()

    const tooltip = screen.getByText('搜索')
    expect(tooltip).toHaveClass('content-bottom-action-tooltip')
    expect(tooltip).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.content-bottom-action')).toContainElement(button)
    expect(container.querySelector('.content-bottom-action')).toContainElement(tooltip)
  })

  it('shows the tooltip after a hover delay and suppresses it after click until mouse leave', async () => {
    const { container } = render(<BottomBarActionButton label="搜索" iconKey="search" />)

    const wrapper = container.querySelector('.content-bottom-action')
    const button = screen.getByRole('button', { name: '搜索' })

    expect(wrapper).toHaveAttribute('data-tooltip-visible', 'false')

    fireEvent.mouseEnter(wrapper!)
    await vi.advanceTimersByTimeAsync(349)
    expect(wrapper).toHaveAttribute('data-tooltip-visible', 'false')

    await vi.advanceTimersByTimeAsync(1)
    expect(wrapper).toHaveAttribute('data-tooltip-visible', 'true')

    fireEvent.pointerDown(button)
    fireEvent.click(button)
    expect(wrapper).toHaveAttribute('data-tooltip-visible', 'false')

    await vi.advanceTimersByTimeAsync(400)
    expect(wrapper).toHaveAttribute('data-tooltip-visible', 'false')

    fireEvent.mouseLeave(wrapper!)
    fireEvent.mouseEnter(wrapper!)
    await vi.advanceTimersByTimeAsync(350)
    expect(wrapper).toHaveAttribute('data-tooltip-visible', 'true')
  })

  it('still shows the tooltip when the button is disabled', async () => {
    const { container } = render(<BottomBarActionButton label="计划" iconKey="schedule" disabled />)

    const wrapper = container.querySelector('.content-bottom-action')
    const button = screen.getByRole('button', { name: '计划' })

    expect(button).toBeDisabled()
    expect(wrapper).toHaveAttribute('data-tooltip-visible', 'false')

    fireEvent.mouseEnter(wrapper!)
    await vi.advanceTimersByTimeAsync(350)

    expect(wrapper).toHaveAttribute('data-tooltip-visible', 'true')

    fireEvent.mouseLeave(wrapper!)
    expect(wrapper).toHaveAttribute('data-tooltip-visible', 'false')
  })
})
