import { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  updateDoc,
  setDoc,
  addDoc,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserSettings, Task, Category, DEFAULT_CATEGORIES } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  Trash2, 
  Shield, 
  ShieldAlert, 
  ChevronLeft, 
  CheckCircle2, 
  Circle, 
  Calendar,
  BarChart3,
  ExternalLink,
  X,
  Tag,
  Plus,
  Palette,
  Edit2,
  RefreshCw
} from 'lucide-react';
import { cn } from '../lib/utils';

interface AdminDashboardProps {
  onBack: () => void;
}

export default function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [users, setUsers] = useState<(UserSettings & { id: string })[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [globalCategories, setGlobalCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<(UserSettings & { id: string }) | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'categories'>('users');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });

  const showLocalToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: null }), 3000);
  };
  
  // Category Form State
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState({ name: '', color: '#4f46e5' });

  useEffect(() => {
    fetchData();
    
    // Real-time categories
    const q = query(collection(db, 'categories'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Category));
      setGlobalCategories(cats);
    });
    
    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'userSettings'));
      const tasksSnap = await getDocs(collection(db, 'tasks'));
      
      const usersList = usersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as UserSettings & { id: string }));
      const tasksList = tasksSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
      
      setUsers(usersList);
      setAllTasks(tasksList);
    } catch (error) {
      console.error("Admin Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getUserTasks = (userId: string) => allTasks.filter(t => t.userId === userId);

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      setAllTasks(prev => prev.filter(t => t.id !== taskId));
      showLocalToast('تم حذف المهمة بنجاح', 'success');
    } catch (error) {
      showLocalToast('فشل حذف المهمة', 'error');
    }
  };

  const toggleUserRole = async (user: UserSettings & { id: string }) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    
    try {
      await updateDoc(doc(db, 'userSettings', user.id), { role: newRole });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
      showLocalToast(`تم تغيير الرتبة إلى ${newRole === 'admin' ? 'مدير' : 'مستخدم'}`, 'success');
    } catch (error) {
      showLocalToast('فشل تحديث الرتبة', 'error');
    }
  };

  const handleSaveCategory = async () => {
    if (!newCategory.name) return;
    const id = editingCategory ? editingCategory.id : newCategory.name.toLowerCase().replace(/\s+/g, '-');
    const categoryData: Category = { ...newCategory, id };
    
    try {
      await setDoc(doc(db, 'categories', id), categoryData);
      setNewCategory({ name: '', color: '#4f46e5' });
      setIsAddingCategory(false);
      setEditingCategory(null);
      showLocalToast('تم حفظ التصنيف بنجاح', 'success');
    } catch (error) {
      showLocalToast('فشل حفظ التصنيف', 'error');
    }
  };

  const startEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setNewCategory({ name: cat.name, color: cat.color });
    setIsAddingCategory(true);
  };

  const bootstrapDefaults = async () => {
    setLoading(true);
    try {
      for (const cat of DEFAULT_CATEGORIES) {
        await setDoc(doc(db, 'categories', cat.id), cat);
      }
      showLocalToast('تمت إضافة التصنيفات الافتراضية بنجاح', 'success');
    } catch (error) {
      console.error("Bootstrap Error:", error);
      showLocalToast('فشل إضافة التصنيفات الافتراضية', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    try {
      await deleteDoc(doc(db, 'categories', catId));
      showLocalToast('تم حذف التصنيف بنجاح', 'success');
    } catch (error) {
      showLocalToast('فشل حذف التصنيف', 'error');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-6xl mx-auto pb-20"
      dir="rtl"
    >
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors font-bold"
        >
          <ChevronLeft className="w-5 h-5" />
          العودة للوحة التحكم
        </button>
        <h1 className="text-3xl font-black flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-indigo-600" />
          لوحة تحكم المدير
        </h1>
      </div>

      {toast.type && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={cn(
            "fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl font-bold shadow-2xl flex items-center gap-2",
            toast.type === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          )}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          {toast.message}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Tabs & List */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-2 rounded-3xl border border-slate-200 dark:border-slate-800 flex gap-1">
            <button 
              onClick={() => setActiveTab('users')}
              className={cn(
                "flex-1 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2",
                activeTab === 'users' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <Users className="w-4 h-4" />
              المستخدمين
            </button>
            <button 
              onClick={() => setActiveTab('categories')}
              className={cn(
                "flex-1 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2",
                activeTab === 'categories' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <Tag className="w-4 h-4" />
              التصنيفات
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px]",
                activeTab === 'categories' ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              )}>
                {globalCategories.length}
              </span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            {activeTab === 'users' ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="ابحث عن مستخدم..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pr-10 pl-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button 
                    onClick={fetchData}
                    disabled={loading}
                    className="mr-2 p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                    title="تحديث البيانات"
                  >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                  </button>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                  {loading ? (
                    <div className="text-center py-10 text-slate-400">جاري التحميل...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">لا يوجد مستخدمين</div>
                  ) : (
                    filteredUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUser(u)}
                        className={cn(
                          "w-full text-right p-4 rounded-2xl transition-all flex items-center justify-between group",
                          selectedUser?.id === u.id 
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none" 
                            : "hover:bg-slate-50 dark:hover:bg-slate-800"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                            selectedUser?.id === u.id ? "bg-white/20" : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600"
                          )}>
                            {(u.displayName || u.id).charAt(0).toUpperCase()}
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-sm truncate max-w-[120px]">{u.displayName || 'مستخدم مجهول'}</div>
                            <div className={cn("text-[10px]", selectedUser?.id === u.id ? "text-white/70" : "text-slate-400")}>
                              {u.role === 'admin' ? 'مدير' : 'مستخدم'}
                            </div>
                          </div>
                        </div>
                        {u.role === 'admin' && <Shield className="w-4 h-4" />}
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsAddingCategory(true)}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة تصنيف جديد
                  </button>
                  {globalCategories.length === 0 && (
                    <button 
                      onClick={bootstrapDefaults}
                      className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                      title="إضافة التصنيفات الافتراضية"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                  {globalCategories.map(cat => (
                    <div 
                      key={cat.id}
                      className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="font-bold text-sm">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => startEditCategory(cat)}
                          className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {activeTab === 'users' ? (
              selectedUser ? (
                <motion.div
                  key={selectedUser.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  {/* User Profile Card */}
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                      <div className="flex items-center gap-6">
                        <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-[2rem] flex items-center justify-center text-4xl font-black">
                          {(selectedUser.displayName || selectedUser.id).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-3xl font-black mb-2">{selectedUser.displayName || 'مستخدم مجهول'}</h2>
                          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{selectedUser.id}</p>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full text-xs font-bold">
                              {selectedUser.role === 'admin' ? 'مدير النظام' : 'مستخدم عادي'}
                            </span>
                            <span className="px-3 py-1 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-full text-xs font-bold">
                              انضم في: {selectedUser.joinedAt ? new Date(selectedUser.joinedAt).toLocaleDateString('ar-EG') : 'غير معروف'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => toggleUserRole(selectedUser)}
                          className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white rounded-2xl font-bold transition-all flex items-center gap-2"
                        >
                          <Shield className="w-5 h-5" />
                          تغيير الرتبة
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl text-center">
                        <div className="text-2xl font-black text-indigo-600">{getUserTasks(selectedUser.id).length}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase">إجمالي المهام</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl text-center">
                        <div className="text-2xl font-black text-emerald-600">
                          {getUserTasks(selectedUser.id).filter(t => Object.values(t.completions).every(v => v)).length}
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase">مهام مكتملة</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl text-center">
                        <div className="text-2xl font-black text-orange-600">{selectedUser.streak || 0}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase">أيام متتالية</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl text-center">
                        <div className="text-2xl font-black text-slate-600">{selectedUser.totalCompletions || 0}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase">إنجازات كلية</div>
                      </div>
                    </div>
                  </div>

                  {/* User Tasks List */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-black flex items-center gap-2">
                      <Calendar className="w-6 h-6 text-indigo-600" />
                      مهام المستخدم
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {getUserTasks(selectedUser.id).length === 0 ? (
                        <div className="col-span-full py-10 text-center bg-white dark:bg-slate-900 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                          لا توجد مهام لهذا المستخدم
                        </div>
                      ) : (
                        getUserTasks(selectedUser.id).map(task => (
                          <div key={task.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-none group">
                            <div className="flex justify-between items-start mb-4">
                              <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full text-[10px] font-black">
                                {task.category}
                              </span>
                              <button 
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <h4 className="font-black mb-2">{task.name}</h4>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {task.duration} يوم
                              </div>
                              <div className="font-bold text-indigo-600">
                                {Math.round((Object.values(task.completions).filter(v => v).length / task.duration) * 100)}%
                              </div>
                            </div>
                            <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-indigo-600" 
                                style={{ width: `${(Object.values(task.completions).filter(v => v).length / task.duration) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800 text-center">
                  <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full flex items-center justify-center mb-6">
                    <Users className="w-12 h-12" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-400">اختر مستخدماً للمتابعة</h2>
                  <p className="text-slate-400 mt-2 max-w-xs">يمكنك من هنا مراقبة نشاط المستخدمين، إدارة مهامهم، وتعديل صلاحياتهم.</p>
                </div>
              )
            ) : (
              <motion.div
                key="categories-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                  <h2 className="text-2xl font-black mb-6">إدارة التصنيفات العالمية</h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-8">
                    التصنيفات التي تضيفها هنا ستكون متاحة لجميع المستخدمين الجدد كخيارات افتراضية، ويمكنك التحكم الكامل بها.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {globalCategories.length === 0 ? (
                      <div className="col-span-full py-20 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800 text-center">
                        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full flex items-center justify-center mb-6">
                          <Tag className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-black mb-2">لا توجد تصنيفات عالمية بعد</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm">
                          التصنيفات التي تراها في التطبيق هي تصنيفات افتراضية. لاستيرادها هنا والتحكم بها، اضغط على الزر أدناه.
                        </p>
                        <button 
                          onClick={bootstrapDefaults}
                          className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none"
                        >
                          <RefreshCw className="w-5 h-5" />
                          استيراد التصنيفات الافتراضية
                        </button>
                      </div>
                    ) : (
                      <>
                        {globalCategories.map(cat => (
                          <div 
                            key={cat.id}
                            className="bg-slate-50 dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/30 transition-all group"
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: cat.color }}>
                                <Tag className="w-6 h-6" />
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => startEditCategory(cat)}
                                  className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"
                                >
                                  <Edit2 className="w-5 h-5" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteCategory(cat.id)}
                                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                            <h3 className="text-lg font-black">{cat.name}</h3>
                            <div className="text-xs text-slate-400 mt-1 font-mono">{cat.id}</div>
                          </div>
                        ))}
                        
                        <button 
                          onClick={() => setIsAddingCategory(true)}
                          className="border-2 border-dashed border-slate-200 dark:border-slate-800 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-indigo-600 hover:text-indigo-600 transition-all group"
                        >
                          <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 transition-all">
                            <Plus className="w-6 h-6" />
                          </div>
                          <span className="font-bold">إضافة تصنيف جديد</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Add Category Modal */}
      <AnimatePresence>
        {isAddingCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-2xl font-black">{editingCategory ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}</h3>
                <button 
                  onClick={() => {
                    setIsAddingCategory(false);
                    setEditingCategory(null);
                    setNewCategory({ name: '', color: '#4f46e5' });
                  }} 
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2 mr-2">اسم التصنيف</label>
                  <input 
                    type="text" 
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    placeholder="مثلاً: رياضة، عمل، هوايات..."
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2 mr-2">لون التصنيف</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="color" 
                      value={newCategory.color}
                      onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                      className="w-16 h-16 rounded-2xl border-none cursor-pointer p-0 overflow-hidden"
                    />
                    <div className="flex-1 px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-mono text-sm text-slate-500">
                      {newCategory.color}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={handleSaveCategory}
                  disabled={!newCategory.name}
                  className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-indigo-200 dark:shadow-none"
                >
                  {editingCategory ? 'تحديث التصنيف' : 'حفظ التصنيف'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  );
}
