'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
  MOTIVATIONAL_MESSAGES,
  MESIVERSARIO_MESSAGES,
  HEART_EMOJIS,
  REACTION_EMOJIS,
} from '@/lib/constants';
import { formatDateDisplay } from '@/lib/dates';
import { fuzzyMatch } from '@/lib/fuzzy';
import { fetchJson } from '@/lib/api';
import useToast from '@/hooks/useToast';
import useUsers from '@/hooks/useUsers';
import useNotifications from '@/hooks/useNotifications';
import useStreak from '@/hooks/useStreak';
import useAchievements from '@/hooks/useAchievements';
import useSpecialDates from '@/hooks/useSpecialDates';
import usePolling from '@/hooks/usePolling';
import useTasks from '@/hooks/useTasks';
import useTheme from '@/hooks/useTheme';
import useInstallPrompt from '@/hooks/useInstallPrompt';
import TaskCard from '@/components/TaskCard';
import TaskCardSkeleton from '@/components/TaskCardSkeleton';
import ProjectCard from '@/components/ProjectCard';
import CelebrationOverlay from '@/components/CelebrationOverlay';
import OfflineBadge from '@/components/OfflineBadge';
import InstallPromptBanner from '@/components/InstallPromptBanner';
import Toast from '@/components/modals/Toast';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import TaskFormModal from '@/components/modals/TaskFormModal';
import ProjectFormModal from '@/components/modals/ProjectFormModal';
import ProjectTemplatePicker from '@/components/modals/ProjectTemplatePicker';
import AchievementsModal from '@/components/modals/AchievementsModal';
import HistoryModal from '@/components/modals/HistoryModal';
import SettingsModal from '@/components/modals/SettingsModal';

