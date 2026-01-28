import React from 'react';
import { Check } from 'lucide-react';
import { Task } from '../types';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle }) => {
  return (
    <div className="group flex items-start gap-4 py-2 px-1 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
      
      {/* Custom Checkbox */}
      <div className="pt-0.5 relative flex items-center justify-center">
        <input 
          type="checkbox" 
          checked={task.completed}
          onChange={() => onToggle(task.id)}
          className="peer appearance-none w-[18px] h-[18px] border-[1.5px] border-gray-300 dark:border-gray-600 rounded-[4px] cursor-pointer transition-all checked:bg-blue-500 checked:border-blue-500"
        />
        <Check 
            size={12} 
            className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity stroke-[3]" 
        />
      </div>

      {/* Task Text */}
      <span 
        className={`
          text-[15px] leading-relaxed cursor-default flex-1 transition-colors
          ${task.completed 
            ? 'text-gray-400 dark:text-gray-600 line-through' 
            : 'text-gray-800 dark:text-gray-200'
          }
        `}
        onClick={() => onToggle(task.id)}
      >
        {task.text}
      </span>
    </div>
  );
};