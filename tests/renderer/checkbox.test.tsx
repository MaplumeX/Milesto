import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Checkbox } from '../../src/components/Checkbox'

afterEach(() => {
  cleanup()
})

function ControlledCheckbox({
  ariaLabel,
  children,
  disabled = false,
}: {
  ariaLabel?: string
  children?: React.ReactNode
  disabled?: boolean
}) {
  const [checked, setChecked] = useState(false)

  return (
    <>
      <Checkbox
        checked={checked}
        disabled={disabled}
        ariaLabel={ariaLabel}
        onCheckedChange={(nextChecked) => setChecked(nextChecked)}
      >
        {children}
      </Checkbox>
      <output data-testid="checked-state">{checked ? 'checked' : 'unchecked'}</output>
    </>
  )
}

describe('Checkbox', () => {
  it('toggles when clicking its visible label content', async () => {
    const user = userEvent.setup()

    render(<ControlledCheckbox>Include logbook</ControlledCheckbox>)

    const checkbox = screen.getByRole('checkbox', { name: 'Include logbook' })
    expect(checkbox).not.toBeChecked()

    await user.click(screen.getByText('Include logbook'))

    expect(checkbox).toBeChecked()
    expect(screen.getByTestId('checked-state')).toHaveTextContent('checked')
  })

  it('supports aria labels when rendered without visible text', () => {
    render(<ControlledCheckbox ariaLabel="Mark task done" />)

    expect(screen.getByRole('checkbox', { name: 'Mark task done' })).toBeInTheDocument()
  })

  it('does not toggle when disabled', async () => {
    const user = userEvent.setup()

    render(<ControlledCheckbox disabled>Disabled checkbox</ControlledCheckbox>)

    const checkbox = screen.getByRole('checkbox', { name: 'Disabled checkbox' })
    await user.click(screen.getByText('Disabled checkbox'))

    expect(checkbox).not.toBeChecked()
    expect(screen.getByTestId('checked-state')).toHaveTextContent('unchecked')
  })
})
