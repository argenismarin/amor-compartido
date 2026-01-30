'use client';

import { useState, useEffect, useCallback } from 'react';

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

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: null,
    due_date: '',
    priority: 'medium'
  });

  // Toast helper function
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch tasks when user changes
  useEffect(() => {
    if (currentUser) {
      fetchTasks();
      fetchAssignedByOther();
    }
  }, [currentUser, activeTab]);

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

  const fetchTasks = async () => {
    try {
      let url = '/api/tasks';
      if (activeTab === 'myTasks') {
        url += `?userId=${currentUser.id}&filter=myTasks`;
      } else if (activeTab === 'assignedToOther') {
        url += `?userId=${currentUser.id}&filter=assignedToOther`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      showToast('Error al cargar tareas', 'error');
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
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toggle_complete: true })
      });
      fetchTasks();
      fetchAssignedByOther();
      showToast(task.is_completed ? 'Tarea marcada como pendiente' : '¡Tarea completada! 🎉');
    } catch (error) {
      console.error('Error toggling task:', error);
      showToast('Error al actualizar la tarea', 'error');
    } finally {
      setTogglingTaskId(null);
    }
  };

  const handleTaskDelete = async (taskId) => {
    setConfirmDialog({
      message: '¿Eliminar esta tarea?',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
          fetchTasks();
          fetchAssignedByOther();
          showToast('Tarea eliminada');
        } catch (error) {
          console.error('Error deleting task:', error);
          showToast('Error al eliminar la tarea', 'error');
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const method = editingTask ? 'PUT' : 'POST';
      const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          assigned_by: currentUser.id
        })
      });

      setShowModal(false);
      setEditingTask(null);
      setFormData({ title: '', description: '', assigned_to: null, due_date: '', priority: 'medium' });
      fetchTasks();
      fetchAssignedByOther();
      showToast(editingTask ? 'Tarea actualizada' : 'Tarea creada 💕');
    } catch (error) {
      console.error('Error saving task:', error);
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
      priority: 'medium'
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
      priority: task.priority
    });
    setShowModal(true);
  };

  // Calculate progress
  const completedTasks = tasks.filter(t => t.is_completed).length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

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
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo-container">
            <img src="/icon-192.png" alt="Logo" className="logo" />
            <span className="app-title">Amor Compartido</span>
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
                <span className="collapsible-badge">
                  {assignedByOther.filter(t => !t.is_completed).length}
                </span>
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
                      showAssignedBy={false}
                      assignedByName={task.assigned_by_name}
                      togglingTaskId={togglingTaskId}
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

        {/* Task List */}
        <div className="task-list">
          {tasks.length === 0 ? (
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
                showAssignedBy={activeTab === 'myTasks'}
                currentUserId={currentUser?.id}
                assignedByName={task.assigned_by_name}
                togglingTaskId={togglingTaskId}
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
    </div>
  );
}

// TaskCard Component
function TaskCard({ task, onToggle, onEdit, onDelete, showAssignedBy, currentUserId, assignedByName, togglingTaskId }) {
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
          <div className="task-title">{task.title}</div>
          {task.description && <div className="task-description">{task.description}</div>}
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
