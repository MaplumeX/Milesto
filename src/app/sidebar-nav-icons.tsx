import type { ReactNode } from 'react'
import { Inbox, Clock, Calendar, Globe, ArrowUpFromLine, Notebook, Trash2 } from 'lucide-react'

type SidebarNavIconDefinition = {
  icon: ReactNode
  toneClassName: string
}

const SIDEBAR_NAV_ICON_DEFINITIONS = {
  inbox: {
    toneClassName: 'nav-item-icon--inbox',
    icon: <Inbox strokeWidth={1.8} />,
  },
  today: {
    toneClassName: 'nav-item-icon--today',
    icon: <Clock strokeWidth={1.8} />,
  },
  upcoming: {
    toneClassName: 'nav-item-icon--upcoming',
    icon: <Calendar strokeWidth={1.8} />,
  },
  anytime: {
    toneClassName: 'nav-item-icon--anytime',
    icon: <Globe strokeWidth={1.8} />,
  },
  someday: {
    toneClassName: 'nav-item-icon--someday',
    icon: <ArrowUpFromLine strokeWidth={1.8} />,
  },
  logbook: {
    toneClassName: 'nav-item-icon--logbook',
    icon: <Notebook strokeWidth={1.8} />,
  },
  trash: {
    toneClassName: 'nav-item-icon--trash',
    icon: <Trash2 strokeWidth={1.8} />,
  },
} satisfies Record<string, SidebarNavIconDefinition>

export type SidebarNavIconKey = keyof typeof SIDEBAR_NAV_ICON_DEFINITIONS

export function getSidebarNavIconDefinition(iconKey: SidebarNavIconKey): SidebarNavIconDefinition {
  return SIDEBAR_NAV_ICON_DEFINITIONS[iconKey]
}
