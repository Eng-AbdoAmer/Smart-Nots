/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  getDoc,
  orderBy,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  logout,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from './firebase';
import { Task, Category, DEFAULT_CATEGORIES, UserSettings } from './types';
import { cn } from './lib/utils';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  LogOut, 
  LogIn, 
  Moon, 
  Sun, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  Tag, 
  BarChart3, 
  ChevronRight, 
  ChevronLeft,
  X,
  MoreVertical,
  Type,
  Bell,
  BellOff,
  AlertCircle,
  Archive,
  ArchiveRestore,
  Inbox,
  Mail,
  MailCheck,
  MailWarning,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import ReactMarkdown from 'react-markdown';

// --- Constants & Helpers ---
const WEEKDAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const getDatesBetween = (startStr: string, duration: number) => {
  const dates: Date[] = [];
  const start = new Date(startStr);
  for (let i = 0; i < duration; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const formatDateLabel = (date: Date) => {
  const weekday = WEEKDAYS_AR[date.getDay()];
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${weekday} ${day}-${month}-${year}`;
};

const getDateKey = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.startsWith('{')) {
        setErrorInfo(event.error.message);
        setHasError(true);
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md border border-red-100">
          <X className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">حدث خطأ في الاتصال</h2>
          <p className="text-gray-600 mb-6">يرجى التحقق من إعدادات Firebase أو صلاحيات الوصول.</p>
          {errorInfo && (
            <pre className="text-xs bg-gray-100 p-4 rounded-lg overflow-auto max-h-40 text-left mb-6">
              {JSON.stringify(JSON.parse(errorInfo), null, 2)}
            </pre>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-6 py-2 rounded-full font-bold hover:bg-red-700 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ 
    theme: 'light', 
    categories: DEFAULT_CATEGORIES, 
    notificationsEnabled: false,
    emailRemindersEnabled: false
  });
  const [isLoading, setIsLoading] = useState(true);
  
  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewArchived, setViewArchived] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ emailConfigured: boolean } | null>(null);
  
  // Auth UI State
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  // Form State
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskStart, setNewTaskStart] = useState(getDateKey(new Date()));
  const [newTaskDuration, setNewTaskDuration] = useState(30);
  const [newTaskCategory, setNewTaskCategory] = useState('personal');
  const [newTaskReminderType, setNewTaskReminderType] = useState<'none' | 'browser' | 'email' | 'both'>('browser');

  // Check email status
  useEffect(() => {
    if (showSettings) {
      fetch('/api/email-status')
        .then(res => res.json())
        .then(data => setEmailStatus(data))
        .catch(() => setEmailStatus({ emailConfigured: false }));
    }
  }, [showSettings]);

  // --- Firebase Auth & Connection Test ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setIsAuthReady(true);
      
      if (u) {
        try {
          // Test connection
          await getDocFromServer(doc(db, 'test', 'connection')).catch(() => {});
          
          // Load settings
          const settingsDoc = await getDoc(doc(db, 'userSettings', u.uid));
          if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            setSettings({ 
              ...data, 
              notificationsEnabled: data.notificationsEnabled ?? false,
              emailRemindersEnabled: data.emailRemindersEnabled ?? false
            } as UserSettings);
          } else {
            const initialSettings: UserSettings = { 
              theme: 'light', 
              categories: DEFAULT_CATEGORIES, 
              notificationsEnabled: false,
              emailRemindersEnabled: false
            };
            await setDoc(doc(db, 'userSettings', u.uid), initialSettings);
            setSettings(initialSettings);
          }
        } catch (err) {
          console.error("Firebase Init Error:", err);
        }
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Notification Logic ---
  const requestNotificationPermission = async () => {
    try {
      if (!('Notification' in window)) {
        showToast('متصفحك لا يدعم التنبيهات.', 'error');
        return;
      }

      // Check if we are in an iframe
      if (window.self !== window.top) {
        showToast('يرجى فتح التطبيق في نافذة جديدة لتفعيل التنبيهات.', 'info');
      }

      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        if (user) {
          await updateDoc(doc(db, 'userSettings', user.uid), { notificationsEnabled: true });
          setSettings(prev => ({ ...prev, notificationsEnabled: true }));
          showToast('تم تفعيل التنبيهات بنجاح!');
        }
      } else {
        showToast('تم رفض إذن التنبيهات. يرجى تفعيلها من إعدادات المتصفح.', 'error');
      }
    } catch (error) {
      console.error("Notification Permission Error:", error);
      showToast('حدث خطأ أثناء طلب إذن التنبيهات.', 'error');
    }
  };

  const toggleEmailReminders = async () => {
    if (!user) return;
    const newValue = !settings.emailRemindersEnabled;
    try {
      await updateDoc(doc(db, 'userSettings', user.uid), { emailRemindersEnabled: newValue });
      setSettings(prev => ({ ...prev, emailRemindersEnabled: newValue }));
      showToast(newValue ? 'تم تفعيل تنبيهات البريد الإلكتروني.' : 'تم إيقاف تنبيهات البريد الإلكتروني.');
    } catch (error) {
      showToast('حدث خطأ أثناء تحديث الإعدادات.', 'error');
    }
  };

  const sendEmailReminder = async (taskName: string, type: 'overdue' | 'today') => {
    if (!user?.email || !settings.emailRemindersEnabled) return false;
    try {
      const res = await fetch('/api/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, taskName, type })
      });
      if (!res.ok) throw new Error('Failed to send');
      return true;
    } catch (error) {
      console.error("Email Reminder Error:", error);
      return false;
    }
  };

  const disableNotifications = async () => {
    if (user) {
      await updateDoc(doc(db, 'userSettings', user.uid), { notificationsEnabled: false });
      setSettings(prev => ({ ...prev, notificationsEnabled: false }));
      showToast('تم إيقاف التنبيهات.');
    }
  };

  const sendNotification = (title: string, body: string) => {
    if (settings.notificationsEnabled && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    } else {
      // Fallback to UI toast if browser notifications are blocked/disabled
      showToast(`${title}: ${body}`);
    }
  };

  // Check for overdue or due soon tasks
  useEffect(() => {
    if (!user || tasks.length === 0) return;
    
    const todayKey = getDateKey(new Date());
    const lastReminderDate = localStorage.getItem(`last_reminder_${user.uid}`);
    
    // Only run if we haven't sent reminders today
    if (lastReminderDate === todayKey) return;

    const overdueTasks = tasks.filter(task => {
      const pastDates = Object.entries(task.completions).filter(([key]) => key < todayKey);
      return pastDates.some(([, done]) => !done);
    });

    const dueTodayTasks = tasks.filter(task => {
      return task.completions[todayKey] === false;
    });

    const runReminders = async () => {
      // Filter tasks based on their individual reminder settings
      const browserTasks = [...overdueTasks, ...dueTodayTasks].filter(t => 
        t.reminderType === 'browser' || t.reminderType === 'both' || !t.reminderType
      );
      
      const emailTasks = [...overdueTasks, ...dueTodayTasks].filter(t => 
        t.reminderType === 'email' || t.reminderType === 'both'
      );

      // 1. Browser Notifications
      if (settings.notificationsEnabled && browserTasks.length > 0) {
        if (browserTasks.length === 1) {
          sendNotification('تذكير بمهمة', `لديك مهمة بانتظارك: ${browserTasks[0].name}`);
        } else {
          sendNotification('تذكير بالمهام', `لديك ${browserTasks.length} مهام بانتظارك.`);
        }
      }

      // 2. Email Reminders
      if (settings.emailRemindersEnabled && emailTasks.length > 0) {
        if (emailTasks.length === 1) {
          await sendEmailReminder(`مهمة بانتظارك: ${emailTasks[0].name}`, 'today');
        } else {
          await sendEmailReminder(`${emailTasks.length} مهام بانتظارك`, 'today');
        }
      }

      localStorage.setItem(`last_reminder_${user.uid}`, todayKey);
    };

    if (overdueTasks.length > 0 || dueTodayTasks.length > 0) {
      runReminders();
    }
  }, [user, tasks.length, settings.notificationsEnabled, settings.emailRemindersEnabled]);

  // --- Firestore Real-time Sync ---
  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }

    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(taskList);
    }, (error) => {
      const errInfo = {
        error: error.message,
        operationType: 'list',
        path: 'tasks',
        authInfo: { userId: user.uid, email: user.email }
      };
      console.error('Firestore Error:', JSON.stringify(errInfo));
      throw new Error(JSON.stringify(errInfo));
    });

    return () => unsubscribe();
  }, [user]);

  // --- Theme Management ---
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  const toggleTheme = async () => {
    if (!user) return;
    const newTheme: 'light' | 'dark' = settings.theme === 'light' ? 'dark' : 'light';
    const newSettings: UserSettings = { ...settings, theme: newTheme };
    setSettings(newSettings);
    await updateDoc(doc(db, 'userSettings', user.uid), { theme: newTheme });
  };

  // --- Task Actions ---
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTaskName.trim()) return;

    const completions: Record<string, boolean> = {};
    const dates = getDatesBetween(newTaskStart, newTaskDuration);
    dates.forEach(d => completions[getDateKey(d)] = false);

    const taskData = {
      name: newTaskName,
      description: newTaskDesc,
      startDate: newTaskStart,
      duration: newTaskDuration,
      category: newTaskCategory,
      reminderType: newTaskReminderType,
      completions,
      userId: user.uid,
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'tasks'), taskData);
      setNewTaskName('');
      setNewTaskDesc('');
      setIsAddingTask(false);
    } catch (error) {
      const errInfo = { error, operationType: 'create', path: 'tasks', authInfo: { userId: user.uid } };
      throw new Error(JSON.stringify(errInfo));
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingTask) return;

    try {
      await updateDoc(doc(db, 'tasks', editingTask.id), {
        name: editingTask.name,
        description: editingTask.description || '',
        category: editingTask.category,
        reminderType: editingTask.reminderType || 'browser'
      });
      setEditingTask(null);
      showToast('تم تحديث المهمة بنجاح.', 'success');
    } catch (error) {
      console.error("Update Task Error:", error);
      showToast('فشل تحديث المهمة. يرجى المحاولة مرة أخرى.', 'error');
      const errInfo = { error, operationType: 'update', path: `tasks/${editingTask.id}`, authInfo: { userId: user.uid } };
      throw new Error(JSON.stringify(errInfo));
    }
  };

  const [toast, setToast] = useState<{ message: string; visible: boolean; type: 'success' | 'error' | 'info' }>({ 
    message: '', 
    visible: false,
    type: 'success'
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, visible: true, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
  };

  const toggleCompletion = async (task: Task, dateKey: string) => {
    if (!user) return;
    const newCompletions = { ...task.completions, [dateKey]: !task.completions[dateKey] };
    
    // Check if fully completed
    const wasFull = Object.values(task.completions).every(v => v);
    const isFull = Object.values(newCompletions).every(v => v);

    try {
      await updateDoc(doc(db, 'tasks', task.id), { completions: newCompletions });
      if (isFull && !wasFull) {
        showToast(`🥳 مبروك! لقد أكملت "${task.name}" بالكامل 🎉`);
      }
    } catch (error) {
      const errInfo = { error, operationType: 'update', path: `tasks/${task.id}`, authInfo: { userId: user.uid } };
      throw new Error(JSON.stringify(errInfo));
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!user || !confirm('هل أنت متأكد من حذف هذه المهمة؟')) return;
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (error) {
      const errInfo = { error, operationType: 'delete', path: `tasks/${id}`, authInfo: { userId: user.uid } };
      throw new Error(JSON.stringify(errInfo));
    }
  };

  const handleArchiveTask = async (task: Task) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'tasks', task.id), { isArchived: true });
      showToast('تم نقل المهمة إلى الأرشيف.');
    } catch (error) {
      const errInfo = { error, operationType: 'update', path: `tasks/${task.id}`, authInfo: { userId: user.uid } };
      throw new Error(JSON.stringify(errInfo));
    }
  };

  const handleUnarchiveTask = async (task: Task) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'tasks', task.id), { isArchived: false });
      showToast('تمت استعادة المهمة من الأرشيف.');
    } catch (error) {
      const errInfo = { error, operationType: 'update', path: `tasks/${task.id}`, authInfo: { userId: user.uid } };
      throw new Error(JSON.stringify(errInfo));
    }
  };

  // --- Export / Import ---
  const exportData = () => {
    const dataStr = JSON.stringify(tasks, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks_export_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          for (const t of imported) {
            const { id, ...rest } = t;
            await addDoc(collection(db, 'tasks'), { ...rest, userId: user.uid, createdAt: new Date().toISOString() });
          }
        }
      } catch (err) {
        alert('فشل استيراد البيانات. تأكد من صحة الملف.');
      }
    };
    reader.readAsText(file);
  };

  // --- Filtering & Stats ---
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
      const matchesArchive = viewArchived ? t.isArchived === true : !t.isArchived;
      return matchesSearch && matchesCategory && matchesArchive;
    });
  }, [tasks, searchQuery, filterCategory, viewArchived]);

  const stats = useMemo(() => {
    const total = tasks.filter(t => !t.isArchived).length;
    if (total === 0) return { total: 0, completed: 0, progress: 0, categoryData: [] };
    
    let totalDays = 0;
    let completedDays = 0;
    const catMap: Record<string, number> = {};

    tasks.filter(t => !t.isArchived).forEach(t => {
      const days = Object.values(t.completions);
      totalDays += days.length;
      completedDays += days.filter(v => v).length;
      catMap[t.category] = (catMap[t.category] || 0) + 1;
    });

    const categoryData = Object.entries(catMap).map(([id, value]) => ({
      name: settings.categories.find(c => c.id === id)?.name || id,
      value,
      color: settings.categories.find(c => c.id === id)?.color || '#ccc'
    }));

    return {
      total,
      completed: tasks.filter(t => Object.values(t.completions).every(v => v)).length,
      progress: Math.round((completedDays / totalDays) * 100),
      categoryData
    };
  }, [tasks, settings.categories]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    const handleEmailAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email || (authMode !== 'reset' && !password)) {
        showToast('يرجى إدخال جميع البيانات المطلوبة.', 'error');
        return;
      }
      
      setAuthLoading(true);
      try {
        if (authMode === 'login') {
          await signInWithEmailAndPassword(auth, email, password);
        } else if (authMode === 'signup') {
          await createUserWithEmailAndPassword(auth, email, password);
        } else {
          await sendPasswordResetEmail(auth, email);
          showToast('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.', 'success');
          setAuthMode('login');
        }
      } catch (err: any) {
        console.error("Auth Error:", err);
        let message = 'حدث خطأ أثناء المصادقة.';
        if (err.code === 'auth/user-not-found') message = 'المستخدم غير موجود.';
        if (err.code === 'auth/wrong-password') message = 'كلمة المرور غير صحيحة.';
        if (err.code === 'auth/email-already-in-use') message = 'البريد الإلكتروني مستخدم بالفعل.';
        if (err.code === 'auth/weak-password') message = 'كلمة المرور ضعيفة جداً.';
        showToast(message, 'error');
      } finally {
        setAuthLoading(false);
      }
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-orange-50 dark:from-slate-950 dark:to-slate-900 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 p-8 sm:p-10 rounded-[3rem] shadow-2xl max-w-md w-full text-center border border-white/20 backdrop-blur-xl"
        >
          <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200 dark:shadow-none">
            <Calendar className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Smart_Notes</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8 text-sm">نظم حياتك، تتبع تقدمك، وحقق أهدافك يومًا بيوم.</p>
          
          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6 text-right" dir="rtl">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 mr-2 uppercase tracking-wider">البريد الإلكتروني</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-700 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="example@mail.com"
                required
              />
            </div>
            
            {authMode !== 'reset' && (
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 mr-2 uppercase tracking-wider">كلمة المرور</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-700 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            <button 
              type="submit"
              disabled={authLoading}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {authMode === 'login' ? 'تسجيل الدخول' : authMode === 'signup' ? 'إنشاء حساب' : 'إرسال رابط الاستعادة'}
                </>
              )}
            </button>
          </form>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 text-slate-400 text-xs">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              أو
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>

            <button 
              onClick={signInWithGoogle}
              className="w-full bg-white dark:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 py-3 rounded-2xl font-bold hover:bg-slate-50 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-3"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              جوجل
            </button>

            <div className="mt-4 flex flex-col gap-2 text-sm">
              {authMode === 'login' ? (
                <>
                  <button onClick={() => setAuthMode('signup')} className="text-indigo-600 font-bold hover:underline">ليس لديك حساب؟ أنشئ حساباً جديداً</button>
                  <button onClick={() => setAuthMode('reset')} className="text-slate-500 text-xs hover:underline">نسيت كلمة المرور؟</button>
                </>
              ) : (
                <button onClick={() => setAuthMode('login')} className="text-indigo-600 font-bold hover:underline">لديك حساب بالفعل؟ سجل دخولك</button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300" dir="rtl">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-black hidden sm:block">مدير المهام</h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={() => setShowStats(!showStats)}
                className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="الإحصائيات"
              >
                <BarChart3 className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="الإعدادات"
              >
                <Tag className="w-5 h-5" />
              </button>
              <button 
                onClick={toggleTheme}
                className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {settings.theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
              <div className="flex items-center gap-3">
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                  alt={user.displayName || ''} 
                  className="w-10 h-10 rounded-full border-2 border-indigo-100 dark:border-indigo-900"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={logout}
                  className="p-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Dashboard Stats */}
          <AnimatePresence>
            {showStats && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                  <div className="space-y-6">
                    <h2 className="text-2xl font-black flex items-center gap-2">
                      <BarChart3 className="w-6 h-6 text-indigo-600" />
                      لوحة الإحصائيات
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-3xl">
                        <div className="text-sm text-indigo-600 dark:text-indigo-400 font-bold mb-1">المهام الكلية</div>
                        <div className="text-3xl font-black">{stats.total}</div>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-3xl">
                        <div className="text-sm text-emerald-600 dark:text-emerald-400 font-bold mb-1">المكتملة</div>
                        <div className="text-3xl font-black">{stats.completed}</div>
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold">نسبة الإنجاز الكلية</span>
                        <span className="text-indigo-600 font-black">{stats.progress}%</span>
                      </div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${stats.progress}%` }}
                          className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="h-[250px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {stats.categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-slate-500">توزيع التصنيفات</h3>
                    <div className="space-y-2">
                      {stats.categoryData.map((cat, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                            <span className="font-medium">{cat.name}</span>
                          </div>
                          <span className="font-bold">{cat.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex gap-2">
              <button 
                onClick={() => setViewArchived(false)}
                className={cn(
                  "px-6 py-4 rounded-3xl font-bold flex items-center gap-2 transition-all shadow-sm",
                  !viewArchived ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                )}
              >
                <Inbox className="w-5 h-5" />
                المهام النشطة
              </button>
              <button 
                onClick={() => setViewArchived(true)}
                className={cn(
                  "px-6 py-4 rounded-3xl font-bold flex items-center gap-2 transition-all shadow-sm",
                  viewArchived ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                )}
              >
                <Archive className="w-5 h-5" />
                الأرشيف
              </button>
            </div>
            <div className="relative flex-1">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="ابحث عن مهمة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-12 pl-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
              />
            </div>
            <div className="flex gap-2">
              <select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-6 py-4 rounded-3xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold shadow-sm"
              >
                <option value="all">كل التصنيفات</option>
                {settings.categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button 
                onClick={() => setIsAddingTask(true)}
                className="bg-indigo-600 text-white px-8 py-4 rounded-3xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none whitespace-nowrap"
              >
                <Plus className="w-6 h-6" />
                مهمة جديدة
              </button>
            </div>
          </div>

          {/* Task Grid */}
          <div className="grid grid-cols-1 gap-8">
            <AnimatePresence mode="popLayout">
              {filteredTasks.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20 bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-300 dark:border-slate-700"
                >
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-400">لا توجد مهام حالياً</h3>
                  <p className="text-slate-400">ابدأ بإضافة مهمتك الأولى لتتبعها يومياً</p>
                </motion.div>
              ) : (
                filteredTasks.map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    categories={settings.categories}
                    onToggle={(dateKey) => toggleCompletion(task, dateKey)}
                    onDelete={() => handleDeleteTask(task.id)}
                    onEdit={() => setEditingTask(task)}
                    onArchive={() => handleArchiveTask(task)}
                    onUnarchive={() => handleUnarchiveTask(task)}
                  />
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Footer Actions */}
          <div className="mt-12 flex justify-center gap-4">
            <button 
              onClick={exportData}
              className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="w-5 h-5" />
              تصدير البيانات
            </button>
            <label className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              <Upload className="w-5 h-5" />
              استيراد البيانات
              <input type="file" accept=".json" onChange={importData} className="hidden" />
            </label>
          </div>
        </main>

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden"
              >
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <h2 className="text-2xl font-black">الإعدادات</h2>
                  <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-8 space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">التنبيهات</h3>
                    <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                          settings.notificationsEnabled ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40" : "bg-slate-200 text-slate-400 dark:bg-slate-700"
                        )}>
                          {settings.notificationsEnabled ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
                        </div>
                        <div>
                          <div className="font-bold">تنبيهات المهام</div>
                          <div className="text-xs text-slate-500">تذكير بالمهام المتأخرة واليومية</div>
                        </div>
                      </div>
                      <button 
                        onClick={settings.notificationsEnabled ? disableNotifications : requestNotificationPermission}
                        className={cn(
                          "px-6 py-2 rounded-full font-bold transition-all",
                          settings.notificationsEnabled 
                            ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20" 
                            : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none"
                        )}
                      >
                        {settings.notificationsEnabled ? 'إيقاف' : 'تفعيل'}
                      </button>
                    </div>
                    {!settings.notificationsEnabled && (
                      <div className="flex items-start gap-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl text-xs text-amber-700 dark:text-amber-400">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <p>تفعيل التنبيهات يساعدك على الالتزام بمهامك اليومية وعدم نسيانها.</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                          settings.emailRemindersEnabled ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40" : "bg-slate-200 text-slate-400 dark:bg-slate-700"
                        )}>
                          {settings.emailRemindersEnabled ? <MailCheck className="w-6 h-6" /> : <MailWarning className="w-6 h-6" />}
                        </div>
                        <div>
                          <div className="font-bold flex items-center gap-2">
                            تنبيهات البريد
                            {emailStatus && (
                              <span className={cn(
                                "text-[9px] px-2 py-0.5 rounded-full",
                                emailStatus.emailConfigured ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                              )}>
                                {emailStatus.emailConfigured ? "جاهز" : "غير مهيأ"}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">إرسال تذكير عبر البريد الإلكتروني</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button 
                          onClick={toggleEmailReminders}
                          className={cn(
                            "px-6 py-2 rounded-full font-bold transition-all",
                            settings.emailRemindersEnabled 
                              ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20" 
                              : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 dark:shadow-none"
                          )}
                        >
                          {settings.emailRemindersEnabled ? 'إيقاف' : 'تفعيل'}
                        </button>
                        {settings.emailRemindersEnabled && (
                          <button 
                            onClick={async () => {
                              const success = await sendEmailReminder('تجربة نظام التنبيهات', 'today');
                              if (success) {
                                showToast('تم إرسال بريد تجريبي، يرجى التحقق من صندوق الوارد.', 'success');
                              } else {
                                showToast('فشل إرسال البريد. تأكد من إعدادات Secrets.', 'error');
                              }
                            }}
                            className="text-[10px] text-indigo-600 font-bold hover:underline"
                          >
                            إرسال بريد تجريبي
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">المظهر</h3>
                    <button 
                      onClick={toggleTheme}
                      className="w-full flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 rounded-2xl flex items-center justify-center">
                          {settings.theme === 'light' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
                        </div>
                        <div className="text-right">
                          <div className="font-bold">الوضع {settings.theme === 'light' ? 'النهاري' : 'الليلي'}</div>
                          <div className="text-xs text-slate-500">تغيير مظهر التطبيق</div>
                        </div>
                      </div>
                      <ChevronLeft className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add Task Modal */}
        <AnimatePresence>
          {isAddingTask && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden"
              >
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <h2 className="text-2xl font-black">إضافة مهمة جديدة</h2>
                  <button onClick={() => setIsAddingTask(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <form onSubmit={handleAddTask} className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">اسم المهمة</label>
                    <input 
                      required
                      type="text" 
                      value={newTaskName}
                      onChange={(e) => setNewTaskName(e.target.value)}
                      placeholder="مثال: تعلم البرمجة"
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">وصف المهمة (اختياري - يدعم Markdown)</label>
                    <textarea 
                      value={newTaskDesc}
                      onChange={(e) => setNewTaskDesc(e.target.value)}
                      placeholder="أضف تفاصيل المهمة هنا..."
                      rows={3}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">تاريخ البدء</label>
                      <input 
                        required
                        type="date" 
                        value={newTaskStart}
                        onChange={(e) => setNewTaskStart(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">المدة (أيام)</label>
                      <input 
                        required
                        type="number" 
                        min="1"
                        value={newTaskDuration}
                        onChange={(e) => setNewTaskDuration(parseInt(e.target.value))}
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">التصنيف</label>
                      <select 
                        value={newTaskCategory}
                        onChange={(e) => setNewTaskCategory(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold"
                      >
                        {settings.categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">نوع التنبيه</label>
                      <select 
                        value={newTaskReminderType}
                        onChange={(e) => setNewTaskReminderType(e.target.value as any)}
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold"
                      >
                        <option value="none">بدون تنبيه</option>
                        <option value="browser">تنبيه المتصفح</option>
                        <option value="email">تنبيه البريد</option>
                        <option value="both">كلاهما</option>
                      </select>
                    </div>
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none"
                  >
                    تأكيد الإضافة
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Edit Task Modal */}
        <AnimatePresence>
          {editingTask && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden"
              >
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <h2 className="text-2xl font-black">تعديل المهمة</h2>
                  <button onClick={() => setEditingTask(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <form onSubmit={handleUpdateTask} className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">اسم المهمة</label>
                    <input 
                      required
                      type="text" 
                      value={editingTask.name}
                      onChange={(e) => setEditingTask({ ...editingTask, name: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">الوصف</label>
                    <textarea 
                      value={editingTask.description || ''}
                      onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                      rows={3}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">التصنيف</label>
                    <select 
                      value={editingTask.category}
                      onChange={(e) => setEditingTask({ ...editingTask, category: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold"
                    >
                      {settings.categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">نوع التنبيه</label>
                    <select 
                      value={editingTask.reminderType || 'browser'}
                      onChange={(e) => setEditingTask({ ...editingTask, reminderType: e.target.value as any })}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold"
                    >
                      <option value="none">بدون تنبيه</option>
                      <option value="browser">تنبيه المتصفح</option>
                      <option value="email">تنبيه البريد</option>
                      <option value="both">كلاهما</option>
                    </select>
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none"
                  >
                    حفظ التعديلات
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Toast Notification */}
        <AnimatePresence>
          {toast.visible && (
            <motion.div 
              initial={{ opacity: 0, y: 50, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 20, x: '-50%' }}
              className={cn(
                "fixed bottom-10 left-1/2 z-[100] text-white px-8 py-4 rounded-full font-black shadow-2xl flex items-center gap-3 whitespace-nowrap",
                toast.type === 'success' ? "bg-emerald-600" : 
                toast.type === 'error' ? "bg-red-600" : "bg-indigo-600"
              )}
            >
              {toast.type === 'success' && <CheckCircle2 className="w-6 h-6" />}
              {toast.type === 'error' && <AlertCircle className="w-6 h-6" />}
              {toast.type === 'info' && <Bell className="w-6 h-6" />}
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

// --- Sub-components ---

function TaskCard({ task, categories, onToggle, onDelete, onEdit, onArchive, onUnarchive }: { 
  task: Task, 
  categories: Category[], 
  onToggle: (dateKey: string) => void,
  onDelete: () => void,
  onEdit: () => void,
  onArchive: () => void,
  onUnarchive: () => void
}) {
  const category = categories.find(c => c.id === task.category) || categories[0];
  const dates = getDatesBetween(task.startDate, task.duration);
  const scrollRef = useRef<HTMLDivElement>(null);

  const progress = useMemo(() => {
    const vals = Object.values(task.completions);
    return Math.round((vals.filter(v => v).length / vals.length) * 100);
  }, [task.completions]);

  const isCompleted = progress === 100;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none transition-all",
        isCompleted && "ring-4 ring-emerald-500/20 border-emerald-500/50"
      )}
    >
      <div className="p-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <div className="px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest text-white" style={{ backgroundColor: category.color }}>
                {category.name}
              </div>
              {isCompleted && (
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  مكتملة!
                </div>
              )}
            </div>
            <h3 className="text-3xl font-black tracking-tight">{task.name}</h3>
            {task.description && (
              <div className="text-slate-500 dark:text-slate-400 prose dark:prose-invert prose-sm max-w-none">
                <ReactMarkdown>{task.description}</ReactMarkdown>
              </div>
            )}
            <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-400">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {formatDateLabel(new Date(task.startDate))}
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {task.duration} يوم
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-4">
            <div className="flex gap-2">
              {!task.isArchived ? (
                <button 
                  onClick={onArchive} 
                  className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                  title="أرشفة"
                >
                  <Archive className="w-5 h-5 text-amber-600" />
                </button>
              ) : (
                <button 
                  onClick={onUnarchive} 
                  className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                  title="استعادة"
                >
                  <ArchiveRestore className="w-5 h-5 text-indigo-600" />
                </button>
              )}
              <button onClick={onEdit} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <Edit2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <button onClick={onDelete} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                <Trash2 className="w-5 h-5 text-red-500" />
              </button>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-indigo-600">{progress}%</div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">نسبة الإنجاز</div>
            </div>
          </div>
        </div>

        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-8">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className={cn(
              "h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all",
              isCompleted && "from-emerald-600 to-emerald-400"
            )}
          />
        </div>

        <div className="relative group">
          <button 
            onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
            className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-white dark:bg-slate-800 shadow-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity hidden md:block"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button 
            onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
            className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-white dark:bg-slate-800 shadow-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity hidden md:block"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div 
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x"
          >
            {dates.map((date, i) => {
              const key = getDateKey(date);
              const done = task.completions[key];
              const isToday = key === getDateKey(new Date());
              
              return (
                <motion.div 
                  key={key}
                  whileHover={{ y: -4 }}
                  onClick={() => onToggle(key)}
                  className={cn(
                    "flex-shrink-0 w-28 p-4 rounded-3xl border-2 transition-all cursor-pointer snap-start text-center",
                    done 
                      ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500/50" 
                      : "bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-300 dark:hover:border-slate-600",
                    isToday && !done && "ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900"
                  )}
                >
                  <div className={cn("text-[10px] font-black uppercase tracking-widest mb-2", done ? "text-emerald-600" : "text-slate-400")}>
                    {WEEKDAYS_AR[date.getDay()]}
                  </div>
                  <div className={cn("text-xl font-black mb-1", done ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-200")}>
                    {date.getDate()}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400">
                    {date.getMonth() + 1}/{date.getFullYear().toString().slice(-2)}
                  </div>
                  <div className={cn(
                    "mt-3 w-6 h-6 rounded-full mx-auto flex items-center justify-center transition-all",
                    done ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-700"
                  )}>
                    {done && <CheckCircle2 className="w-4 h-4" />}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
