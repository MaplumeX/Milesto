import { NavLink } from 'react-router-dom'

import { getSidebarNavIconDefinition, type SidebarNavIconKey } from './sidebar-nav-icons'

export function SidebarNavItem({
  to,
  label,
  iconKey,
  indent,
  count,
}: {
  to: string
  label: string
  iconKey?: SidebarNavIconKey
  indent?: boolean
  count?: number
}) {
  const iconDefinition = iconKey ? getSidebarNavIconDefinition(iconKey) : null

  return (
    <NavLink
      className={({ isActive }) =>
        `nav-item${isActive ? ' is-active' : ''}${indent ? ' is-indent' : ''}`
      }
      to={to}
    >
      <span className="nav-item-content">
        {iconDefinition ? (
          <span
            className={`nav-item-icon ${iconDefinition.toneClassName}`}
            data-nav-icon-key={iconKey}
            aria-hidden="true"
          >
            {iconDefinition.icon}
          </span>
        ) : null}
        <span className="nav-item-label">{label}</span>
        {count !== undefined && count > 0 ? (
          <span className="nav-item-count">{count}</span>
        ) : null}
      </span>
    </NavLink>
  )
}
