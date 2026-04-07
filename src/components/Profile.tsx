import { motion } from 'motion/react';
import { 
  User, 
  Award, 
  Zap, 
  Target, 
  CalendarDays, 
  Shield, 
  Trash2, 
  ChevronRight,
  Mail,
  Clock,
  CheckCircle2,
  Trophy
} from 'lucide-react';
import { UserSettings, Task } from '../types';
import { cn } from '../lib/utils';
import { useState } from 'react';

interface ProfileProps {
  user: any;
  settings: UserSettings;
  tasks: Task[];
  onUpdateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  onBack: () => void;
  onLogout: () => void;
}

export default function Profile({ user, settings, tasks, onUpdateSettings, onBack, onLogout }: ProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    displayName: settings.displayName || user.displayName || '',
    bio: settings.bio || '',
    dailyGoal: settings.dailyGoal || 3
  });

  const joinedDate = settings.joinedAt ? new Date(settings.joinedAt).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'غير متوفر';

  const totalCompletions = tasks.reduce((acc, task) => {
    return acc + Object.values(task.completions).filter(v => v).length;
  }, 0);

  const handleSave = async () => {
    await onUpdateSettings(editData);
    setIsEditing(false);
  };

  const achievements = [
    { id: 'first_task', name: 'البداية القوية', desc: 'أكملت أول مهمة لك', icon: <Zap className="w-6 h-6" />, color: 'bg-yellow-500', unlocked: totalCompletions >= 1 },
    { id: 'streak_7', name: 'الالتزام الحديدي', desc: 'وصلت لـ 7 أيام متتالية', icon: <Award className="w-6 h-6" />, color: 'bg-indigo-500', unlocked: (settings.streak || 0) >= 7 },
    { id: 'task_master', name: 'سيد المهام', desc: 'أكملت 50 مهمة', icon: <Trophy className="w-6 h-6" />, color: 'bg-emerald-500', unlocked: totalCompletions >= 50 },
    { id: 'goal_setter', name: 'محدد الأهداف', desc: 'وضعت هدفاً يومياً', icon: <Target className="w-6 h-6" />, color: 'bg-orange-500', unlocked: !!settings.dailyGoal },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl mx-auto pb-20"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors font-bold"
        >
          <ChevronRight className="w-5 h-5" />
          العودة للوحة التحكم
        </button>
        <h1 className="text-3xl font-black">الملف الشخصي</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: User Info */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none text-center">
            <div className="relative inline-block mb-6">
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${editData.displayName}`} 
                alt={editData.displayName}
                className="w-32 h-32 rounded-[2.5rem] border-4 border-indigo-50 dark:border-indigo-900/50 object-cover mx-auto"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2 rounded-xl shadow-lg">
                <Shield className="w-5 h-5" />
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-4 text-right">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mr-2">الاسم</label>
                  <input 
                    type="text" 
                    value={editData.displayName}
                    onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mr-2">نبذة عنك</label>
                  <textarea 
                    value={editData.bio}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleSave}
                    className="flex-1 bg-indigo-600 text-white py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                  >
                    حفظ
                  </button>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 py-2 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-black mb-2">{editData.displayName}</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                  {editData.bio || 'لا يوجد نبذة شخصية بعد. أضف شيئاً عن نفسك!'}
                </p>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 py-3 rounded-2xl font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  تعديل الملف الشخصي
                </button>
              </>
            )}

            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 space-y-4 text-right">
              <div className="flex items-center gap-3 text-slate-500">
                <Mail className="w-4 h-4" />
                <span className="text-sm truncate">{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                <Clock className="w-4 h-4" />
                <span className="text-sm">انضم في {joinedDate}</span>
              </div>
            </div>
          </div>

          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-3 p-6 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-[2rem] hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors font-bold"
          >
            <Trash2 className="w-5 h-5" />
            تسجيل الخروج
          </button>
        </div>

        {/* Right Column: Stats & Achievements */}
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-none">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-2xl flex items-center justify-center mb-4">
                <Zap className="w-6 h-6" />
              </div>
              <div className="text-3xl font-black mb-1">{settings.streak || 0}</div>
              <div className="text-sm text-slate-500 font-bold">أيام متتالية</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-none">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-3xl font-black mb-1">{totalCompletions}</div>
              <div className="text-sm text-slate-500 font-bold">إنجازات كلية</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-none">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                <Target className="w-6 h-6" />
              </div>
              <div className="text-3xl font-black mb-1">{settings.dailyGoal || 0}</div>
              <div className="text-sm text-slate-500 font-bold">الهدف اليومي</div>
            </div>
          </div>

          {/* Achievements */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <h3 className="text-xl font-black mb-6 flex items-center gap-3">
              <Award className="w-6 h-6 text-indigo-600" />
              الإنجازات والأوسمة
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {achievements.map((ach) => (
                <div 
                  key={ach.id}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-3xl border-2 transition-all",
                    ach.unlocked 
                      ? "bg-slate-50 dark:bg-slate-800/50 border-indigo-100 dark:border-indigo-900/30" 
                      : "bg-slate-50/50 dark:bg-slate-900/50 border-transparent opacity-50 grayscale"
                  )}
                >
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg", ach.color)}>
                    {ach.icon}
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{ach.name}</div>
                    <div className="text-xs text-slate-500">{ach.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Summary */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <h3 className="text-xl font-black mb-6 flex items-center gap-3">
              <CalendarDays className="w-6 h-6 text-indigo-600" />
              ملخص النشاط
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                <span className="font-bold">المهام النشطة حالياً</span>
                <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-sm font-black">
                  {tasks.filter(t => !t.isArchived).length}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                <span className="font-bold">المهام المؤرشفة</span>
                <span className="bg-slate-600 text-white px-3 py-1 rounded-full text-sm font-black">
                  {tasks.filter(t => t.isArchived).length}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                <span className="font-bold">أفضل تصنيف نشاطاً</span>
                <span className="text-indigo-600 font-black">
                  {tasks.length > 0 ? (
                    (() => {
                      const counts: Record<string, number> = {};
                      tasks.forEach(t => counts[t.category] = (counts[t.category] || 0) + 1);
                      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                      return settings.categories.find(c => c.id === top[0])?.name || top[0];
                    })()
                  ) : 'لا يوجد'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
