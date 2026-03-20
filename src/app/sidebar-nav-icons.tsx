import type { ReactNode } from 'react'

type SidebarNavIconDefinition = {
  icon: ReactNode
  toneClassName: string
}

const SIDEBAR_NAV_ICON_DEFINITIONS = {
  inbox: {
    toneClassName: 'nav-item-icon--inbox',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 7.5c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2z" />
        <path d="M4 14h4l2 3h4l2-3h4" />
      </svg>
    ),
  },
  today: {
    toneClassName: 'nav-item-icon--today',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 8.5v3.5l2.75 1.75" />
        <circle cx="12" cy="12" r="8" />
      </svg>
    ),
  },
  upcoming: {
    toneClassName: 'nav-item-icon--upcoming',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16" />
      </svg>
    ),
  },
  anytime: {
    toneClassName: 'nav-item-icon--anytime',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 4c4.4 0 8 3.6 8 8s-3.6 8-8 8-8-3.6-8-8 3.6-8 8-8z" />
        <path d="M4 12h16M12 4c2.7 2.4 4.2 5.1 4.2 8S14.7 17.6 12 20c-2.7-2.4-4.2-5.1-4.2-8S9.3 6.4 12 4z" />
      </svg>
    ),
  },
  someday: {
    toneClassName: 'nav-item-icon--someday',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 6.5v10.5" />
        <path d="M8.5 10 12 6.5 15.5 10" />
        <path d="M7.5 17h9" />
      </svg>
    ),
  },
  logbook: {
    toneClassName: 'nav-item-icon--logbook',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    ),
  },
  trash: {
    toneClassName: 'nav-item-icon--trash',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 7h16" />
        <path d="M9 7V5h6v2" />
        <path d="M8 10v7M12 10v7M16 10v7" />
        <path d="M6 7l1 12h10l1-12" />
      </svg>
    ),
  },
} satisfies Record<string, SidebarNavIconDefinition>

export type SidebarNavIconKey = keyof typeof SIDEBAR_NAV_ICON_DEFINITIONS

export function getSidebarNavIconDefinition(iconKey: SidebarNavIconKey): SidebarNavIconDefinition {
  return SIDEBAR_NAV_ICON_DEFINITIONS[iconKey]
}
