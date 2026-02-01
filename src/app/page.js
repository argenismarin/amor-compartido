'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Mensajes motivacionales variados
const MOTIVATIONAL_MESSAGES = [
  '¡Excelente trabajo! 🎉',
  '¡Eres increíble! 💪',
  '¡Sigue así, campeón/a! 🏆',
  '¡Lo lograste! 🌟',
  '¡Tarea completada con éxito! ✨',
  '¡Un paso más hacia la meta! 🚀',
  '¡Fantástico trabajo! 💕',
  '¡Qué crack eres! 🔥',
  '¡Productividad al máximo! ⚡',
  '¡Equipo imparable! 💑',
  '¡Así se hace! 👏',
  '¡Nada te detiene! 💫',
  '¡Orgulloso/a de ti! 🥰',
  '¡Cada tarea cuenta! 🎯',
  '¡Victoria tras victoria! 🏅',
  '¡Imparable! 💥',
  '¡Tu amor es tu fuerza! 💖',
  '¡Juntos lo lograron! 💞',
  '¡El mejor equipo del mundo! 🌍',
  '¡Amor en cada tarea! 💗',
  '¡Haciendo magia juntos! ✨💕',
  '¡Ese es mi amor! 🥰💪',
  '¡El poder del amor! 💝',
  '¡Conquistando el día! ☀️',
  '¡Brillando como siempre! 🌟💕',
  '¡El dúo perfecto! 👫✨',
];

// Mensajes especiales para mesiversarios
const MESIVERSARIO_MESSAGES = [
  '¡Felices {months} meses juntos! 💕',
  '¡{months} meses de puro amor! 💖',
  '¡Otro mes más amándote! 💞',
  '¡{months} meses y contando! 🥰',
  '¡Celebrando {months} meses de nosotros! 💗',
];

// Emojis de corazones para las animaciones
const HEART_EMOJIS = ['💕', '❤️', '💖', '💗', '💝', '💓', '💞', '🩷'];

