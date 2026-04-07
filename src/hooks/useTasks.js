'use client';

import { useState, useEffect, useCallback } from 'react';

// useTasks — el hook más grande de la app. Centraliza TODO el state y la
// lógica de tareas: listas (myTasks, assignedByOther, projectTasks,
// looseTasks), modal de crear/editar, quick add, optimistic updates con
// rollback, soft delete + undo, optimistic locking, y subtareas.
//
// Recibe via props todo lo que necesita del entorno externo (currentUser,
// listas auxiliares, callbacks de gamificación, etc.).
//
// La razón por la que es un solo hook gigante en lugar de varios pequeños
// es que casi todas las funciones tocan el mismo state (las 4 listas) y
// necesitan rollback compartido. Partirlo causaría más complejidad
// (context, refs cruzadas) que beneficio.
export default function useTasks({
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
  refreshProjects,
}) {
  // ─── State ──────────────────────────────────────────────────────
  const [tasks, setTasks] = useState([]);
  const [assignedByOther, setAssignedByOther] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [looseTasks, setLooseTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [togglingTaskId, setTogglingTaskId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: null,
    due_date: '',
    priority: 'medium',
    category_id: null,
    project_id: null,
    recurrence: null,
    is_shared: false,
  });

  // Quick add input
  const [quickAddText, setQuickAddText] = useState('');

  // ─── Fetchers ───────────────────────────────────────────────────
  const fetchTasks = useCallback(async (showSkeleton = false) => {
    if (!currentUser) return;
    if (showSkeleton) setTasksLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === 'myTasks') {
        params.set('userId', currentUser.id);
        params.set('filter', 'myTasks');
        params.set('excludeProjectTasks', 'true');
      } else if (activeTab === 'assignedToOther') {
        params.set('userId', currentUser.id);
        params.set('filter', 'assignedToOther');
        params.set('excludeProjectTasks', 'true');
      }
      if (selectedCategory) params.set('categoryId', selectedCategory);

      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      showToast?.('Error al cargar tareas', 'error');
    } finally {
      setTasksLoading(false);
    }
  }, [currentUser, activeTab, selectedCategory, showToast]);

  const fetchAssignedByOther = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `/api/tasks?userId=${currentUser.id}&filter=assignedByOther&excludeProjectTasks=true`
      );
      const data = await res.json();
      setAssignedByOther(data);
    } catch (error) {
      console.error('Error fetching assigned by other:', error);
      showToast?.('Error al cargar tareas asignadas', 'error');
    }
  }, [currentUser, showToast]);

  const fetchProjectTasks = useCallback(async (projectId) => {
    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      const data = await res.json();
      setProjectTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching project tasks:', error);
      setProjectTasks([]);
    }
  }, []);

  const fetchLooseTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks?projectId=null');
      const data = await res.json();
      setLooseTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching loose tasks:', error);
      setLooseTasks([]);
    }
  }, []);

  // ─── Effects ────────────────────────────────────────────────────

  // Cargar tareas cuando cambia user / tab / categoría
  useEffect(() => {
    if (currentUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchTasks(true);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAssignedByOther();
    }
  }, [currentUser, activeTab, selectedCategory, fetchTasks, fetchAssignedByOther]);

  // Cargar tareas del proyecto seleccionado o sueltas cuando estamos en tab projects
  useEffect(() => {
    if (activeTab === 'projects') {
      if (selectedProject) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchProjectTasks(selectedProject);
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchLooseTasks();
      }
    }
  }, [activeTab, selectedProject, fetchProjectTasks, fetchLooseTasks]);

  // ─── Helpers ────────────────────────────────────────────────────

  // Aplica un cambio a una tarea dentro de cualquier lista que la contenga
  const updateTaskInAllLists = useCallback((taskId, updaterFn) => {
    const apply = (list) => list.map((t) => (t.id === taskId ? updaterFn(t) : t));
    setTasks(apply);
    setAssignedByOther(apply);
    setProjectTasks(apply);
    setLooseTasks(apply);
  }, []);

  // Elimina una tarea de todas las listas
  const removeTaskFromAllLists = useCallback((taskId) => {
    const filterOut = (list) => list.filter((t) => t.id !== taskId);
    setTasks(filterOut);
    setAssignedByOther(filterOut);
    setProjectTasks(filterOut);
    setLooseTasks(filterOut);
  }, []);

  // Snapshot del estado actual para rollback
  const snapshotLists = useCallback(
    () => ({ tasks, assignedByOther, projectTasks, looseTasks }),
    [tasks, assignedByOther, projectTasks, looseTasks]
  );

  const restoreLists = useCallback((snapshot) => {
    setTasks(snapshot.tasks);
    setAssignedByOther(snapshot.assignedByOther);
    setProjectTasks(snapshot.projectTasks);
    setLooseTasks(snapshot.looseTasks);
  }, []);

  // ─── Handlers de tarea ──────────────────────────────────────────

  const handleTaskToggle = useCallback(async (task) => {
    setTogglingTaskId(task.id);
    const newCompletedStatus = !task.is_completed;
    const snapshot = snapshotLists();

    updateTaskInAllLists(task.id, (t) => ({
      ...t,
      is_completed: newCompletedStatus,
      completed_at: newCompletedStatus ? new Date().toISOString() : null,
    }));

    if (newCompletedStatus) {
      triggerFloatingHearts?.();
      showToast?.(getRandomMessage?.() || '¡Tarea completada!');
    } else {
      showToast?.('Tarea marcada como pendiente');
    }

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toggle_complete: true }),
      });

      if (!response.ok) throw new Error('Server error');

      if (newCompletedStatus) {
        setTimeout(() => checkNewAchievements?.(), 500);
        fetchStreak?.();
      }

      if (activeTab === 'projects') refreshProjects?.();
    } catch (error) {
      console.error('Error toggling task:', error);
      restoreLists(snapshot);
      showToast?.('Error al actualizar la tarea', 'error');
    } finally {
      setTogglingTaskId(null);
    }
  }, [
    snapshotLists, updateTaskInAllLists, restoreLists,
    triggerFloatingHearts, showToast, getRandomMessage,
    checkNewAchievements, fetchStreak, refreshProjects, activeTab,
  ]);

  const handleReaction = useCallback(async (taskId, emoji) => {
    const snapshot = snapshotLists();
    updateTaskInAllLists(taskId, (t) => ({ ...t, reaction: emoji }));
    showToast?.('Reaccion enviada 💕');

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: emoji }),
      });
      if (!response.ok) throw new Error('Server error');
    } catch (error) {
      console.error('Error adding reaction:', error);
      restoreLists(snapshot);
      showToast?.('Error al enviar reaccion', 'error');
    }
  }, [snapshotLists, updateTaskInAllLists, restoreLists, showToast]);

  const handleUndoDelete = useCallback(async (taskId) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/restore`, { method: 'POST' });
      if (!response.ok) throw new Error('Server error');

      if (currentUser) {
        fetchTasks(false);
        fetchAssignedByOther();
      }
      if (activeTab === 'projects') {
        refreshProjects?.();
        if (selectedProject) {
          fetchProjectTasks(selectedProject);
        } else {
          fetchLooseTasks();
        }
      }
      showToast?.('Tarea restaurada 💕');
    } catch (error) {
      console.error('Error restoring task:', error);
      showToast?.('Error al deshacer', 'error');
    }
  }, [
    currentUser, activeTab, selectedProject,
    fetchTasks, fetchAssignedByOther, fetchProjectTasks, fetchLooseTasks,
    refreshProjects, showToast,
  ]);

  const handleTaskDelete = useCallback(async (taskId) => {
    const snapshot = snapshotLists();
    removeTaskFromAllLists(taskId);

    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Server error');

      showToast?.('Tarea eliminada', 'success', {
        duration: 7000,
        action: { label: 'Deshacer', onClick: () => handleUndoDelete(taskId) },
      });

      if (activeTab === 'projects') refreshProjects?.();
    } catch (error) {
      console.error('Error deleting task:', error);
      restoreLists(snapshot);
      showToast?.('Error al eliminar la tarea', 'error');
    }
  }, [
    snapshotLists, removeTaskFromAllLists, restoreLists,
    showToast, handleUndoDelete, activeTab, refreshProjects,
  ]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const isEditing = !!editingTask;
    const url = isEditing ? `/api/tasks/${editingTask.id}` : '/api/tasks';
    const method = isEditing ? 'PUT' : 'POST';

    // Optimistic enriched task
    const categoryInfo = categories.find((c) => c.id === formData.category_id);
    const assignedToUser = users.find((u) => u.id === formData.assigned_to);
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
      assigned_by_name: currentUser.name,
      assigned_by_avatar: currentUser.avatar_emoji,
      category_name: categoryInfo?.name,
      category_emoji: categoryInfo?.emoji,
      category_color: categoryInfo?.color,
    };

    const previousTasks = tasks;
    const previousAssignedByOther = assignedByOther;

    if (isEditing) {
      setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? optimisticTask : t)));
      setAssignedByOther((prev) =>
        prev.map((t) => (t.id === editingTask.id ? optimisticTask : t))
      );
    } else if (formData.assigned_to === currentUser.id) {
      setTasks((prev) => [optimisticTask, ...prev]);
    } else if (activeTab === 'assignedToOther') {
      setTasks((prev) => [optimisticTask, ...prev]);
    }

    setShowModal(false);
    setEditingTask(null);
    setFormData({
      title: '', description: '', assigned_to: null, due_date: '',
      priority: 'medium', category_id: null, project_id: null,
      recurrence: null, is_shared: false,
    });
    showToast?.(isEditing ? 'Tarea actualizada' : 'Tarea creada 💕');

    if (activeTab === 'projects') {
      refreshProjects?.();
      if (selectedProject) {
        fetchProjectTasks(selectedProject);
      } else {
        fetchLooseTasks();
      }
    }

    try {
      const payload = { ...formData, assigned_by: currentUser.id };
      if (isEditing && editingTask?.updated_at) {
        payload.expected_updated_at = editingTask.updated_at;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.status === 409) {
        setTasks(previousTasks);
        setAssignedByOther(previousAssignedByOther);
        fetchTasks(false);
        fetchAssignedByOther();
        showToast?.(
          'Tu pareja editó esta tarea, refrescamos los cambios',
          'info',
          { duration: 5000 }
        );
        return;
      }

      if (!response.ok) throw new Error('Server error');

      const result = await response.json();
      if (!isEditing && result.id) {
        setTasks((prev) =>
          prev.map((t) => (t.id === optimisticTask.id ? { ...t, id: result.id } : t))
        );
      }
    } catch (error) {
      console.error('Error saving task:', error);
      setTasks(previousTasks);
      setAssignedByOther(previousAssignedByOther);
      showToast?.('Error al guardar la tarea', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [
    editingTask, formData, categories, users, currentUser, activeTab,
    selectedProject, tasks, assignedByOther, showToast, refreshProjects,
    fetchProjectTasks, fetchLooseTasks, fetchTasks, fetchAssignedByOther,
  ]);

  const handleQuickAdd = useCallback(async (e) => {
    e.preventDefault();
    const title = quickAddText.trim();
    if (!title || !currentUser) return;

    const otherUser = users.find((u) => u.id !== currentUser.id);
    let assignedTo = currentUser.id;
    let projectId = null;

    if (activeTab === 'assignedToOther') {
      assignedTo = otherUser?.id || currentUser.id;
    } else if (activeTab === 'projects' && selectedProject) {
      projectId = selectedProject;
    }

    const payload = {
      title, description: null, assigned_to: assignedTo,
      assigned_by: currentUser.id, due_date: null, priority: 'medium',
      category_id: null, project_id: projectId, recurrence: null,
      is_shared: false,
    };

    const assignedToUser = users.find((u) => u.id === assignedTo);
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

    if (projectId) {
      setProjectTasks((prev) => [optimisticTask, ...prev]);
    } else {
      setTasks((prev) => [optimisticTask, ...prev]);
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

      if (result.id) {
        const replaceId = (list) =>
          list.map((t) => (t.id === optimisticTask.id ? { ...t, id: result.id } : t));
        setTasks(replaceId);
        setProjectTasks(replaceId);
      }

      if (activeTab === 'projects') refreshProjects?.();
    } catch (error) {
      console.error('Error en quick add:', error);
      const removeOpt = (list) => list.filter((t) => t.id !== optimisticTask.id);
      setTasks(removeOpt);
      setProjectTasks(removeOpt);
      showToast?.('Error al agregar tarea', 'error');
    }
  }, [
    quickAddText, currentUser, users, activeTab, selectedProject,
    showToast, refreshProjects,
  ]);

  // ─── Modal helpers ──────────────────────────────────────────────

  const openNewTask = useCallback((projectId = null) => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      assigned_to: currentUser?.id,
      due_date: '',
      priority: 'medium',
      category_id: null,
      project_id:
        projectId || (activeTab === 'projects' && selectedProject ? selectedProject : null),
      recurrence: null,
      is_shared: false,
    });
    setShowModal(true);
  }, [currentUser, activeTab, selectedProject]);

  const openEditTask = useCallback((task) => {
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
      is_shared: task.is_shared || false,
    });
    setShowModal(true);
  }, []);

  // ─── Subtareas ──────────────────────────────────────────────────

  const updateTaskSubtasks = useCallback((taskId, subtasksUpdater) => {
    const apply = (list) =>
      list.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: subtasksUpdater(Array.isArray(t.subtasks) ? t.subtasks : []) }
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
    const tempId = `temp-sub-${Date.now()}`;

    updateTaskSubtasks(taskId, (prev) => [
      ...prev,
      { id: tempId, title: trimmed, is_completed: false, sort_order: prev.length + 1 },
    ]);

    try {
      const res = await fetch('/api/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, title: trimmed }),
      });
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      updateTaskSubtasks(taskId, (prev) =>
        prev.map((s) => (s.id === tempId ? { ...s, id: data.subtask.id } : s))
      );
    } catch (error) {
      console.error('Error adding subtask:', error);
      updateTaskSubtasks(taskId, (prev) => prev.filter((s) => s.id !== tempId));
      showToast?.('Error al agregar subtarea', 'error');
    }
  }, [updateTaskSubtasks, showToast]);

  const handleSubtaskToggle = useCallback(async (taskId, subtaskId) => {
    updateTaskSubtasks(taskId, (prev) =>
      prev.map((s) => (s.id === subtaskId ? { ...s, is_completed: !s.is_completed } : s))
    );

    try {
      const res = await fetch(`/api/subtasks/${subtaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toggle_complete: true }),
      });
      if (!res.ok) throw new Error('Server error');
    } catch (error) {
      console.error('Error toggling subtask:', error);
      updateTaskSubtasks(taskId, (prev) =>
        prev.map((s) => (s.id === subtaskId ? { ...s, is_completed: !s.is_completed } : s))
      );
      showToast?.('Error al actualizar subtarea', 'error');
    }
  }, [updateTaskSubtasks, showToast]);

  const handleSubtaskDelete = useCallback(async (taskId, subtaskId) => {
    let removedSubtask = null;
    updateTaskSubtasks(taskId, (prev) => {
      removedSubtask = prev.find((s) => s.id === subtaskId);
      return prev.filter((s) => s.id !== subtaskId);
    });

    try {
      const res = await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Server error');
    } catch (error) {
      console.error('Error deleting subtask:', error);
      if (removedSubtask) {
        updateTaskSubtasks(taskId, (prev) =>
          [...prev, removedSubtask].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        );
      }
      showToast?.('Error al eliminar subtarea', 'error');
    }
  }, [updateTaskSubtasks, showToast]);

  return {
    // Listas
    tasks, setTasks,
    assignedByOther, setAssignedByOther,
    projectTasks,
    looseTasks,
    tasksLoading,
    togglingTaskId,

    // Modal
    showModal, setShowModal,
    editingTask, setEditingTask,
    formData, setFormData,
    isSaving,

    // Quick add
    quickAddText, setQuickAddText,

    // Fetchers
    fetchTasks,
    fetchAssignedByOther,
    fetchProjectTasks,
    fetchLooseTasks,

    // Handlers principales
    handleTaskToggle,
    handleReaction,
    handleTaskDelete,
    handleUndoDelete,
    handleSubmit,
    handleQuickAdd,

    // Modal helpers
    openNewTask,
    openEditTask,

    // Subtareas
    handleSubtaskAdd,
    handleSubtaskToggle,
    handleSubtaskDelete,
  };
}
