import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TaskView } from './components/TaskView';
import { Moon, Sun, PanelRightClose } from 'lucide-react';
import { Task } from './types';

const INITIAL_TASKS: Task[] = [
  { id: '1', text: 'New task item', completed: false },
  { id: '2', text: 'Draft proposal for design system', completed: false },
  { id: '3', text: 'Quick workout session', completed: false },
];

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [activeNav, setActiveNav] = useState('today');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    ));
  };

  const addTask = (text: string) => {
    const newTask: Task = {
      id: Date.now().toString(),
      text,
      completed: false
    };
    setTasks(prev => [...prev, newTask]);
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 lg:p-8 transition-colors duration-300">
      
      {/* Background Gradient Layer */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-tr from-gray-100 to-gray-200 dark:from-gray-900 dark:to-black"></div>

      {/* Main Window Card */}
      <div className="w-full max-w-6xl h-[85vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex overflow-hidden border border-gray-200 dark:border-gray-800 relative ring-1 ring-black/5">
        
        {/* Sidebar */}
        <Sidebar activeId={activeNav} onNavigate={setActiveNav} taskCount={tasks.filter(t => !t.completed).length} />

        {/* Main Content */}
        <main className="flex-1 flex flex-col bg-white dark:bg-gray-900 relative">
          <TaskView 
            tasks={tasks} 
            onToggle={toggleTask} 
            onAdd={addTask}
          />
        </main>

        {/* Floating Controls (Top Right) */}
        <div className="absolute top-4 right-4 flex gap-2">
            <button 
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors"
                title="Toggle Dark Mode"
            >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button 
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors"
            >
                <PanelRightClose size={18} />
            </button>
        </div>
      </div>
    </div>
  );
}