export default function Home() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [assignedByOther, setAssignedByOther] = useState([]);
  const [activeTab, setActiveTab] = useState('myTasks');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);

  // Toast state
  const [toast, setToast] = useState(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [togglingTaskId, setTogglingTaskId] = useState(null);
  const [tasksLoading, setTasksLoading] = useState(true);

  // Celebration states
  const [floatingHearts, setFloatingHearts] = useState([]);
  const [confetti, setConfetti] = useState([]);
  const [celebrationBanner, setCelebrationBanner] = useState(null);
  const prevProgressRef = useRef(0);

  // Gamification states
  const [streak, setStreak] = useState({ current_streak: 0, best_streak: 0 });
  const [achievements, setAchievements] = useState([]);
  const [newAchievement, setNewAchievement] = useState(null);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);

  // Categories state
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // History state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState({ tasks: [], stats: { thisWeek: 0, total: 0 } });

  // Settings/Special dates state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [specialDates, setSpecialDates] = useState([]);
  const [todaySpecialDate, setTodaySpecialDate] = useState(null);
  const [mesiversarioInfo, setMesiversarioInfo] = useState(null);

  // Push notification state
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState('default');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: null,
    due_date: '',
    priority: 'medium',
    category_id: null,
    recurrence: null
  });

  // Reaction emojis
  const REACTION_EMOJIS = ['💕', '❤️', '👏', '🎉', '😍'];

  // Toast helper function
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Get random motivational message
  const getRandomMessage = useCallback(() => {
    return MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];
  }, []);

  // Trigger floating hearts animation
  const triggerFloatingHearts = useCallback(() => {
    const newHearts = [];
    const numHearts = 6 + Math.floor(Math.random() * 3); // 6-8 hearts

    for (let i = 0; i < numHearts; i++) {
      newHearts.push({
        id: Date.now() + i,
        emoji: HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)],
        left: 30 + Math.random() * 40, // 30-70% from left
        delay: Math.random() * 0.3,
      });
    }

    setFloatingHearts(newHearts);
    setTimeout(() => setFloatingHearts([]), 2000);
  }, []);

  // Trigger confetti animation
  const triggerConfetti = useCallback(() => {
    const newConfetti = [];
    const numPieces = 50;

    for (let i = 0; i < numPieces; i++) {
      const shapes = ['circle', 'square', 'heart'];
      newConfetti.push({
        id: Date.now() + i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        size: 6 + Math.random() * 8,
      });
    }

    setConfetti(newConfetti);
    setTimeout(() => setConfetti([]), 3500);
  }, []);

  // Show celebration banner
  const showCelebrationBanner = useCallback((text, subtext) => {
    setCelebrationBanner({ text, subtext });
    setTimeout(() => setCelebrationBanner(null), 3000);
  }, []);

  // Trigger mesiversario celebration
  const triggerMesiversarioCelebration = useCallback((months) => {
    const message = MESIVERSARIO_MESSAGES[Math.floor(Math.random() * MESIVERSARIO_MESSAGES.length)]
      .replace('{months}', months);
    triggerConfetti();
    triggerFloatingHearts();
    showCelebrationBanner(message, '¡El amor crece cada día! 💕');
  }, [triggerConfetti, triggerFloatingHearts, showCelebrationBanner]);

  // Register Service Worker and check notification permission
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registrado:', registration);
        })
        .catch((error) => {
          console.error('Error registrando Service Worker:', error);
        });

      // Check current notification permission
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
        setNotificationsEnabled(Notification.permission === 'granted');
      }
    }
  }, []);

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
    fetchCategories();
    fetchSpecialDates();
  }, []);

  // Fetch tasks when user changes
  useEffect(() => {
    if (currentUser) {
      fetchTasks(true); // Show skeleton on initial load / tab change
      fetchAssignedByOther();
      fetchStreak();
      fetchAchievements();
    }
  }, [currentUser, activeTab, selectedCategory]);

  // Real-time sync: Auto-refresh tasks every 5 seconds
  useEffect(() => {
    if (!currentUser) return;

    const pollInterval = setInterval(() => {
      // Solo hacer polling si la página está visible
      if (document.visibilityState === 'visible') {
        fetchTasks(false); // false = sin mostrar skeleton
        fetchAssignedByOther();
      }
    }, 5000); // 5 segundos

    // Refrescar inmediatamente al volver a la pestaña
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTasks(false);
        fetchAssignedByOther();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, activeTab, selectedCategory]);

  // Check for today's special date and mesiversario
  useEffect(() => {
    checkTodaySpecialDate();
  }, [specialDates]);

  // Celebrate mesiversario when detected
  useEffect(() => {
    if (mesiversarioInfo?.isMesiversario && !sessionStorage.getItem('mesiversarioCelebrated')) {
      setTimeout(() => {
        triggerMesiversarioCelebration(mesiversarioInfo.monthsTogether);
        sessionStorage.setItem('mesiversarioCelebrated', 'true');
      }, 1500);
    }
    if (mesiversarioInfo?.isAnniversary && !sessionStorage.getItem('anniversaryCelebrated')) {
      setTimeout(() => {
        triggerConfetti();
        triggerFloatingHearts();
        showCelebrationBanner(
          `¡Feliz Aniversario #${mesiversarioInfo.yearsTogether}!`,
          '¡Que sean muchos años más de amor! 💍💕'
        );
        sessionStorage.setItem('anniversaryCelebrated', 'true');
      }, 1500);
    }
  }, [mesiversarioInfo, triggerMesiversarioCelebration, triggerConfetti, triggerFloatingHearts, showCelebrationBanner]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data);

      // Restore user from localStorage or default to first
      const savedUserId = localStorage.getItem('currentUserId');
      const savedUser = data.find(u => u.id === parseInt(savedUserId));
      setCurrentUser(savedUser || data[0]);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      showToast('Error al cargar usuarios', 'error');
      setLoading(false);
    }
  };

  const fetchTasks = async (showSkeleton = false) => {
    if (showSkeleton) setTasksLoading(true);
    try {
      let url = '/api/tasks';
      const params = new URLSearchParams();

      if (activeTab === 'myTasks') {
        params.set('userId', currentUser.id);
        params.set('filter', 'myTasks');
      } else if (activeTab === 'assignedToOther') {
        params.set('userId', currentUser.id);
        params.set('filter', 'assignedToOther');
      }

      if (selectedCategory) {
        params.set('categoryId', selectedCategory);
      }

      url += `?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      showToast('Error al cargar tareas', 'error');
    } finally {
      setTasksLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchStreak = async () => {
    try {
      const res = await fetch(`/api/streaks?userId=${currentUser.id}`);
      const data = await res.json();
      setStreak(data);
    } catch (error) {
      console.error('Error fetching streak:', error);
    }
  };

  const fetchAchievements = async () => {
    try {
      const res = await fetch(`/api/achievements?userId=${currentUser.id}`);
      const data = await res.json();
      setAchievements(data);
    } catch (error) {
      console.error('Error fetching achievements:', error);
    }
  };

  const fetchSpecialDates = async () => {
    try {
      const res = await fetch('/api/special-dates');
      const data = await res.json();
      setSpecialDates(data.dates || data);
      if (data.mesiversarioInfo) {
        setMesiversarioInfo(data.mesiversarioInfo);
      }
    } catch (error) {
      console.error('Error fetching special dates:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/history?userId=${currentUser.id}`);
      const data = await res.json();
      setHistory(data);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const checkTodaySpecialDate = () => {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    for (const specialDate of specialDates) {
      const dateObj = new Date(specialDate.date);
      if (dateObj.getMonth() + 1 === todayMonth && dateObj.getDate() === todayDay) {
        setTodaySpecialDate(specialDate);
        return;
      }
    }
    setTodaySpecialDate(null);
  };

  const checkNewAchievements = async () => {
    try {
      const res = await fetch('/api/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });
      const data = await res.json();
      if (data.newAchievements && data.newAchievements.length > 0) {
        const achievement = data.newAchievements[0];
        setNewAchievement(achievement);
        triggerConfetti();
        setTimeout(() => setNewAchievement(null), 4000);
        fetchAchievements();
      }
    } catch (error) {
      console.error('Error checking achievements:', error);
    }
  };

  const fetchAssignedByOther = async () => {
    try {
      const res = await fetch(`/api/tasks?userId=${currentUser.id}&filter=assignedByOther`);
      const data = await res.json();
      setAssignedByOther(data);
    } catch (error) {
      console.error('Error fetching assigned by other:', error);
      showToast('Error al cargar tareas asignadas', 'error');
    }
  };

  const handleUserSwitch = (user) => {
    setCurrentUser(user);
    localStorage.setItem('currentUserId', user.id);
  };

  const handleTaskToggle = async (task) => {
    setTogglingTaskId(task.id);
    const wasCompleted = task.is_completed;
    const newCompletedStatus = !wasCompleted;

    // Optimistic update - update UI immediately
    const updateTaskInList = (list) => list.map(t =>
      t.id === task.id
        ? { ...t, is_completed: newCompletedStatus, completed_at: newCompletedStatus ? new Date().toISOString() : null }
        : t
    );

    const previousTasks = tasks;
    const previousAssignedByOther = assignedByOther;

    setTasks(updateTaskInList);
    setAssignedByOther(updateTaskInList);

    // Celebrate immediately when marking as complete
    if (newCompletedStatus) {
      triggerFloatingHearts();
      showToast(getRandomMessage());
    } else {
      showToast('Tarea marcada como pendiente');
    }

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toggle_complete: true })
      });

      if (!response.ok) {
        throw new Error('Server error');
      }

      // Check for new achievements after completing a task (background)
      if (newCompletedStatus) {
        setTimeout(() => checkNewAchievements(), 500);
        fetchStreak();
      }
    } catch (error) {
      // Rollback on error
      console.error('Error toggling task:', error);
      setTasks(previousTasks);
      setAssignedByOther(previousAssignedByOther);
      showToast('Error al actualizar la tarea', 'error');
    } finally {
      setTogglingTaskId(null);
    }
  };

  const handleReaction = async (taskId, emoji) => {
    // Optimistic update
    const updateTaskInList = (list) => list.map(t =>
      t.id === taskId ? { ...t, reaction: emoji } : t
    );

    const previousTasks = tasks;
    const previousAssignedByOther = assignedByOther;

    setTasks(updateTaskInList);
    setAssignedByOther(updateTaskInList);
    showToast('Reaccion enviada 💕');

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: emoji })
      });

      if (!response.ok) {
        throw new Error('Server error');
      }
    } catch (error) {
      // Rollback on error
      console.error('Error adding reaction:', error);
      setTasks(previousTasks);
      setAssignedByOther(previousAssignedByOther);
      showToast('Error al enviar reaccion', 'error');
    }
  };

  const saveSpecialDate = async (type, date, userId = null, label = null) => {
    try {
      await fetch('/api/special-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, date, user_id: userId, label })
      });
      fetchSpecialDates();
      showToast('Fecha guardada 💕');
    } catch (error) {
      console.error('Error saving special date:', error);
      showToast('Error al guardar fecha', 'error');
    }
  };

  const enableNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      showToast('Tu navegador no soporta notificaciones', 'error');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
          )
        });

        // Save subscription to server
        await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser?.id,
            subscription: subscription.toJSON()
          })
        });

        setNotificationsEnabled(true);
        showToast('¡Notificaciones activadas! 🔔');

        // Show a test notification
        registration.showNotification('Amor Compartido 💕', {
          body: '¡Notificaciones activadas! Te avisaremos de lo importante.',
          icon: '/icon-192.png',
          badge: '/icon-192.png'
        });
      } else {
        showToast('Permiso de notificaciones denegado', 'error');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      showToast('Error al activar notificaciones', 'error');
    }
  };

  const disableNotifications = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await fetch(`/api/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: 'DELETE'
        });
      }

      setNotificationsEnabled(false);
      showToast('Notificaciones desactivadas');
    } catch (error) {
      console.error('Error disabling notifications:', error);
      showToast('Error al desactivar notificaciones', 'error');
    }
  };

  // Helper function for VAPID key conversion
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const handleTaskDelete = async (taskId) => {
    setConfirmDialog({
      message: '¿Eliminar esta tarea?',
      onConfirm: async () => {
        setConfirmDialog(null);

        // Save task for potential rollback
        const deletedTask = tasks.find(t => t.id === taskId) || assignedByOther.find(t => t.id === taskId);
        const previousTasks = tasks;
        const previousAssignedByOther = assignedByOther;

        // Optimistic update - remove from lists immediately
        setTasks(prev => prev.filter(t => t.id !== taskId));
        setAssignedByOther(prev => prev.filter(t => t.id !== taskId));
        showToast('Tarea eliminada');

        try {
          const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });

          if (!response.ok) {
            throw new Error('Server error');
          }
        } catch (error) {
          // Rollback on error
          console.error('Error deleting task:', error);
          setTasks(previousTasks);
          setAssignedByOther(previousAssignedByOther);
          showToast('Error al eliminar la tarea', 'error');
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const isEditing = !!editingTask;
    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `/api/tasks/${editingTask.id}` : '/api/tasks';

    // Get category info for optimistic task
    const categoryInfo = categories.find(c => c.id === formData.category_id);
    const assignedToUser = users.find(u => u.id === formData.assigned_to);
    const assignedByUser = currentUser;

    // Create optimistic task object
    const optimisticTask = {
      id: isEditing ? editingTask.id : `temp-${Date.now()}`,
      ...formData,
      assigned_by: currentUser.id,
      is_completed: isEditing ? editingTask.is_completed : false,
      completed_at: isEditing ? editingTask.completed_at : null,
      created_at: isEditing ? editingTask.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assigned_to_name: assignedToUser?.name,
      assigned_to_avatar: assignedToUser?.avatar_emoji,
      assigned_by_name: assignedByUser?.name,
      assigned_by_avatar: assignedByUser?.avatar_emoji,
      category_name: categoryInfo?.name,
      category_emoji: categoryInfo?.emoji,
      category_color: categoryInfo?.color
    };

    // Save previous state for rollback
    const previousTasks = tasks;
    const previousAssignedByOther = assignedByOther;

    // Optimistic update
    if (isEditing) {
      setTasks(prev => prev.map(t => t.id === editingTask.id ? optimisticTask : t));
      setAssignedByOther(prev => prev.map(t => t.id === editingTask.id ? optimisticTask : t));
    } else {
      // Add to appropriate list based on who it's assigned to
      if (formData.assigned_to === currentUser.id) {
        setTasks(prev => [optimisticTask, ...prev]);
      } else {
        // Task assigned to other user by current user - it would appear in "Para [Partner]" tab
        if (activeTab === 'assignedToOther') {
          setTasks(prev => [optimisticTask, ...prev]);
        }
      }
    }

    setShowModal(false);
    setEditingTask(null);
    setFormData({ title: '', description: '', assigned_to: null, due_date: '', priority: 'medium', category_id: null, recurrence: null });
    showToast(isEditing ? 'Tarea actualizada' : 'Tarea creada 💕');

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          assigned_by: currentUser.id
        })
      });

      if (!response.ok) {
        throw new Error('Server error');
      }

      const result = await response.json();

      // Replace temp ID with real ID for new tasks
      if (!isEditing && result.id) {
        setTasks(prev => prev.map(t =>
          t.id === optimisticTask.id ? { ...t, id: result.id } : t
        ));
      }
    } catch (error) {
      // Rollback on error
      console.error('Error saving task:', error);
      setTasks(previousTasks);
      setAssignedByOther(previousAssignedByOther);
      showToast('Error al guardar la tarea', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openNewTask = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      assigned_to: currentUser?.id,
      due_date: '',
      priority: 'medium',
      category_id: null,
      recurrence: null
    });
    setShowModal(true);
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      assigned_to: task.assigned_to,
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      priority: task.priority,
      category_id: task.category_id || null,
      recurrence: task.recurrence || null
    });
    setShowModal(true);
  };

  const openHistory = async () => {
    await fetchHistory();
    setShowHistoryModal(true);
  };

  // Calculate progress
  const completedTasks = tasks.filter(t => t.is_completed).length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Celebrate 100% progress
  useEffect(() => {
    if (progressPercentage === 100 && prevProgressRef.current !== 100 && totalTasks > 0) {
      triggerConfetti();
      showCelebrationBanner('¡100% Completado!', '¡Felicidades, lo lograron! 🎉');
    }
    prevProgressRef.current = progressPercentage;
  }, [progressPercentage, totalTasks, triggerConfetti, showCelebrationBanner]);

  const getOtherUser = () => users.find(u => u.id !== currentUser?.id);
  
  // Check if current user is Argenis (user id 2 or name contains Argenis)
  const isArgenis = currentUser?.name?.toLowerCase().includes('argenis') || currentUser?.id === 2;

  if (loading) {
    return (
      <div className="loading" style={{ height: '100vh' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div data-user={isArgenis ? 'argenis' : 'jenifer'}>
      {/* Special Date Banner */}
      {todaySpecialDate && (
        <div className="special-date-banner" role="banner">
          <span className="special-date-emoji">
            {todaySpecialDate.type === 'anniversary' ? '💕' :
             todaySpecialDate.type.includes('birthday') ? '🎂' : '🎉'}
          </span>
          <span className="special-date-text">
            {todaySpecialDate.type === 'anniversary'
              ? `¡Feliz Aniversario! ${todaySpecialDate.label || ''}`
              : todaySpecialDate.type.includes('birthday')
                ? `¡Feliz Cumpleaños ${todaySpecialDate.user_name || ''}! 🎉`
                : todaySpecialDate.label || '¡Día especial!'}
          </span>
        </div>
      )}

      {/* Mesiversario Banner */}
      {mesiversarioInfo?.isMesiversario && !todaySpecialDate && (
        <div className="mesiversario-banner" role="banner">
          <span className="mesiversario-emoji">💕</span>
          <span className="mesiversario-text">
            ¡Felices {mesiversarioInfo.monthsTogether} meses juntos!
          </span>
          <span className="mesiversario-days">
            {mesiversarioInfo.daysTogether} días de amor
          </span>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo-container">
            <img src="/icon-192.png" alt="Logo" className="logo" />
            <span className="app-title">Amor Compartido</span>
            {streak.current_streak > 0 && (
              <span className="streak-badge" title={`Mejor racha: ${streak.best_streak} días`}>
                🔥 {streak.current_streak}
              </span>
            )}
          </div>
          <div className="header-actions">
            <button
              className="header-icon-btn"
              onClick={() => setShowAchievementsModal(true)}
              aria-label="Ver logros"
              title="Logros"
            >
              🏆
            </button>
            <button
              className="header-icon-btn"
              onClick={openHistory}
              aria-label="Ver historial"
              title="Historial"
            >
              📜
            </button>
            <button
              className="header-icon-btn"
              onClick={() => setShowSettingsModal(true)}
              aria-label="Configuracion"
              title="Configuracion"
            >
              ⚙️
            </button>
          </div>
        </div>
        <div className="user-toggle">
          {users.map(user => (
            <button
              key={user.id}
              className={`user-btn ${currentUser?.id === user.id ? 'active' : ''}`}
              onClick={() => handleUserSwitch(user)}
            >
              <span>{user.avatar_emoji}</span>
              <span>{user.name}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="main">
        {/* Progress Section */}
        <section className="progress-section">
          <div className="progress-header">
            <span className="progress-title">Tu progreso 💪</span>
            <span className="progress-percentage">{progressPercentage}%</span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progressPercentage}%` }}></div>
          </div>
          <div className="progress-stats">
            <div className="stat-item">
              <div className="stat-value">{completedTasks}</div>
              <div className="stat-label">Completadas</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{totalTasks - completedTasks}</div>
              <div className="stat-label">Pendientes</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{totalTasks}</div>
              <div className="stat-label">Total</div>
            </div>
          </div>
          {mesiversarioInfo && mesiversarioInfo.monthsTogether > 0 && (
            <div className="love-stats">
              <span className="love-stat">💕 {mesiversarioInfo.monthsTogether} meses juntos</span>
              {mesiversarioInfo.daysUntilNext > 0 && (
                <span className="love-stat-next">
                  Próximo mesiversario en {mesiversarioInfo.daysUntilNext} días
                </span>
              )}
            </div>
          )}
        </section>

        {/* Assigned by Other - Collapsible */}
        {assignedByOther.length > 0 && (
          <section className={`collapsible ${collapsibleOpen ? 'open' : ''}`}>
            <button
              className="collapsible-header"
              onClick={() => setCollapsibleOpen(!collapsibleOpen)}
              aria-expanded={collapsibleOpen}
              aria-controls="collapsible-content"
            >
              <div className="collapsible-title">
                <span>💌 Asignadas por {getOtherUser()?.name}</span>
                {assignedByOther.filter(t => !t.is_completed).length > 0 && (
                  <span className="collapsible-badge">
                    {assignedByOther.filter(t => !t.is_completed).length}
                  </span>
                )}
              </div>
              <span className="collapsible-arrow">▼</span>
            </button>
            {collapsibleOpen && (
              <div className="collapsible-content" id="collapsible-content">
                <div className="task-list">
                  {assignedByOther.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={handleTaskToggle}
                      onEdit={openEditTask}
                      onDelete={handleTaskDelete}
                      onReaction={handleReaction}
                      showAssignedBy={false}
                      currentUserId={currentUser?.id}
                      assignedByName={task.assigned_by_name}
                      togglingTaskId={togglingTaskId}
                      reactionEmojis={REACTION_EMOJIS}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'myTasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('myTasks')}
          >
            📋 Mis Tareas
          </button>
          <button
            className={`tab ${activeTab === 'assignedToOther' ? 'active' : ''}`}
            onClick={() => setActiveTab('assignedToOther')}
          >
            💝 Para {getOtherUser()?.name}
          </button>
        </div>

        {/* Category Filter */}
        {categories.length > 0 && (
          <div className="category-filter">
            <button
              className={`category-chip ${selectedCategory === null ? 'active' : ''}`}
              onClick={() => setSelectedCategory(null)}
            >
              Todas
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`category-chip ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                style={{ '--cat-color': cat.color }}
              >
                {cat.emoji} {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Task List */}
        <div className="task-list">
          {tasksLoading ? (
            // Show skeleton loaders while loading
            <>
              <TaskCardSkeleton />
              <TaskCardSkeleton />
              <TaskCardSkeleton />
            </>
          ) : tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💕</div>
              <div className="empty-state-title">No hay tareas aún</div>
              <div className="empty-state-text">
                {activeTab === 'myTasks'
                  ? 'Crea una nueva tarea para ti'
                  : `Asigna una tarea a ${getOtherUser()?.name}`
                }
              </div>
            </div>
          ) : (
            tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={handleTaskToggle}
                onEdit={openEditTask}
                onDelete={handleTaskDelete}
                onReaction={handleReaction}
                showAssignedBy={activeTab === 'myTasks'}
                currentUserId={currentUser?.id}
                assignedByName={task.assigned_by_name}
                togglingTaskId={togglingTaskId}
                reactionEmojis={REACTION_EMOJIS}
              />
            ))
          )}
        </div>
      </main>

      {/* FAB */}
      <button className="fab" onClick={openNewTask} aria-label="Nueva tarea">
        +
      </button>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingTask ? '✏️ Editar tarea' : '✨ Nueva tarea'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Título</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  placeholder="¿Qué necesitas hacer?"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Descripción (opcional)</label>
                <textarea
                  className="form-textarea"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="Detalles adicionales..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Asignar a</label>
                <div className="assign-selector" role="radiogroup" aria-label="Asignar tarea a">
                  {users.map(user => (
                    <button
                      type="button"
                      key={user.id}
                      className={`assign-option ${formData.assigned_to === user.id ? 'selected' : ''}`}
                      onClick={() => setFormData({...formData, assigned_to: user.id})}
                      role="radio"
                      aria-checked={formData.assigned_to === user.id}
                      aria-label={`Asignar a ${user.name}`}
                    >
                      <span className="assign-emoji">{user.avatar_emoji}</span>
                      <span className="assign-name">{user.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Fecha límite (opcional)</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.due_date}
                  onChange={e => setFormData({...formData, due_date: e.target.value})}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Prioridad</label>
                <div className="priority-selector" role="radiogroup" aria-label="Seleccionar prioridad">
                  {['low', 'medium', 'high'].map(p => (
                    <button
                      type="button"
                      key={p}
                      className={`priority-option ${p} ${formData.priority === p ? 'selected' : ''}`}
                      onClick={() => setFormData({...formData, priority: p})}
                      role="radio"
                      aria-checked={formData.priority === p}
                      aria-label={`Prioridad ${p === 'low' ? 'baja' : p === 'medium' ? 'media' : 'alta'}`}
                    >
                      {p === 'low' ? '🔵 Baja' : p === 'medium' ? '🟡 Media' : '🔴 Alta'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Categoria (opcional)</label>
                <div className="category-selector">
                  <button
                    type="button"
                    className={`category-option ${formData.category_id === null ? 'selected' : ''}`}
                    onClick={() => setFormData({...formData, category_id: null})}
                  >
                    Sin categoria
                  </button>
                  {categories.map(cat => (
                    <button
                      type="button"
                      key={cat.id}
                      className={`category-option ${formData.category_id === cat.id ? 'selected' : ''}`}
                      onClick={() => setFormData({...formData, category_id: cat.id})}
                      style={{ '--cat-color': cat.color }}
                    >
                      {cat.emoji} {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Repetir (opcional)</label>
                <div className="recurrence-selector">
                  {[
                    { value: null, label: 'No repetir' },
                    { value: 'daily', label: '📅 Diaria' },
                    { value: 'weekly', label: '📆 Semanal' },
                    { value: 'monthly', label: '🗓️ Mensual' }
                  ].map(opt => (
                    <button
                      type="button"
                      key={opt.value || 'none'}
                      className={`recurrence-option ${formData.recurrence === opt.value ? 'selected' : ''}`}
                      onClick={() => setFormData({...formData, recurrence: opt.value})}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={isSaving}>
                {isSaving ? 'Guardando...' : (editingTask ? 'Guardar cambios' : 'Crear tarea')} {!isSaving && '💕'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`} role="alert" aria-live="polite">
          <span className="toast-icon">
            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
          </span>
          <span className="toast-message">{toast.message}</span>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="confirm-dialog">
            <p id="confirm-title" className="confirm-message">{confirmDialog.message}</p>
            <div className="confirm-actions">
              <button
                className="confirm-btn confirm-btn-cancel"
                onClick={confirmDialog.onCancel}
              >
                Cancelar
              </button>
              <button
                className="confirm-btn confirm-btn-delete"
                onClick={confirmDialog.onConfirm}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Hearts Animation */}
      {floatingHearts.length > 0 && (
        <div className="hearts-container" aria-hidden="true">
          {floatingHearts.map(heart => (
            <span
              key={heart.id}
              className="floating-heart"
              style={{
                left: `${heart.left}%`,
                bottom: '20%',
                animationDelay: `${heart.delay}s`,
              }}
            >
              {heart.emoji}
            </span>
          ))}
        </div>
      )}

      {/* Confetti Animation */}
      {confetti.length > 0 && (
        <div className="confetti-container" aria-hidden="true">
          {confetti.map(piece => (
            <div
              key={piece.id}
              className={`confetti ${piece.shape}`}
              style={{
                left: `${piece.left}%`,
                top: '-20px',
                width: piece.shape !== 'heart' ? `${piece.size}px` : 'auto',
                height: piece.shape !== 'heart' ? `${piece.size}px` : 'auto',
                animationDelay: `${piece.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Celebration Banner */}
      {celebrationBanner && (
        <div className="celebration-banner" role="alert" aria-live="polite">
          <div className="celebration-banner-text">{celebrationBanner.text}</div>
          <div className="celebration-banner-subtext">{celebrationBanner.subtext}</div>
        </div>
      )}

      {/* New Achievement Modal */}
      {newAchievement && (
        <div className="achievement-unlock-overlay">
          <div className="achievement-unlock-modal">
            <div className="achievement-unlock-emoji">{newAchievement.emoji}</div>
            <div className="achievement-unlock-title">¡Logro desbloqueado!</div>
            <div className="achievement-unlock-name">{newAchievement.name}</div>
            <div className="achievement-unlock-desc">{newAchievement.description}</div>
          </div>
        </div>
      )}

      {/* Achievements Modal */}
      {showAchievementsModal && (
        <div className="modal-overlay" onClick={() => setShowAchievementsModal(false)}>
          <div className="modal achievements-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">🏆 Logros</h2>
              <button className="modal-close" onClick={() => setShowAchievementsModal(false)}>×</button>
            </div>
            <div className="achievements-list">
              {achievements.map(achievement => (
                <div
                  key={achievement.id}
                  className={`achievement-item ${achievement.unlocked ? 'unlocked' : 'locked'}`}
                >
                  <span className="achievement-emoji">{achievement.emoji}</span>
                  <div className="achievement-info">
                    <div className="achievement-name">{achievement.name}</div>
                    <div className="achievement-desc">{achievement.description}</div>
                    {achievement.unlocked && (
                      <div className="achievement-date">
                        Desbloqueado el {new Date(achievement.unlocked_at).toLocaleDateString('es-ES')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="achievements-stats">
              <div className="achievements-stat">
                <span className="achievements-stat-value">
                  {achievements.filter(a => a.unlocked).length}/{achievements.length}
                </span>
                <span className="achievements-stat-label">Logros</span>
              </div>
              <div className="achievements-stat">
                <span className="achievements-stat-value">🔥 {streak.best_streak}</span>
                <span className="achievements-stat-label">Mejor racha</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal history-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">📜 Historial</h2>
              <button className="modal-close" onClick={() => setShowHistoryModal(false)}>×</button>
            </div>
            <div className="history-stats">
              <div className="history-stat">
                <span className="history-stat-value">{history.stats.thisWeek}</span>
                <span className="history-stat-label">Esta semana</span>
              </div>
              <div className="history-stat">
                <span className="history-stat-value">{history.stats.total}</span>
                <span className="history-stat-label">Total completadas</span>
              </div>
            </div>
            <div className="history-list">
              {history.tasks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📝</div>
                  <div className="empty-state-text">No hay tareas completadas aún</div>
                </div>
              ) : (
                history.tasks.map(task => (
                  <div key={task.id} className="history-item">
                    <div className="history-item-header">
                      <span className="history-item-title">{task.title}</span>
                      {task.category_emoji && (
                        <span className="history-item-category">{task.category_emoji}</span>
                      )}
                    </div>
                    <div className="history-item-meta">
                      <span>✅ {new Date(task.completed_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                      {task.reaction && <span className="history-item-reaction">{task.reaction}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">⚙️ Configuracion</h2>
              <button className="modal-close" onClick={() => setShowSettingsModal(false)}>×</button>
            </div>

            <div className="settings-section">
              <h3 className="settings-section-title">🔔 Notificaciones</h3>
              <p className="settings-section-desc">
                Recibe recordatorios de mesiversarios, logros y tareas de tu amor
              </p>
              <div className="notification-toggle">
                {notificationsEnabled ? (
                  <button className="notification-btn enabled" onClick={disableNotifications}>
                    🔔 Notificaciones activadas
                  </button>
                ) : (
                  <button className="notification-btn" onClick={enableNotifications}>
                    🔕 Activar notificaciones
                  </button>
                )}
                {notificationPermission === 'denied' && (
                  <p className="notification-warning">
                    ⚠️ Las notificaciones están bloqueadas. Habilítalas en la configuración de tu navegador.
                  </p>
                )}
              </div>
            </div>

            <div className="settings-section">
              <h3 className="settings-section-title">💕 Fechas Especiales</h3>
              <p className="settings-section-desc">
                Configura fechas importantes para recibir celebraciones especiales
              </p>

              <div className="special-date-form">
                <label className="form-label">Aniversario de pareja</label>
                <input
                  type="date"
                  className="form-input"
                  value={specialDates.find(d => d.type === 'anniversary')?.date?.split('T')[0] || ''}
                  onChange={e => saveSpecialDate('anniversary', e.target.value, null, 'Aniversario')}
                />
              </div>

              {mesiversarioInfo && (
                <div className="mesiversario-info-box">
                  <div className="mesiversario-info-stat">
                    <span className="mesiversario-info-label">💕 Tiempo juntos:</span>
                    <span className="mesiversario-info-value">{mesiversarioInfo.monthsTogether} meses ({mesiversarioInfo.daysTogether} días)</span>
                  </div>
                  {mesiversarioInfo.daysUntilNext > 0 && (
                    <div className="mesiversario-info-stat">
                      <span className="mesiversario-info-label">📅 Próximo mesiversario:</span>
                      <span className="mesiversario-info-value">en {mesiversarioInfo.daysUntilNext} días</span>
                    </div>
                  )}
                </div>
              )}

              <div className="special-date-form">
                <label className="form-label">Cumpleaños de {users[0]?.name || 'Usuario 1'}</label>
                <input
                  type="date"
                  className="form-input"
                  value={specialDates.find(d => d.type === 'birthday' && d.user_id === users[0]?.id)?.date?.split('T')[0] || ''}
                  onChange={e => saveSpecialDate('birthday', e.target.value, users[0]?.id)}
                />
              </div>

              <div className="special-date-form">
                <label className="form-label">Cumpleaños de {users[1]?.name || 'Usuario 2'}</label>
                <input
                  type="date"
                  className="form-input"
                  value={specialDates.find(d => d.type === 'birthday' && d.user_id === users[1]?.id)?.date?.split('T')[0] || ''}
                  onChange={e => saveSpecialDate('birthday', e.target.value, users[1]?.id)}
                />
              </div>
            </div>

            <div className="settings-section">
              <h3 className="settings-section-title">📊 Estadísticas</h3>
              <div className="settings-stats">
                <div className="settings-stat">
                  <span>🔥 Racha actual:</span>
                  <strong>{streak.current_streak} días</strong>
                </div>
                <div className="settings-stat">
                  <span>⭐ Mejor racha:</span>
                  <strong>{streak.best_streak} días</strong>
                </div>
                <div className="settings-stat">
                  <span>🏆 Logros:</span>
                  <strong>{achievements.filter(a => a.unlocked).length}/{achievements.length}</strong>
                </div>
                {mesiversarioInfo && (
                  <div className="settings-stat">
                    <span>💕 Meses juntos:</span>
                    <strong>{mesiversarioInfo.monthsTogether}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// TaskCardSkeleton Component - Loading placeholder
function TaskCardSkeleton() {
  return (
    <div className="task-card-skeleton">
      <div className="skeleton-header">
        <div className="skeleton skeleton-checkbox"></div>
        <div className="skeleton-content">
          <div className="skeleton skeleton-title"></div>
          <div className="skeleton skeleton-description"></div>
          <div className="skeleton-meta">
            <div className="skeleton skeleton-meta-item"></div>
            <div className="skeleton skeleton-meta-item"></div>
          </div>
        </div>
        <div className="skeleton-actions">
          <div className="skeleton skeleton-action-btn"></div>
          <div className="skeleton skeleton-action-btn"></div>
        </div>
      </div>
    </div>
  );
}

// TaskCard Component
function TaskCard({ task, onToggle, onEdit, onDelete, onReaction, showAssignedBy, currentUserId, assignedByName, togglingTaskId, reactionEmojis }) {
  const [showReactions, setShowReactions] = useState(false);

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  // Determine if assigned by Jenifer (pink) or Argenis (burgundy)
  const isFromJenifer = assignedByName?.toLowerCase().includes('jenifer');
  const isFromArgenis = assignedByName?.toLowerCase().includes('argenis');
  const fromClass = isFromJenifer ? 'from-jenifer' : isFromArgenis ? 'from-argenis' : '';

  const isToggling = togglingTaskId === task.id;

  // Can react if: task is completed AND was assigned by current user to the other person
  const canReact = task.is_completed && task.assigned_by === currentUserId && task.assigned_to !== currentUserId;

  return (
    <div className={`task-card ${task.is_completed ? 'completed' : ''} priority-${task.priority} ${fromClass}`}>
      <div className="task-header">
        <button
          type="button"
          className={`task-checkbox ${task.is_completed ? 'checked' : ''} ${isToggling ? 'toggling' : ''}`}
          onClick={() => onToggle(task)}
          role="checkbox"
          aria-checked={task.is_completed}
          aria-label={`Marcar "${task.title}" como ${task.is_completed ? 'pendiente' : 'completada'}`}
          disabled={isToggling}
        />
        <div className="task-content">
          <div className="task-title-row">
            <span className="task-title">{task.title}</span>
            {task.category_emoji && (
              <span className="task-category-badge" title={task.category_name}>
                {task.category_emoji}
              </span>
            )}
            {task.recurrence && (
              <span className="task-recurrence-badge" title={`Repetir: ${task.recurrence}`}>
                🔄
              </span>
            )}
            {task.reaction && (
              <span className="task-reaction-badge">{task.reaction}</span>
            )}
          </div>
          {task.description && task.description.trim() && task.description.trim() !== '()' && (
            <div className="task-description">{task.description}</div>
          )}
          <div className="task-meta">
            {showAssignedBy && task.assigned_by !== currentUserId && (
              <span className="task-meta-item">
                💌 De {task.assigned_by_name}
              </span>
            )}
            {task.due_date && (
              <span className="task-meta-item">
                📅 {formatDate(task.due_date)}
              </span>
            )}
            <span className="task-meta-item">
              {task.priority === 'high' ? '🔴' : task.priority === 'low' ? '🔵' : '🟡'}
              {task.priority === 'high' ? 'Alta' : task.priority === 'low' ? 'Baja' : 'Media'}
            </span>
          </div>

          {/* Reaction buttons for completed tasks assigned by current user */}
          {canReact && !task.reaction && (
            <div className="task-reaction-section">
              {showReactions ? (
                <div className="reaction-picker">
                  {reactionEmojis.map(emoji => (
                    <button
                      key={emoji}
                      className="reaction-btn"
                      onClick={() => {
                        onReaction(task.id, emoji);
                        setShowReactions(false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    className="reaction-btn reaction-close"
                    onClick={() => setShowReactions(false)}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  className="add-reaction-btn"
                  onClick={() => setShowReactions(true)}
                >
                  💕 Reaccionar
                </button>
              )}
            </div>
          )}
        </div>
        <div className="task-actions">
          <button
            className="task-action-btn"
            onClick={() => onEdit(task)}
            aria-label={`Editar tarea: ${task.title}`}
          >
            ✏️
          </button>
          <button
            className="task-action-btn delete"
            onClick={() => onDelete(task.id)}
            aria-label={`Eliminar tarea: ${task.title}`}
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}
