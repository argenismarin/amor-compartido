'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MOTIVATIONAL_MESSAGES,
  MESIVERSARIO_MESSAGES,
  HEART_EMOJIS,
  REACTION_EMOJIS,
} from '@/lib/constants';
import { formatDateDisplay } from '@/lib/dates';
import useToast from '@/hooks/useToast';
import useNotifications from '@/hooks/useNotifications';
import useStreak from '@/hooks/useStreak';
import useAchievements from '@/hooks/useAchievements';
import TaskCard from '@/components/TaskCard';
import TaskCardSkeleton from '@/components/TaskCardSkeleton';
import ProjectCard from '@/components/ProjectCard';
import CelebrationOverlay from '@/components/CelebrationOverlay';
import Toast from '@/components/modals/Toast';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import TaskFormModal from '@/components/modals/TaskFormModal';
import ProjectFormModal from '@/components/modals/ProjectFormModal';
import AchievementsModal from '@/components/modals/AchievementsModal';
import HistoryModal from '@/components/modals/HistoryModal';
import SettingsModal from '@/components/modals/SettingsModal';

export default function Home() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [assignedByOther, setAssignedByOther] = useState([]);
  const [activeTab, setActiveTab] = useState('myTasks');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsibleOpen, setCollapsibleOpen] = useState(true);
  const [lastSeenAssignedByOther, setLastSeenAssignedByOther] = useState(null);

  // Restaurar preferencia del colapsible (default: abierto) y timestamp de "visto"
  useEffect(() => {
    const saved = localStorage.getItem('collapsibleOpen');
    if (saved !== null) {
      setCollapsibleOpen(saved === 'true');
    }
    const seen = localStorage.getItem('lastSeenAssignedByOther');
    setLastSeenAssignedByOther(seen || new Date(0).toISOString());
  }, []);

  const markAssignedByOtherAsSeen = useCallback(() => {
    const now = new Date().toISOString();
    localStorage.setItem('lastSeenAssignedByOther', now);
    setLastSeenAssignedByOther(now);
  }, []);

  const toggleCollapsible = useCallback(() => {
    setCollapsibleOpen(prev => {
      const next = !prev;
      localStorage.setItem('collapsibleOpen', String(next));
      return next;
    });
    // Al abrir, marcar las tareas asignadas como vistas
    if (!collapsibleOpen) {
      markAssignedByOtherAsSeen();
    }
  }, [collapsibleOpen, markAssignedByOtherAsSeen]);

  // Toast state via custom hook (soporta acción opcional con auto-dismiss)
  const { toast, showToast, dismissToast } = useToast();

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

  // Gamification state via custom hooks
  const { streak, fetchStreak } = useStreak(currentUser);
  const {
    achievements,
    newAchievement,
    fetchAchievements,
    checkNewAchievements,
  } = useAchievements(currentUser);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);

  // Categories state
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Projects state
  const [projects, setProjects] = useState([]);
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [showArchivedProjects, setShowArchivedProjects] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null); // null = ver lista, id = ver proyecto
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [projectFormData, setProjectFormData] = useState({
    name: '', description: '', emoji: '📁', color: '#6366f1', due_date: ''
  });
  const [projectTasks, setProjectTasks] = useState([]);
  const [looseTasks, setLooseTasks] = useState([]);

  // History state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState({ tasks: [], stats: { thisWeek: 0, total: 0 } });

  // Settings/Special dates state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [specialDates, setSpecialDates] = useState([]);
  const [todaySpecialDate, setTodaySpecialDate] = useState(null);
  const [mesiversarioInfo, setMesiversarioInfo] = useState(null);


  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: null,
    due_date: '',
    priority: 'medium',
    category_id: null,
    project_id: null,
    recurrence: null,
    is_shared: false
  });

  // Search & sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default');

  // Quick add state
  const [quickAddText, setQuickAddText] = useState('');

  // Restaurar preferencia de ordenamiento
  useEffect(() => {
    const saved = localStorage.getItem('sortBy');
    if (saved) setSortBy(saved);
  }, []);

  const updateSortBy = useCallback((value) => {
    setSortBy(value);
    localStorage.setItem('sortBy', value);
  }, []);

  // Aplica búsqueda + ordenamiento a una lista de tareas, manteniendo
  // incompletas primero como invariante.
  const filterAndSortTasks = useCallback((list) => {
    if (!Array.isArray(list)) return [];
    let result = list;

    // Búsqueda por título o descripción (case-insensitive)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }

    // Ordenamiento (manteniendo incompletas primero)
    if (sortBy !== 'default') {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const compareFns = {
        dueDate: (a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return String(a.due_date).localeCompare(String(b.due_date));
        },
        priority: (a, b) =>
          (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1),
        alphabetical: (a, b) => (a.title || '').localeCompare(b.title || '', 'es'),
        created: (a, b) =>
          String(b.created_at || '').localeCompare(String(a.created_at || ''))
      };
      const cmp = compareFns[sortBy];
      if (cmp) {
        result = [...result].sort((a, b) => {
          if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
          return cmp(a, b);
        });
      }
    }

    return result;
  }, [searchQuery, sortBy]);

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
    // Respetar prefers-reduced-motion: si está activo, saltar el confetti
    // (50 nodos del DOM sin animar siguen siendo carga visual innecesaria)
    if (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
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

  // Notifications hook (registra SW, gestiona suscripción push y permisos)
  const {
    notificationsEnabled,
    notificationPermission,
    enableNotifications,
    disableNotifications,
  } = useNotifications(currentUser, showToast);

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
    fetchCategories();
    fetchSpecialDates();
    fetchProjects();
    fetchArchivedProjects();
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

  // Fetch project tasks when project is selected
  useEffect(() => {
    if (activeTab === 'projects') {
      if (selectedProject) {
        fetchProjectTasks(selectedProject);
      } else {
        fetchLooseTasks();
      }
    }
  }, [activeTab, selectedProject]);

  // Real-time sync: Auto-refresh tasks every 5 seconds
  useEffect(() => {
    if (!currentUser) return;

    const pollInterval = setInterval(() => {
      // Solo hacer polling si la página está visible
      if (document.visibilityState === 'visible') {
        fetchTasks(false); // false = sin mostrar skeleton
        fetchAssignedByOther();
        fetchProjects();
        if (activeTab === 'projects') {
          if (selectedProject) {
            fetchProjectTasks(selectedProject);
          } else {
            fetchLooseTasks();
          }
        }
      }
    }, 5000); // 5 segundos

    // Refrescar inmediatamente al volver a la pestaña
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTasks(false);
        fetchAssignedByOther();
        fetchProjects();
        if (activeTab === 'projects') {
          if (selectedProject) {
            fetchProjectTasks(selectedProject);
          } else {
            fetchLooseTasks();
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, activeTab, selectedCategory, selectedProject]);

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
        params.set('excludeProjectTasks', 'true'); // Excluir tareas de proyectos
      } else if (activeTab === 'assignedToOther') {
        params.set('userId', currentUser.id);
        params.set('filter', 'assignedToOther');
        params.set('excludeProjectTasks', 'true'); // Excluir tareas de proyectos
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

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    }
  };

  const fetchArchivedProjects = async () => {
    try {
      const res = await fetch('/api/projects?includeArchived=true');
      const data = await res.json();
      const archived = Array.isArray(data) ? data.filter(p => p.is_archived) : [];
      setArchivedProjects(archived);
    } catch (error) {
      console.error('Error fetching archived projects:', error);
      setArchivedProjects([]);
    }
  };

  const fetchProjectTasks = async (projectId) => {
    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      const data = await res.json();
      setProjectTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching project tasks:', error);
      setProjectTasks([]);
    }
  };

  const fetchLooseTasks = async () => {
    try {
      const res = await fetch('/api/tasks?projectId=null');
      const data = await res.json();
      setLooseTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching loose tasks:', error);
      setLooseTasks([]);
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

  const fetchAssignedByOther = async () => {
    try {
      const res = await fetch(`/api/tasks?userId=${currentUser.id}&filter=assignedByOther&excludeProjectTasks=true`);
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
    const previousProjectTasks = projectTasks;
    const previousLooseTasks = looseTasks;

    setTasks(updateTaskInList);
    setAssignedByOther(updateTaskInList);
    setProjectTasks(updateTaskInList);
    setLooseTasks(updateTaskInList);

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

      // Refresh projects to update counts
      if (activeTab === 'projects') {
        fetchProjects();
      }
    } catch (error) {
      // Rollback on error
      console.error('Error toggling task:', error);
      setTasks(previousTasks);
      setAssignedByOther(previousAssignedByOther);
      setProjectTasks(previousProjectTasks);
      setLooseTasks(previousLooseTasks);
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
    const previousProjectTasks = projectTasks;
    const previousLooseTasks = looseTasks;

    setTasks(updateTaskInList);
    setAssignedByOther(updateTaskInList);
    setProjectTasks(updateTaskInList);
    setLooseTasks(updateTaskInList);
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
      setProjectTasks(previousProjectTasks);
      setLooseTasks(previousLooseTasks);
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

  const handleProjectSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const isEditing = !!editingProject;
    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `/api/projects/${editingProject.id}` : '/api/projects';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectFormData)
      });

      if (!response.ok) {
        throw new Error('Server error');
      }

      setShowProjectModal(false);
      setEditingProject(null);
      setProjectFormData({ name: '', description: '', emoji: '📁', color: '#6366f1', due_date: '' });
      fetchProjects();
      showToast(isEditing ? 'Proyecto actualizado' : 'Proyecto creado 📁');
    } catch (error) {
      console.error('Error saving project:', error);
      showToast('Error al guardar el proyecto', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProjectDelete = async (projectId) => {
    setConfirmDialog({
      message: '¿Archivar este proyecto?',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const response = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
          if (!response.ok) throw new Error('Server error');
          fetchProjects();
          fetchArchivedProjects();
          setSelectedProject(null);
          showToast('Proyecto archivado');
        } catch (error) {
          console.error('Error archiving project:', error);
          showToast('Error al archivar el proyecto', 'error');
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const handleRestoreProject = async (projectId) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: false })
      });
      if (!response.ok) throw new Error('Server error');
      fetchProjects();
      fetchArchivedProjects();
      showToast('Proyecto restaurado');
    } catch (error) {
      console.error('Error restoring project:', error);
      showToast('Error al restaurar el proyecto', 'error');
    }
  };

  const handleDeleteProjectPermanently = async (projectId, projectName) => {
    setConfirmDialog({
      message: `¿Eliminar "${projectName}" permanentemente? Esto borrará todas sus tareas.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const response = await fetch(`/api/projects/${projectId}?permanent=true`, { method: 'DELETE' });
          if (!response.ok) throw new Error('Server error');
          fetchArchivedProjects();
          showToast('Proyecto eliminado permanentemente');
        } catch (error) {
          console.error('Error deleting project:', error);
          showToast('Error al eliminar el proyecto', 'error');
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const openNewProject = () => {
    setEditingProject(null);
    setProjectFormData({ name: '', description: '', emoji: '📁', color: '#6366f1', due_date: '' });
    setShowProjectModal(true);
  };

  const openEditProject = (project) => {
    setEditingProject(project);
    setProjectFormData({
      name: project.name,
      description: project.description || '',
      emoji: project.emoji || '📁',
      color: project.color || '#6366f1',
      due_date: project.due_date ? project.due_date.split('T')[0] : ''
    });
    setShowProjectModal(true);
  };

  const handleUndoDelete = useCallback(async (taskId) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/restore`, { method: 'POST' });
      if (!response.ok) throw new Error('Server error');

      // Refrescar las listas
      if (currentUser) {
        fetchTasks(false);
        fetchAssignedByOther();
      }
      if (activeTab === 'projects') {
        fetchProjects();
        if (selectedProject) {
          fetchProjectTasks(selectedProject);
        } else {
          fetchLooseTasks();
        }
      }

      showToast('Tarea restaurada 💕');
    } catch (error) {
      console.error('Error restoring task:', error);
      showToast('Error al deshacer', 'error');
    }
  }, [currentUser, activeTab, selectedProject, showToast]);

  const handleTaskDelete = async (taskId) => {
    // Soft delete + undo: sin confirmDialog, el undo de 7s actúa como red de seguridad.
    const previousTasks = tasks;
    const previousAssignedByOther = assignedByOther;
    const previousProjectTasks = projectTasks;
    const previousLooseTasks = looseTasks;

    // Optimistic update - remove from lists immediately
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setAssignedByOther(prev => prev.filter(t => t.id !== taskId));
    setProjectTasks(prev => prev.filter(t => t.id !== taskId));
    setLooseTasks(prev => prev.filter(t => t.id !== taskId));

    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });

      if (!response.ok) {
        throw new Error('Server error');
      }

      showToast('Tarea eliminada', 'success', {
        duration: 7000,
        action: {
          label: 'Deshacer',
          onClick: () => handleUndoDelete(taskId)
        }
      });

      // Refresh projects to update counts
      if (activeTab === 'projects') {
        fetchProjects();
      }
    } catch (error) {
      // Rollback on error
      console.error('Error deleting task:', error);
      setTasks(previousTasks);
      setAssignedByOther(previousAssignedByOther);
      setProjectTasks(previousProjectTasks);
      setLooseTasks(previousLooseTasks);
      showToast('Error al eliminar la tarea', 'error');
    }
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
    setFormData({ title: '', description: '', assigned_to: null, due_date: '', priority: 'medium', category_id: null, project_id: null, recurrence: null, is_shared: false });
    showToast(isEditing ? 'Tarea actualizada' : 'Tarea creada 💕');

    // Refresh project data if we're in projects tab
    if (activeTab === 'projects') {
      fetchProjects();
      if (selectedProject) {
        fetchProjectTasks(selectedProject);
      } else {
        fetchLooseTasks();
      }
    }

    try {
      const payload = {
        ...formData,
        assigned_by: currentUser.id,
      };
      // Optimistic locking: si estamos editando, mandamos el updated_at
      // que vimos para que el server detecte si cambió desde entonces.
      if (isEditing && editingTask?.updated_at) {
        payload.expected_updated_at = editingTask.updated_at;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // 409 Conflict: la pareja editó la tarea entre que la abrimos y guardamos
      if (response.status === 409) {
        setTasks(previousTasks);
        setAssignedByOther(previousAssignedByOther);
        // Refrescar para que el usuario vea la versión actual
        fetchTasks(false);
        fetchAssignedByOther();
        showToast('Tu pareja editó esta tarea, refrescamos los cambios', 'info', { duration: 5000 });
        return;
      }

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

  // Subtareas: helper para aplicar un cambio a la subtarea de una tarea
  // dentro de cualquiera de las listas activas (tasks, assignedByOther,
  // projectTasks, looseTasks).
  const updateTaskSubtasks = useCallback((taskId, updaterFn) => {
    const apply = (list) => list.map(t =>
      t.id === taskId
        ? { ...t, subtasks: updaterFn(Array.isArray(t.subtasks) ? t.subtasks : []) }
        : t
    );
    setTasks(apply);
    setAssignedByOther(apply);
    setProjectTasks(apply);
    setLooseTasks(apply);
  }, []);

  const handleSubtaskAdd = useCallback(async (taskId, title) => {
    if (!title || !title.trim()) return;
    const trimmed = title.trim();

    // Optimistic con id temporal
    const tempId = `temp-sub-${Date.now()}`;
    updateTaskSubtasks(taskId, prev => [
      ...prev,
      { id: tempId, title: trimmed, is_completed: false, sort_order: prev.length + 1 }
    ]);

    try {
      const res = await fetch('/api/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, title: trimmed }),
      });
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      // Reemplazar id temporal con id real
      updateTaskSubtasks(taskId, prev => prev.map(s =>
        s.id === tempId ? { ...s, id: data.subtask.id } : s
      ));
    } catch (error) {
      console.error('Error adding subtask:', error);
      // Rollback: quitar la subtarea optimista
      updateTaskSubtasks(taskId, prev => prev.filter(s => s.id !== tempId));
      showToast('Error al agregar subtarea', 'error');
    }
  }, [updateTaskSubtasks, showToast]);

  const handleSubtaskToggle = useCallback(async (taskId, subtaskId) => {
    // Optimistic
    updateTaskSubtasks(taskId, prev => prev.map(s =>
      s.id === subtaskId ? { ...s, is_completed: !s.is_completed } : s
    ));

    try {
      const res = await fetch(`/api/subtasks/${subtaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toggle_complete: true }),
      });
      if (!res.ok) throw new Error('Server error');
    } catch (error) {
      console.error('Error toggling subtask:', error);
      // Rollback
      updateTaskSubtasks(taskId, prev => prev.map(s =>
        s.id === subtaskId ? { ...s, is_completed: !s.is_completed } : s
      ));
      showToast('Error al actualizar subtarea', 'error');
    }
  }, [updateTaskSubtasks, showToast]);

  const handleSubtaskDelete = useCallback(async (taskId, subtaskId) => {
    // Optimistic — guardamos la subtarea por si hay que revertir
    let removedSubtask = null;
    updateTaskSubtasks(taskId, prev => {
      removedSubtask = prev.find(s => s.id === subtaskId);
      return prev.filter(s => s.id !== subtaskId);
    });

    try {
      const res = await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Server error');
    } catch (error) {
      console.error('Error deleting subtask:', error);
      // Rollback
      if (removedSubtask) {
        updateTaskSubtasks(taskId, prev => [...prev, removedSubtask]
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
      }
      showToast('Error al eliminar subtarea', 'error');
    }
  }, [updateTaskSubtasks, showToast]);

  // Quick add: crea una tarea con título solamente, sin abrir modal.
  // Asignación derivada del contexto actual (tab + proyecto seleccionado).
  const handleQuickAdd = async (e) => {
    e.preventDefault();
    const title = quickAddText.trim();
    if (!title || !currentUser) return;

    let assignedTo = currentUser.id;
    let projectId = null;

    if (activeTab === 'assignedToOther') {
      assignedTo = getOtherUser()?.id || currentUser.id;
    } else if (activeTab === 'projects' && selectedProject) {
      projectId = selectedProject;
    }

    const payload = {
      title,
      description: null,
      assigned_to: assignedTo,
      assigned_by: currentUser.id,
      due_date: null,
      priority: 'medium',
      category_id: null,
      project_id: projectId,
      recurrence: null,
      is_shared: false,
    };

    const assignedToUser = users.find(u => u.id === assignedTo);
    const optimisticTask = {
      id: `temp-${Date.now()}`,
      ...payload,
      is_completed: false,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assigned_to_name: assignedToUser?.name,
      assigned_to_avatar: assignedToUser?.avatar_emoji,
      assigned_by_name: currentUser.name,
      assigned_by_avatar: currentUser.avatar_emoji,
    };

    // Optimistic update según contexto
    if (projectId) {
      setProjectTasks(prev => [optimisticTask, ...prev]);
    } else {
      setTasks(prev => [optimisticTask, ...prev]);
    }

    setQuickAddText('');

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Server error');
      const result = await res.json();

      // Reemplazar temp ID con id real
      if (result.id) {
        const replaceId = (list) => list.map(t =>
          t.id === optimisticTask.id ? { ...t, id: result.id } : t
        );
        setTasks(replaceId);
        setProjectTasks(replaceId);
      }

      if (activeTab === 'projects') fetchProjects();
    } catch (error) {
      console.error('Error en quick add:', error);
      const removeOpt = (list) => list.filter(t => t.id !== optimisticTask.id);
      setTasks(removeOpt);
      setProjectTasks(removeOpt);
      showToast('Error al agregar tarea', 'error');
    }
  };

  const openNewTask = (projectId = null) => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      assigned_to: currentUser?.id,
      due_date: '',
      priority: 'medium',
      category_id: null,
      project_id: projectId || (activeTab === 'projects' && selectedProject ? selectedProject : null),
      recurrence: null,
      is_shared: false
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
      project_id: task.project_id || null,
      recurrence: task.recurrence || null,
      is_shared: task.is_shared || false
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

  // Celebrate when a new achievement is unlocked (gestionado por useAchievements)
  useEffect(() => {
    if (newAchievement) {
      triggerConfetti();
    }
  }, [newAchievement, triggerConfetti]);

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
              type="button"
              className="collapsible-header"
              onClick={toggleCollapsible}
              aria-expanded={collapsibleOpen}
              aria-controls="collapsible-content"
            >
              <div className="collapsible-title">
                <span>💌 Asignadas por {getOtherUser()?.name}</span>
                {(() => {
                  const pendingCount = assignedByOther.filter(t => !t.is_completed).length;
                  const newCount = lastSeenAssignedByOther
                    ? assignedByOther.filter(t =>
                        !t.is_completed &&
                        t.created_at &&
                        new Date(t.created_at) > new Date(lastSeenAssignedByOther)
                      ).length
                    : 0;
                  if (pendingCount === 0) return null;
                  return (
                    <span className="collapsible-badge">
                      {pendingCount}
                      {newCount > 0 && (
                        <span
                          className="badge-new-dot"
                          title={`${newCount} ${newCount === 1 ? 'nueva' : 'nuevas'}`}
                          aria-label={`${newCount} sin ver`}
                        />
                      )}
                    </span>
                  );
                })()}
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
                      reactionEmojis={REACTION_EMOJIS} onSubtaskAdd={handleSubtaskAdd} onSubtaskToggle={handleSubtaskToggle} onSubtaskDelete={handleSubtaskDelete}
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
            onClick={() => { setActiveTab('myTasks'); setSelectedProject(null); }}
          >
            📋 Mis Tareas
          </button>
          <button
            className={`tab ${activeTab === 'assignedToOther' ? 'active' : ''}`}
            onClick={() => { setActiveTab('assignedToOther'); setSelectedProject(null); }}
          >
            💝 Para {getOtherUser()?.name}
          </button>
          <button
            className={`tab ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => { setActiveTab('projects'); setSelectedProject(null); }}
          >
            📁 Proyectos
          </button>
        </div>

        {/* Search & sort toolbar - only for tareas y proyectos */}
        {(activeTab === 'myTasks' || activeTab === 'assignedToOther' || (activeTab === 'projects' && selectedProject)) && (
          <>
            <div className="task-toolbar">
              <div className="search-input-wrapper">
                <span className="search-icon" aria-hidden="true">🔍</span>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Buscar tareas..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  aria-label="Buscar tareas"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-clear"
                    onClick={() => setSearchQuery('')}
                    aria-label="Limpiar búsqueda"
                  >
                    ×
                  </button>
                )}
              </div>
              <select
                className="sort-select"
                value={sortBy}
                onChange={e => updateSortBy(e.target.value)}
                aria-label="Ordenar tareas"
              >
                <option value="default">Por defecto</option>
                <option value="dueDate">Fecha límite</option>
                <option value="priority">Prioridad</option>
                <option value="alphabetical">A-Z</option>
                <option value="created">Más recientes</option>
              </select>
            </div>

            {/* Quick add - input de una línea para crear tarea sin abrir modal */}
            <form className="quick-add" onSubmit={handleQuickAdd}>
              <input
                type="text"
                className="quick-add-input"
                placeholder={
                  activeTab === 'assignedToOther'
                    ? `Agregar para ${getOtherUser()?.name}...`
                    : 'Agregar tarea rápida...'
                }
                value={quickAddText}
                onChange={e => setQuickAddText(e.target.value)}
                aria-label="Agregar tarea rápida"
              />
              <button
                type="submit"
                className="quick-add-btn"
                disabled={!quickAddText.trim()}
                aria-label="Agregar"
              >
                +
              </button>
            </form>
          </>
        )}

        {/* Category Filter - only show for myTasks and assignedToOther */}
        {activeTab !== 'projects' && categories.length > 0 && (
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

        {/* Projects View */}
        {activeTab === 'projects' && (
          <>
            {selectedProject ? (
              // View tasks of selected project
              <div className="project-tasks-view">
                {(() => {
                  const project = projects.find(p => p.id === selectedProject);
                  return project ? (
                    <div className="project-header-detail">
                      <button
                        className="back-button"
                        onClick={() => setSelectedProject(null)}
                      >
                        ← Volver
                      </button>
                      <div className="project-title-row">
                        <span className="project-emoji-large">{project.emoji}</span>
                        <div className="project-info">
                          <h2 className="project-name-large">{project.name}</h2>
                          {project.description && (
                            <p className="project-description-large">{project.description}</p>
                          )}
                        </div>
                        <div className="project-actions-header">
                          <button
                            className="project-action-btn"
                            onClick={() => openEditProject(project)}
                            aria-label="Editar proyecto"
                          >
                            ✏️
                          </button>
                          <button
                            className="project-action-btn delete"
                            onClick={() => handleProjectDelete(project.id)}
                            aria-label="Archivar proyecto"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      <div className="project-progress-bar">
                        <div
                          className="project-progress-fill"
                          style={{
                            width: `${project.total_tasks > 0 ? (project.completed_tasks / project.total_tasks) * 100 : 0}%`,
                            backgroundColor: project.color
                          }}
                        />
                      </div>
                      <div className="project-stats-detail">
                        <span>{project.completed_tasks}/{project.total_tasks} tareas</span>
                        {project.due_date && (
                          <span>📅 {formatDateDisplay(project.due_date)}</span>
                        )}
                      </div>
                    </div>
                  ) : null;
                })()}
                {(() => {
                  const visibleProjectTasks = filterAndSortTasks(projectTasks);
                  return (
                    <div className="task-list">
                      {projectTasks.length === 0 ? (
                        <div className="empty-state">
                          <div className="empty-state-icon">📋</div>
                          <div className="empty-state-title">Sin tareas en este proyecto</div>
                          <div className="empty-state-text">Agrega tareas con el botón +</div>
                        </div>
                      ) : visibleProjectTasks.length === 0 ? (
                        <div className="empty-state">
                          <div className="empty-state-icon">🔍</div>
                          <div className="empty-state-title">Sin resultados</div>
                          <div className="empty-state-text">
                            Ninguna tarea coincide con &quot;{searchQuery}&quot;
                          </div>
                        </div>
                      ) : (
                        visibleProjectTasks.map(task => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onToggle={handleTaskToggle}
                            onEdit={openEditTask}
                            onDelete={handleTaskDelete}
                            onReaction={handleReaction}
                            showAssignedBy={true}
                            currentUserId={currentUser?.id}
                            assignedByName={task.assigned_by_name}
                            togglingTaskId={togglingTaskId}
                            reactionEmojis={REACTION_EMOJIS} onSubtaskAdd={handleSubtaskAdd} onSubtaskToggle={handleSubtaskToggle} onSubtaskDelete={handleSubtaskDelete}
                          />
                        ))
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              // View project list
              <div className="projects-view">
                <button className="new-project-btn" onClick={openNewProject}>
                  <span className="new-project-icon">+</span>
                  <span className="new-project-text">Nuevo Proyecto</span>
                </button>

                <div className="projects-grid">
                  {projects.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onSelect={() => setSelectedProject(project.id)}
                      onEdit={() => openEditProject(project)}
                      onDelete={() => handleProjectDelete(project.id)}
                    />
                  ))}
                </div>

                {/* Loose tasks section */}
                {looseTasks.length > 0 && (
                  <div className="loose-tasks-section">
                    <h3 className="loose-tasks-title">📌 Tareas sueltas</h3>
                    <p className="loose-tasks-subtitle">Tareas sin proyecto asignado</p>
                    <div className="task-list">
                      {looseTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onToggle={handleTaskToggle}
                          onEdit={openEditTask}
                          onDelete={handleTaskDelete}
                          onReaction={handleReaction}
                          showAssignedBy={true}
                          currentUserId={currentUser?.id}
                          assignedByName={task.assigned_by_name}
                          togglingTaskId={togglingTaskId}
                          reactionEmojis={REACTION_EMOJIS} onSubtaskAdd={handleSubtaskAdd} onSubtaskToggle={handleSubtaskToggle} onSubtaskDelete={handleSubtaskDelete}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Archived projects section */}
                {archivedProjects.length > 0 && (
                  <div className="archived-projects-section">
                    <button
                      className="archived-projects-toggle"
                      onClick={() => setShowArchivedProjects(!showArchivedProjects)}
                    >
                      <span>📦 Proyectos archivados ({archivedProjects.length})</span>
                      <span className={`toggle-arrow ${showArchivedProjects ? 'open' : ''}`}>▼</span>
                    </button>
                    {showArchivedProjects && (
                      <div className="archived-projects-list">
                        {archivedProjects.map(project => (
                          <div key={project.id} className="archived-project-card">
                            <div className="archived-project-info">
                              <span className="archived-project-emoji">{project.emoji}</span>
                              <div className="archived-project-details">
                                <span className="archived-project-name">{project.name}</span>
                                <span className="archived-project-stats">
                                  {project.completed_tasks}/{project.total_tasks} tareas completadas
                                </span>
                              </div>
                            </div>
                            <div className="archived-project-actions">
                              <button
                                className="restore-project-btn"
                                onClick={() => handleRestoreProject(project.id)}
                                title="Restaurar proyecto"
                              >
                                ↩️
                              </button>
                              <button
                                className="delete-project-btn"
                                onClick={() => handleDeleteProjectPermanently(project.id, project.name)}
                                title="Eliminar permanentemente"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Task List - only show for myTasks and assignedToOther */}
        {activeTab !== 'projects' && (() => {
          const visibleTasks = filterAndSortTasks(tasks);
          return (
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
              ) : visibleTasks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <div className="empty-state-title">Sin resultados</div>
                  <div className="empty-state-text">
                    Ninguna tarea coincide con &quot;{searchQuery}&quot;
                  </div>
                </div>
              ) : (
                visibleTasks.map(task => (
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
                    reactionEmojis={REACTION_EMOJIS} onSubtaskAdd={handleSubtaskAdd} onSubtaskToggle={handleSubtaskToggle} onSubtaskDelete={handleSubtaskDelete}
                  />
                ))
              )}
            </div>
          );
        })()}
      </main>

      {/* FAB */}
      <button className="fab" onClick={() => openNewTask()} aria-label="Nueva tarea">
        +
      </button>

      {showModal && (
        <TaskFormModal
          editingTask={editingTask}
          formData={formData}
          setFormData={setFormData}
          users={users}
          currentUser={currentUser}
          projects={projects}
          categories={categories}
          isSaving={isSaving}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
        />
      )}

      {showProjectModal && (
        <ProjectFormModal
          editingProject={editingProject}
          formData={projectFormData}
          setFormData={setProjectFormData}
          isSaving={isSaving}
          onSubmit={handleProjectSubmit}
          onClose={() => setShowProjectModal(false)}
        />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />

      <ConfirmDialog dialog={confirmDialog} />

      <CelebrationOverlay
        floatingHearts={floatingHearts}
        confetti={confetti}
        celebrationBanner={celebrationBanner}
        newAchievement={newAchievement}
      />

      {showAchievementsModal && (
        <AchievementsModal
          achievements={achievements}
          streak={streak}
          onClose={() => setShowAchievementsModal(false)}
        />
      )}

      {showHistoryModal && (
        <HistoryModal
          history={history}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          users={users}
          specialDates={specialDates}
          mesiversarioInfo={mesiversarioInfo}
          streak={streak}
          achievements={achievements}
          notificationsEnabled={notificationsEnabled}
          notificationPermission={notificationPermission}
          onEnableNotifications={enableNotifications}
          onDisableNotifications={disableNotifications}
          onSaveSpecialDate={saveSpecialDate}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
}
