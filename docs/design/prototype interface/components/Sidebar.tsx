import React from 'react';
import { 
  Inbox, 
  Star, 
  CalendarDays, 
  Layers, 
  Package, 
  CheckSquare, 
  Trash2,
  Plus,
  Settings2,
  Circle
} from 'lucide-react';
import { NavItem } from '../types';

interface SidebarProps {
  activeId: string;
  onNavigate: (id: string) => void;
  taskCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeId, onNavigate, taskCount }) => {
  const mainNavItems: NavItem[] = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, color: 'text-blue-500' },
    { id: 'today', label: 'Today', icon: Star, count: taskCount, color: 'text-yellow-500' },
    { id: 'upcoming', label: 'Upcoming', icon: CalendarDays, color: 'text-red-500' },
    { id: 'anytime', label: 'Anytime', icon: Layers, color: 'text-teal-500' },
    { id: 'someday', label: 'Someday', icon: Package, color: 'text-amber-600' },
  ];

  const secondaryNavItems: NavItem[] = [
    { id: 'logbook', label: 'Logbook', icon: CheckSquare, color: 'text-green-500' },
    { id: 'trash', label: 'Trash', icon: Trash2, color: 'text-gray-400' },
  ];

  return (
    <aside className="w-64 bg-gray-50 dark:bg-gray-800/50 flex flex-col border-r border-gray-200 dark:border-gray-800/50">
      {/* Window Controls (Visual only) */}
      <div className="p-5 flex space-x-2">
        <div className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors shadow-sm"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-400 hover:bg-yellow-500 transition-colors shadow-sm"></div>
        <div className="w-3 h-3 rounded-full bg-green-400 hover:bg-green-500 transition-colors shadow-sm"></div>
      </div>

      <nav className="flex-1 px-3 space-y-6 mt-2 overflow-y-auto">
        {/* Main Group */}
        <div className="space-y-0.5">
          {mainNavItems.map((item) => (
            <NavButton 
              key={item.id} 
              item={item} 
              isActive={activeId === item.id} 
              onClick={() => onNavigate(item.id)} 
            />
          ))}
        </div>

        {/* Secondary Group */}
        <div className="space-y-0.5">
          {secondaryNavItems.map((item) => (
            <NavButton 
              key={item.id} 
              item={item} 
              isActive={activeId === item.id} 
              onClick={() => onNavigate(item.id)} 
            />
          ))}
        </div>

        {/* Projects Group */}
        <div className="space-y-1 pt-2">
           <div className="flex items-center gap-3 px-3 py-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer">
            <Circle size={14} />
            <span className="text-sm font-medium">New Project</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer">
             <Circle size={14} className="opacity-40" />
             <span className="text-sm">Work</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer">
             <Circle size={14} className="opacity-40" />
             <span className="text-sm">Personal</span>
          </div>
        </div>
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-gray-500 dark:text-gray-400">
        <button className="flex items-center gap-2 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
          <Plus size={18} />
          <span className="text-sm font-medium">New List</span>
        </button>
        <button className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
          <Settings2 size={18} />
        </button>
      </div>
    </aside>
  );
};

interface NavButtonProps {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ item, isActive, onClick }) => {
  const Icon = item.icon;
  
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-all duration-200 group
        ${isActive 
          ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold' 
          : 'text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
        }
      `}
    >
      <div className="flex items-center gap-3">
        <Icon 
            size={18} 
            className={`
                transition-colors 
                ${isActive ? (item.color || 'text-gray-900') : item.color}
                ${isActive && item.id === 'today' ? 'fill-current' : ''}
            `}
            strokeWidth={isActive ? 2.5 : 2}
        />
        <span>{item.label}</span>
      </div>
      {item.count !== undefined && item.count > 0 && (
        <span className={`text-xs font-medium ${isActive ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}`}>
          {item.count}
        </span>
      )}
    </button>
  );
}