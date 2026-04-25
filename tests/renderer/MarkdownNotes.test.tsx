import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MarkdownNotes } from '../../src/components/MarkdownNotes'

describe('MarkdownNotes', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders placeholder when value is empty', () => {
    render(<MarkdownNotes value="" onChange={vi.fn()} placeholder="Add notes…" />)
    expect(screen.getByText('Add notes…')).toBeInTheDocument()
  })

  it('shows textarea when placeholder is clicked', async () => {
    const user = userEvent.setup()
    render(<MarkdownNotes value="" onChange={vi.fn()} placeholder="Add notes…" />)

    await user.click(screen.getByText('Add notes…'))
    expect(screen.getByPlaceholderText('Add notes…')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Add notes…').tagName.toLowerCase()).toBe('textarea')
  })

  it('shows rendered markdown when blurred', async () => {
    const user = userEvent.setup()
    render(<MarkdownNotes value="**bold** text" onChange={vi.fn()} placeholder="Add notes…" />)

    // Should render markdown initially (not editing)
    expect(screen.getByText('bold')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    // Click to enter edit mode
    await user.click(screen.getByText('bold'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()

    // Blur to exit edit mode
    await user.tab()
    expect(screen.getByText('bold')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('calls onChange when typing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<MarkdownNotes value="" onChange={onChange} placeholder="Add notes…" />)

    await user.click(screen.getByText('Add notes…'))
    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'hi')
    // Simulate controlled component value update after typing
    rerender(<MarkdownNotes value="hi" onChange={onChange} placeholder="Add notes…" />)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenNthCalledWith(1, 'h')
    expect(onChange).toHaveBeenNthCalledWith(2, 'i')
  })

  it('preserves autoFocus behavior', async () => {
    render(<MarkdownNotes value="initial" onChange={vi.fn()} placeholder="Add notes…" autoFocus />)
    const textarea = screen.getByRole('textbox')
    expect(document.activeElement).toBe(textarea)
  })

  it('renders plain text without markdown syntax unchanged', () => {
    render(<MarkdownNotes value="plain text" onChange={vi.fn()} placeholder="Add notes…" />)
    expect(screen.getByText('plain text')).toBeInTheDocument()
  })

  it('renders lists correctly', () => {
    render(<MarkdownNotes value="- item 1&#10;- item 2" onChange={vi.fn()} placeholder="Add notes…" />)
    expect(screen.getByText(/item 1/)).toBeInTheDocument()
    expect(screen.getByText(/item 2/)).toBeInTheDocument()
  })

  it('forwards textareaRef to the textarea element', async () => {
    const user = userEvent.setup()
    const ref = { current: null as HTMLTextAreaElement | null }
    render(
      <MarkdownNotes
        value="test"
        onChange={vi.fn()}
        placeholder="Add notes…"
        textareaRef={ref}
      />
    )

    await user.click(screen.getByText('test'))
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName.toLowerCase()).toBe('textarea')
  })
})
