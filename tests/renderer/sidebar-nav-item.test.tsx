import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { SidebarNavItem } from '../../src/app/SidebarNavItem'

describe('SidebarNavItem', () => {
  it('renders a decorative icon for fixed navigation entries', () => {
    const { container } = render(
      <MemoryRouter>
        <SidebarNavItem to="/inbox" label="收集箱" iconKey="inbox" />
      </MemoryRouter>
    )

    const link = screen.getByRole('link', { name: '收集箱' })
    expect(link).toHaveAttribute('href', '/inbox')

    const icon = container.querySelector<HTMLElement>('.nav-item-icon[data-nav-icon-key="inbox"]')
    expect(icon).not.toBeNull()
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(icon?.querySelector('svg')).not.toBeNull()
  })

  it('does not render an icon container when iconKey is omitted', () => {
    const { container } = render(
      <MemoryRouter>
        <SidebarNavItem to="/settings" label="设置" />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: '设置' })).toHaveAttribute('href', '/settings')
    expect(container.querySelector('.nav-item-icon')).toBeNull()
  })

  it('renders the today icon from lucide-react', () => {
    const { container } = render(
      <MemoryRouter>
        <SidebarNavItem to="/today" label="今天" iconKey="today" />
      </MemoryRouter>
    )

    const todayIcon = container.querySelector<HTMLElement>('.nav-item-icon[data-nav-icon-key="today"]')
    expect(todayIcon?.querySelector('svg')).not.toBeNull()
  })

  it('renders the someday icon from lucide-react', () => {
    const { container } = render(
      <MemoryRouter>
        <SidebarNavItem to="/someday" label="某天" iconKey="someday" />
      </MemoryRouter>
    )

    const somedayIcon = container.querySelector<HTMLElement>('.nav-item-icon[data-nav-icon-key="someday"]')
    expect(somedayIcon?.querySelector('svg')).not.toBeNull()
  })
})
