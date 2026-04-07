export interface Task {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  duration: number;
  category: string;
  completions: Record<string, boolean>;
  userId: string;
  createdAt: string;
  isArchived?: boolean;
  reminderType?: 'none' | 'browser' | 'email' | 'both';
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface UserSettings {
  theme: 'light' | 'dark';
  categories: Category[];
  notificationsEnabled: boolean;
  emailRemindersEnabled: boolean;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'work', name: 'عمل', color: '#4f46e5' },
  { id: 'health', name: 'صحة', color: '#10b981' },
  { id: 'personal', name: 'شخصي', color: '#f59e0b' },
  { id: 'study', name: 'دراسة', color: '#8b5cf6' },
  { id: 'other', name: 'أخرى', color: '#64748b' },
];
