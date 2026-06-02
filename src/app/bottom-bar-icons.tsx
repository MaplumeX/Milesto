import type { ReactNode } from 'react'
import { CirclePlus, FolderPlus, ListPlus, Calendar, ArrowRightLeft, Search, Trash2, Ellipsis } from 'lucide-react'

type BottomBarIconDefinition = {
  icon: ReactNode
}

const BOTTOM_BAR_ICON_DEFINITIONS = {
  task: {
    icon: <CirclePlus strokeWidth={1.8} />,
  },
  project: {
    icon: <FolderPlus strokeWidth={1.8} />,
  },
  section: {
    icon: <ListPlus strokeWidth={1.8} />,
  },
  schedule: {
    icon: <Calendar strokeWidth={1.8} />,
  },
  move: {
    icon: <ArrowRightLeft strokeWidth={1.8} />,
  },
  search: {
    icon: <Search strokeWidth={1.8} />,
  },
  delete: {
    icon: <Trash2 strokeWidth={1.8} />,
  },
  more: {
    icon: <Ellipsis />,
  },
} satisfies Record<string, BottomBarIconDefinition>

export type BottomBarIconKey = keyof typeof BOTTOM_BAR_ICON_DEFINITIONS

export function getBottomBarIconDefinition(iconKey: BottomBarIconKey): BottomBarIconDefinition {
  return BOTTOM_BAR_ICON_DEFINITIONS[iconKey]
}
