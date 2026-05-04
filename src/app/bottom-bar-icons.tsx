import type { ReactNode } from 'react'
import {
  CirclePlus,
  FolderPlus,
  ListPlus,
  Calendar,
  ArrowRightLeft,
  Search,
  Trash2,
  Ellipsis,
} from 'lucide-react'

type BottomBarIconDefinition = {
  icon: ReactNode
}

const BOTTOM_BAR_ICON_DEFINITIONS = {
  task: {
    icon: <CirclePlus />,
  },
  project: {
    icon: <FolderPlus />,
  },
  section: {
    icon: <ListPlus />,
  },
  schedule: {
    icon: <Calendar />,
  },
  move: {
    icon: <ArrowRightLeft />,
  },
  search: {
    icon: <Search />,
  },
  delete: {
    icon: <Trash2 />,
  },
  more: {
    icon: <Ellipsis />,
  },
} satisfies Record<string, BottomBarIconDefinition>

export type BottomBarIconKey = keyof typeof BOTTOM_BAR_ICON_DEFINITIONS

export function getBottomBarIconDefinition(iconKey: BottomBarIconKey): BottomBarIconDefinition {
  return BOTTOM_BAR_ICON_DEFINITIONS[iconKey]
}