export default function Home() {
  // Toast state (declarado primero porque otros hooks lo reciben como dep)
  const { toast, showToast, dismissToast, pauseTimer, resumeTimer } = useToast();

  // Users state via custom hook (lista, currentUser, switch)
  const { users, currentUser, loading, switchUser } = useUsers(showToast);

  const [activeTab, setActiveTab] = useState('myTasks');
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


  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState(null);

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
  // isSavingProject está separado de isSaving (de useTasks) para que el
  // spinner del modal de proyecto no se contamine con guardados de tareas
  // (y viceversa). Antes ambos compartían isSaving y se desincronizaban.
  const [isSavingProject, setIsSavingProject] = useState(false);

  // History state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState({ tasks: [], stats: { thisWeek: 0, total: 0 } });

  // Settings/Special dates state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const { specialDates, todaySpecialDate, mesiversarioInfo, saveSpecialDate } =
    useSpecialDates(showToast);

  // Theme picker (light/dark/auto, persiste en localStorage)
  const { theme, setTheme } = useTheme();

  // PWA install prompt (captura beforeinstallprompt, ofrece banner)
  const { isInstallable, promptInstall, dismiss: dismissInstall } = useInstallPrompt();

  // Project templates state
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [busyTemplateId, setBusyTemplateId] = useState(null);

  const handleCreateFromTemplate = useCallback(async (template) => {
    if (!currentUser) return;
    setBusyTemplateId(template.id);
    try {
      // 1. Crear proyecto
      const projRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          emoji: template.emoji,
          color: template.color,
        }),
      });
      if (!projRes.ok) throw new Error('Failed to create project');
      const { id: projectId } = await projRes.json();

      // 2. Crear tareas en serie (no paralelo: rate limit + orden visual)
      for (const t of template.tasks) {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: t.title,
            description: null,
            assigned_to: currentUser.id,
            assigned_by: currentUser.id,
            priority: t.priority || 'medium',
            project_id: projectId,
            recurrence: t.recurrence || null,
            recurrence_days: t.recurrence_days || null,
            is_shared: true,
          }),
        });
      }

      fetchProjects();
      setShowTemplatesModal(false);
      showToast(`Proyecto "${template.name}" creado con ${template.tasks.length} tareas 📦`);
    } catch (err) {
      console.error('Error creating from template:', err);
      showToast('Error al crear desde plantilla', 'error');
    } finally {
      setBusyTemplateId(null);
    }
  }, [currentUser, showToast]);

  // Deep link state: si la URL trae ?task=N o ?project=N (porque vino
  // redirigida desde /task/[id] o /project/[id]), recordamos el id para
  // que un useEffect mas abajo abra el modal/proyecto cuando los datos
  // esten cargados. Solo se hace una vez por carga de pagina — luego
  // limpiamos el query param para que refrescos no re-disparen la
  // accion accidentalmente.
  const [pendingTaskDeepLink, setPendingTaskDeepLink] = useState(null);
  const [pendingProjectDeepLink, setPendingProjectDeepLink] = useState(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('task');
    const projectId = params.get('project');
    if (taskId) setPendingTaskDeepLink(parseInt(taskId, 10));
    if (projectId) setPendingProjectDeepLink(parseInt(projectId, 10));
    if (taskId || projectId) {
      // Limpiar la URL para que el deep link no se re-procese al cambiar tab.
      window.history.replaceState({}, '', '/');
    }
  }, []);


  // Search & sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default');

  // Filtros avanzados — null = sin filtro
  // dateFilter: 'today' | 'overdue' | 'week' | null
  // assigneeFilter: userId | 'shared' | null
  const [dateFilter, setDateFilter] = useState(null);
  const [assigneeFilter, setAssigneeFilter] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);


  // Restaurar preferencia de ordenamiento
  useEffect(() => {
    const saved = localStorage.getItem('sortBy');
    if (saved) setSortBy(saved);
  }, []);

  const updateSortBy = useCallback((value) => {
    setSortBy(value);
    localStorage.setItem('sortBy', value);
  }, []);

  // Aplica búsqueda + filtros + ordenamiento a una lista de tareas,
  // manteniendo incompletas primero como invariante.
  const filterAndSortTasks = useCallback((list) => {
    if (!Array.isArray(list)) return [];
    let result = list;

    // Búsqueda fuzzy por título o descripción (acentos, subsecuencia,
    // multi-word). Ver src/lib/fuzzy.js.
    if (searchQuery.trim()) {
      result = result.filter(
        (t) => fuzzyMatch(searchQuery, t.title) || fuzzyMatch(searchQuery, t.description || '')
      );
    }

    // Filtro por fecha
    if (dateFilter) {
      const now = new Date();
      const todayStr =
        now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
      const weekFromNow = new Date(now);
      weekFromNow.setDate(now.getDate() + 7);
      const weekStr =
        weekFromNow.getFullYear() + '-' +
        String(weekFromNow.getMonth() + 1).padStart(2, '0') + '-' +
        String(weekFromNow.getDate()).padStart(2, '0');

      result = result.filter((t) => {
        const due = t.due_date ? String(t.due_date).slice(0, 10) : null;
        if (dateFilter === 'today') return due === todayStr;
        if (dateFilter === 'overdue') return due && due < todayStr && !t.is_completed;
        if (dateFilter === 'week') return due && due >= todayStr && due <= weekStr;
        return true;
      });
    }

    // Filtro por asignado
    if (assigneeFilter !== null) {
      if (assigneeFilter === 'shared') {
        result = result.filter((t) => t.is_shared);
      } else {
        result = result.filter((t) => t.assigned_to === assigneeFilter);
      }
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
  }, [searchQuery, sortBy, dateFilter, assigneeFilter]);

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

    // D5 — Adaptive confetti según hardware del device.
    // Devices con pocos cores o save-data activado reciben menos piezas
    // para no afectar el FPS. La detección de hardwareConcurrency tiene
    // baja resolución (mismo valor para muchos devices) pero como heurística
    // de "es un device modesto" funciona bien.
    let numPieces = 50;
    if (typeof navigator !== 'undefined') {
      const cores = navigator.hardwareConcurrency || 4;
      const saveData = navigator.connection?.saveData === true;
      if (saveData || cores <= 2) {
        numPieces = 15;
      } else if (cores <= 4) {
        numPieces = 30;
      }
    }

    const newConfetti = [];
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

  // Fetch streak y achievements al cambiar currentUser
  // (las tareas las maneja useTasks internamente)
  useEffect(() => {
    if (currentUser) {
      fetchStreak();
      fetchAchievements();
    }
  }, [currentUser, fetchStreak, fetchAchievements]);

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

  const fetchCategories = async () => {
    try {
      const data = await fetchJson('/api/categories');
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const data = await fetchJson('/api/projects');
      setProjects(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    }
  };

  const fetchArchivedProjects = async () => {
    try {
      const data = await fetchJson('/api/projects?includeArchived=true');
      const archived = Array.isArray(data) ? data.filter(p => p.is_archived) : [];
      setArchivedProjects(archived);
    } catch (error) {
      console.error('Error fetching archived projects:', error);
      setArchivedProjects([]);
    }
  };

  // Carga inicial de categories/projects/archivedProjects al montar.
  // Las funciones tienen que estar declaradas ANTES del useEffect (Next 16
  // tiene una regla react-hooks/immutability que valida esto).
  useEffect(() => {
    fetchCategories();
    fetchProjects();
    fetchArchivedProjects();
  }, []);

  const fetchHistory = async () => {
    try {
      const data = await fetchJson(`/api/history?userId=${currentUser.id}`);
      setHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  // ─── useTasks: encapsula TODO el state y handlers de tareas ──────
  // Tiene que ir después de declarar fetchProjects, triggerFloatingHearts
  // y getRandomMessage porque los recibe como deps.
  const {
    tasks, setTasks,
    assignedByOther, setAssignedByOther,
    projectTasks,
    looseTasks,
    tasksLoading,
    togglingTaskId,
    showModal, setShowModal,
    editingTask, setEditingTask,
    formData, setFormData,
    isSaving,
    quickAddText, setQuickAddText,
    fetchTasks,
    fetchAssignedByOther,
    fetchProjectTasks,
    fetchLooseTasks,
    handleTaskToggle,
    handleReaction,
    handleTaskDelete,
    handleSubmit,
    handleQuickAdd,
    openNewTask,
    openEditTask,
    handleSubtaskAdd,
    handleSubtaskToggle,
    handleSubtaskDelete,
    handleSubtaskReorder,
  } = useTasks({
    currentUser,
    activeTab,
    selectedCategory,
    selectedProject,
    projects,
    categories,
    users,
    showToast,
    fetchStreak,
    checkNewAchievements,
    triggerFloatingHearts,
    getRandomMessage,
    refreshProjects: fetchProjects,
  });

  // Resolver deep links cuando los datos esten cargados.
  // tasks deep link: cuando llegan tasks, buscamos el id y abrimos el modal.
  useEffect(() => {
    if (!pendingTaskDeepLink || !tasks || tasks.length === 0) return;
    const allLists = [...tasks, ...assignedByOther, ...projectTasks, ...looseTasks];
    const target = allLists.find((t) => t.id === pendingTaskDeepLink);
    if (target) {
      openEditTask(target);
      setPendingTaskDeepLink(null);
    }
  }, [pendingTaskDeepLink, tasks, assignedByOther, projectTasks, looseTasks, openEditTask]);

  // project deep link: cuando llegan projects, switch tab y selectedProject
  useEffect(() => {
    if (!pendingProjectDeepLink || !projects || projects.length === 0) return;
    const target = projects.find((p) => p.id === pendingProjectDeepLink);
    if (target) {
      setActiveTab('projects');
      setSelectedProject(target.id);
      setPendingProjectDeepLink(null);
    }
  }, [pendingProjectDeepLink, projects]);

  // Polling: refresca cada 5s. Solo fetch de projects cuando estás en
  // esa tab — antes corría siempre y consumía ancho de banda + DB sin
  // necesidad cuando el usuario está en "Mis tareas" o "Para pareja".
  usePolling(!!currentUser, 5000, () => {
    fetchTasks(false);
    fetchAssignedByOther();
    if (activeTab === 'projects') {
      fetchProjects();
      if (selectedProject) {
        fetchProjectTasks(selectedProject);
      } else {
        fetchLooseTasks();
      }
    }
  });


  const openHistory = async () => {
    await fetchHistory();
    setShowHistoryModal(true);
  };

  // ─── Export / Import de datos (E5) ──────────────────────────────

  const handleExportData = useCallback(async () => {
    try {
      const res = await fetch('/api/export');
      if (!res.ok) throw new Error('Server error');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const today = new Date().toISOString().split('T')[0];

      const link = document.createElement('a');
      link.href = url;
      link.download = `amor-compartido-backup-${today}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Backup descargado 💾');
    } catch (error) {
      console.error('Error exporting:', error);
      showToast('Error al exportar datos', 'error');
    }
  }, [showToast]);

  const handleImportData = useCallback((file) => {
    if (!file) return;
    // Confirmación antes de importar (no reemplaza pero igual añade datos)
    setConfirmDialog({
      message: `¿Importar "${file.name}"? Los datos se agregarán a los existentes, no los reemplazan.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const text = await file.text();
          const payload = JSON.parse(text);

          const res = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Server error');
          }

          const { imported } = await res.json();
          showToast(
            `Importado: ${imported.tasks} tareas, ${imported.projects} proyectos, ${imported.subtasks} subtareas 💕`,
            'success',
            { duration: 6000 }
          );

          // Refrescar todas las listas para ver los datos nuevos
          fetchTasks(false);
          fetchAssignedByOther();
          fetchProjects();
          fetchArchivedProjects();
        } catch (error) {
          console.error('Error importing:', error);
          showToast(`Error al importar: ${error.message || 'archivo inválido'}`, 'error');
        }
      },
      onCancel: () => setConfirmDialog(null),
    });
  }, [showToast, fetchTasks, fetchAssignedByOther]);

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

  // ─── Handlers de proyectos ──────────────────────────────────────
  // Estos handlers vivían inline en page.js antes de la refactorización
  // del commit 3ade9dd (extract useTasks); fueron eliminados sin querer
  // y la sección de proyectos quedó rota (ReferenceError al hacer click
  // en cualquier acción). Acá los restauramos preservando el comportamiento
  // original + 409 conflict handling con el endpoint de optimistic locking.

  const openNewProject = useCallback(() => {
    setEditingProject(null);
    setProjectFormData({ name: '', description: '', emoji: '📁', color: '#6366f1', due_date: '' });
    setShowProjectModal(true);
  }, []);

  const openEditProject = useCallback((project) => {
    setEditingProject(project);
    setProjectFormData({
      name: project.name,
      description: project.description || '',
      emoji: project.emoji || '📁',
      color: project.color || '#6366f1',
      due_date: project.due_date ? String(project.due_date).split('T')[0] : '',
    });
    setShowProjectModal(true);
  }, []);

  const handleProjectSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsSavingProject(true);
    const isEditing = !!editingProject;
    const url = isEditing ? `/api/projects/${editingProject.id}` : '/api/projects';
    const method = isEditing ? 'PUT' : 'POST';
    try {
      const payload = { ...projectFormData, due_date: projectFormData.due_date || null };
      // Optimistic locking: si estamos editando, mandamos updated_at para
      // que el server detecte conflictos (otra pestaña que guardó primero).
      if (isEditing && editingProject?.updated_at) {
        payload.expected_updated_at = editingProject.updated_at;
      }
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.status === 409) {
        showToast('Tu pareja editó este proyecto, refrescamos los cambios', 'info', { duration: 5000 });
        fetchProjects();
        setShowProjectModal(false);
        setEditingProject(null);
        return;
      }
      if (!response.ok) throw new Error('Server error');
      setShowProjectModal(false);
      setEditingProject(null);
      setProjectFormData({ name: '', description: '', emoji: '📁', color: '#6366f1', due_date: '' });
      fetchProjects();
      fetchArchivedProjects();
      showToast(isEditing ? 'Proyecto actualizado' : 'Proyecto creado 📁');
    } catch (error) {
      console.error('Error saving project:', error);
      showToast('Error al guardar el proyecto', 'error');
    } finally {
      setIsSavingProject(false);
    }
  }, [editingProject, projectFormData, showToast]);

  const handleProjectDelete = useCallback((projectId) => {
    setConfirmDialog({
      message: '¿Archivar este proyecto? Las tareas se conservan.',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          // PUT con is_archived: true en lugar de DELETE para que sea
          // explícito (el DELETE sin ?permanent=true también archiva,
          // pero esta forma es más legible).
          const response = await fetch(`/api/projects/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_archived: true }),
          });
          if (!response.ok) throw new Error('Server error');
          if (selectedProject === projectId) setSelectedProject(null);
          fetchProjects();
          fetchArchivedProjects();
          showToast('Proyecto archivado');
        } catch (error) {
          console.error('Error archiving project:', error);
          showToast('Error al archivar el proyecto', 'error');
        }
      },
      onCancel: () => setConfirmDialog(null),
    });
  }, [selectedProject, showToast]);

  const handleRestoreProject = useCallback(async (projectId) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: false }),
      });
      if (!response.ok) throw new Error('Server error');
      fetchProjects();
      fetchArchivedProjects();
      showToast('Proyecto restaurado 💕');
    } catch (error) {
      console.error('Error restoring project:', error);
      showToast('Error al restaurar el proyecto', 'error');
    }
  }, [showToast]);

  const handleDeleteProjectPermanently = useCallback((projectId, projectName) => {
    setConfirmDialog({
      message: `¿Eliminar "${projectName}" permanentemente? Esto borra el proyecto y todas sus tareas.`,
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
      onCancel: () => setConfirmDialog(null),
    });
  }, [showToast]);

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
            <Image
              src="/icon-192.png"
              alt="Logo"
              className="logo"
              width={36}
              height={36}
              priority
            />
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
              onClick={() => switchUser(user)}
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
                      reactionEmojis={REACTION_EMOJIS} onSubtaskAdd={handleSubtaskAdd} onSubtaskToggle={handleSubtaskToggle} onSubtaskDelete={handleSubtaskDelete} onSubtaskReorder={handleSubtaskReorder}
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
              <button
                type="button"
                className={`filter-toggle ${(dateFilter || assigneeFilter !== null) ? 'has-active' : ''}`}
                onClick={() => setShowAdvancedFilters((s) => !s)}
                aria-expanded={showAdvancedFilters}
                aria-label="Filtros avanzados"
                title="Filtros avanzados"
              >
                ⚙
              </button>
            </div>

            {showAdvancedFilters && (
              <div className="advanced-filters">
                <div className="advanced-filter-row">
                  <span className="advanced-filter-label">Fecha:</span>
                  {[
                    { v: null, l: 'Todas' },
                    { v: 'today', l: 'Hoy' },
                    { v: 'overdue', l: 'Vencidas' },
                    { v: 'week', l: 'Esta semana' },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.v || 'all'}
                      className={`filter-chip ${dateFilter === opt.v ? 'active' : ''}`}
                      onClick={() => setDateFilter(opt.v)}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
                <div className="advanced-filter-row">
                  <span className="advanced-filter-label">Asignada a:</span>
                  <button
                    type="button"
                    className={`filter-chip ${assigneeFilter === null ? 'active' : ''}`}
                    onClick={() => setAssigneeFilter(null)}
                  >
                    Cualquiera
                  </button>
                  {users.map((u) => (
                    <button
                      type="button"
                      key={u.id}
                      className={`filter-chip ${assigneeFilter === u.id ? 'active' : ''}`}
                      onClick={() => setAssigneeFilter(u.id)}
                    >
                      {u.avatar_emoji} {u.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`filter-chip ${assigneeFilter === 'shared' ? 'active' : ''}`}
                    onClick={() => setAssigneeFilter('shared')}
                  >
                    💑 Compartidas
                  </button>
                </div>
              </div>
            )}

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
                            reactionEmojis={REACTION_EMOJIS} onSubtaskAdd={handleSubtaskAdd} onSubtaskToggle={handleSubtaskToggle} onSubtaskDelete={handleSubtaskDelete} onSubtaskReorder={handleSubtaskReorder}
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
                <button
                  className="templates-trigger-btn"
                  onClick={() => setShowTemplatesModal(true)}
                >
                  📦 Usar plantilla
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
                          reactionEmojis={REACTION_EMOJIS} onSubtaskAdd={handleSubtaskAdd} onSubtaskToggle={handleSubtaskToggle} onSubtaskDelete={handleSubtaskDelete} onSubtaskReorder={handleSubtaskReorder}
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
                    reactionEmojis={REACTION_EMOJIS} onSubtaskAdd={handleSubtaskAdd} onSubtaskToggle={handleSubtaskToggle} onSubtaskDelete={handleSubtaskDelete} onSubtaskReorder={handleSubtaskReorder}
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
          onClose={() => {
            // Reset al cerrar sin guardar para que la próxima apertura
            // arranque limpia (antes los campos persistían entre abrir/cerrar).
            setShowModal(false);
            setEditingTask(null);
            setFormData({
              title: '', description: '', assigned_to: null, due_date: '',
              priority: 'medium', category_id: null, project_id: null,
              recurrence: null, is_shared: false,
            });
          }}
        />
      )}

      {showTemplatesModal && (
        <ProjectTemplatePicker
          onCreate={handleCreateFromTemplate}
          onClose={() => setShowTemplatesModal(false)}
          busyTemplateId={busyTemplateId}
        />
      )}

      {showProjectModal && (
        <ProjectFormModal
          editingProject={editingProject}
          formData={projectFormData}
          setFormData={setProjectFormData}
          isSaving={isSavingProject}
          onSubmit={handleProjectSubmit}
          onClose={() => {
            setShowProjectModal(false);
            setEditingProject(null);
            setProjectFormData({ name: '', description: '', emoji: '📁', color: '#6366f1', due_date: '' });
          }}
        />
      )}

      <OfflineBadge />

      <InstallPromptBanner
        isInstallable={isInstallable}
        onInstall={promptInstall}
        onDismiss={dismissInstall}
      />

      <Toast
        toast={toast}
        onDismiss={dismissToast}
        onPause={pauseTimer}
        onResume={resumeTimer}
      />

      {confirmDialog && <ConfirmDialog dialog={confirmDialog} />}

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
          onExportData={handleExportData}
          onImportData={handleImportData}
          theme={theme}
          onSetTheme={setTheme}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
}
