import type { ReactNode } from 'react'

type BottomBarIconDefinition = {
  icon: ReactNode
}

const BOTTOM_BAR_ICON_DEFINITIONS = {
  task: {
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
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
  project: {
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
        <path d="M4 8.5c0-1.1.9-2 2-2h4l1.3 1.5H18c1.1 0 2 .9 2 2v6.5c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2z" />
        <path d="M15.5 10.5v5M13 13h5" />
      </svg>
    ),
  },
  section: {
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
        <path d="M5 7h9M5 12h7M5 17h9" />
        <path d="M17 10v6M14 13h6" />
      </svg>
    ),
  },
  schedule: {
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
  move: {
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
        <path d="M5 8h12" />
        <path d="m13 4 4 4-4 4" />
        <path d="M19 16H7" />
        <path d="m11 12-4 4 4 4" />
      </svg>
    ),
  },
  search: {
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
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
    ),
  },
  delete: {
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
  more: {
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="6.5" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="17.5" cy="12" r="1.6" />
      </svg>
    ),
  },
} satisfies Record<string, BottomBarIconDefinition>

export type BottomBarIconKey = keyof typeof BOTTOM_BAR_ICON_DEFINITIONS

export function getBottomBarIconDefinition(iconKey: BottomBarIconKey): BottomBarIconDefinition {
  return BOTTOM_BAR_ICON_DEFINITIONS[iconKey]
}
