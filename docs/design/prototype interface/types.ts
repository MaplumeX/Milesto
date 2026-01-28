import { LucideIcon } from "lucide-react";

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  color?: string; // Tailwind text color class
}

export interface ProjectItem {
  id: string;
  label: string;
  type: 'project' | 'area';
}