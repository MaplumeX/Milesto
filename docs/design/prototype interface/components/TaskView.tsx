import React, { useState } from 'react';
import { Star, Plus, Calendar, ArrowRight, Search } from 'lucide-react';
import { Task } from '../types';
import { TaskItem } from './TaskItem';

interface TaskViewProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onAdd: (text: string) => void;
}

export const TaskView: React.FC<TaskViewProps> = ({ tasks, onToggle, onAdd }) => {
  const [newTaskText, setNewTaskText] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTaskText.trim()) {
      onAdd(newTaskText.trim());
      setNewTaskText('');
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-8 pt-12 max-w-3xl mx-auto w-full">
          {/* Header */}
          <header className="flex items-center gap-3 mb-8 select-none">
            <div className="relative">
                <Star className="text-yellow-500 fill-yellow-500" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white tracking-tight">Today</h1>
          </header>

          {/* Task List */}
          <div className="space-y-1">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} onToggle={onToggle} />
            ))}

            {/* Inline Add Task Input */}
            <div className="group flex items-center gap-4 py-2 px-1 opacity-60 hover:opacity-100 focus-within:opacity-100 transition-all cursor-text">
                <div className="w-[18px] h-[18px] flex items-center justify-center">
                   <Plus size={18} className="text-gray-400 dark:text-gray-500" />
                </div>
                <input 
                    type="text" 
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add task..."
                    className="bg-transparent border-none outline-none text-[15px] placeholder-gray-400 dark:placeholder-gray-600 text-gray-700 dark:text-gray-300 w-full"
                />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Toolbar */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-8 h-12 flex items-center justify-center gap-12 text-gray-400 dark:text-gray-600 shrink-0 bg-white dark:bg-gray-900 z-10">
        <ToolButton icon={Plus} label="Add New Task" active />
        <ToolButton icon={Calendar} label="Schedule" />
        <ToolButton icon={ArrowRight} label="Move" />
        <ToolButton icon={Search} label="Search" />
      </div>
    </>
  );
};

const ToolButton = ({ icon: Icon, label, active }: { icon: any, label: string, active?: boolean }) => (
  <button 
    className={`transition-colors ${active ? 'hover:text-blue-500 dark:hover:text-blue-400' : 'hover:text-gray-800 dark:hover:text-gray-200'}`} 
    title={label}
  >
    <Icon size={20} strokeWidth={2} />
  </button>
);