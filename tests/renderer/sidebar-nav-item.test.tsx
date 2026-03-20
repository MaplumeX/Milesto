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

  it('keeps the today clock hands inside the dial', () => {
    const { container } = render(
      <MemoryRouter>
        <SidebarNavItem to="/today" label="今天" iconKey="today" />
      </MemoryRouter>
    )

    const todayIcon = container.querySelector<HTMLElement>('.nav-item-icon[data-nav-icon-key="today"]')
    const handPath = todayIcon?.querySelector('path')

    expect(handPath).not.toBeNull()
    expect(handPath).toHaveAttribute('d', 'M12 8.5v3.5l2.75 1.75')
  })

  it('renders the someday icon as a future anchor without the shaft crossing the baseline', () => {
    const { container } = render(
      <MemoryRouter>
        <SidebarNavItem to="/someday" label="某天" iconKey="someday" />
      </MemoryRouter>
    )

    const somedayIcon = container.querySelector<HTMLElement>('.nav-item-icon[data-nav-icon-key="someday"]')
    const paths = somedayIcon?.querySelectorAll('path')

    expect(paths).toHaveLength(3)
    expect(paths?.[0]).toHaveAttribute('d', 'M12 6.5v10.5')
    expect(paths?.[1]).toHaveAttribute('d', 'M8.5 10 12 6.5 15.5 10')
    expect(paths?.[2]).toHaveAttribute('d', 'M7.5 17h9')
  })
})
