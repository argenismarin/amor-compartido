import { useState, useEffect, useCallback } from 'react';
import { formatDateDisplay } from '@/lib/dates';
import { fetchJson } from '@/lib/api';

// Tarjeta de una tarea con checkbox, prioridad, subtareas, reacciones y acciones.
//
// Props:
// - task: objeto tarea con subtasks (array)
// - onToggle: cuando se completa/descompleta
// - onEdit, onDelete: acciones de tarea
// - onReaction: cuando se elige un emoji de reacción
// - showAssignedBy: si mostrar el nombre del que asignó (para tab "Mis tareas")
// - currentUserId: para decidir si puede reaccionar
// - assignedByName: nombre del usuario que asignó (para color del borde)
// - togglingTaskId: id de la tarea que está siendo togleada (para spinner)
// - reactionEmojis: lista de emojis disponibles
// - onSubtaskAdd, onSubtaskToggle, onSubtaskDelete: handlers de subtareas
export default function TaskCard({
  task,
  onToggle,
  onEdit,
  onDelete,
  onReaction,
  showAssignedBy,
  currentUserId,
  assignedByName,
  togglingTaskId,
  reactionEmojis,
  onSubtaskAdd,
  onSubtaskToggle,
  onSubtaskDelete,
}) {
  const [showReactions, setShowReactions] = useState(false);
  const [sendingReaction, setSendingReaction] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Comments: cargados lazy cuando el usuario expande el hilo
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const loadComments = useCallback(async () => {
    try {
      const data = await fetchJson(`/api/comments?taskId=${task.id}`);
      setComments(Array.isArray(data) ? data : []);
      setCommentsLoaded(true);
    } catch (err) {
      console.error('Error loading comments:', err);
      setCommentsLoaded(true);
    }
  }, [task.id]);

  useEffect(() => {
    if (showComments && !commentsLoaded) loadComments();
  }, [showComments, commentsLoaded, loadComments]);

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    const body = newComment.trim();
    if (!body || sendingComment) return;
    setSendingComment(true);
    // Optimistic
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      task_id: task.id,
      author_id: currentUserId,
      body,
      created_at: new Date().toISOString(),
      author_name: 'Tu',
    };
    setComments((prev) => [...prev, optimistic]);
    setNewComment('');
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: task.id, author_id: currentUserId, body }),
      });
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      setComments((prev) => prev.map((c) => (c.id === tempId ? { ...optimistic, ...data.comment } : c)));
    } catch (err) {
      console.error('Error posting comment:', err);
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setNewComment(body);
    } finally {
      setSendingComment(false);
    }
  };

  const handleCommentDelete = async (commentId) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    try {
      await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Error deleting comment:', err);
      // No hay rollback porque ya borramos optimisticamente — si falla
      // el usuario puede recargar.
    }
  };

  // Determine if assigned by Jenifer (pink) or Argenis (burgundy)
  const isFromJenifer = assignedByName?.toLowerCase().includes('jenifer');
  const isFromArgenis = assignedByName?.toLowerCase().includes('argenis');
  const fromClass = isFromJenifer ? 'from-jenifer' : isFromArgenis ? 'from-argenis' : '';

  const isToggling = togglingTaskId === task.id;

  // Solo se puede reaccionar a tareas completadas que tú asignaste a la pareja
  const canReact = !!task.is_completed && task.assigned_by === currentUserId && task.assigned_to !== currentUserId;

  // Subtareas
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const completedSubtasks = subtasks.filter(s => s.is_completed).length;
  const totalSubtasks = subtasks.length;
  const hasSubtasks = totalSubtasks > 0;

  const handleSubtaskFormSubmit = (e) => {
    e.preventDefault();
    const title = newSubtaskTitle.trim();
    if (!title) return;
    onSubtaskAdd?.(task.id, title);
    setNewSubtaskTitle('');
    setShowSubtasks(true);
  };

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
            {task.is_shared && (
              <span className="task-shared-badge" title="Tarea compartida">💑</span>
            )}
            {task.category_emoji && (
              <span className="task-category-badge" title={task.category_name}>
                {task.category_emoji}
              </span>
            )}
            {task.recurrence && (
              <span className="task-recurrence-badge" title={`Repetir: ${task.recurrence}`}>🔄</span>
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
              <span className="task-meta-item">💌 De {task.assigned_by_name}</span>
            )}
            {task.due_date && (
              <span className="task-meta-item">📅 {formatDateDisplay(task.due_date)}</span>
            )}
            <span
              className={`task-meta-item priority-meta priority-meta-${task.priority}`}
              aria-label={`Prioridad ${task.priority === 'high' ? 'alta' : task.priority === 'low' ? 'baja' : 'media'}`}
            >
              <span aria-hidden="true">
                {task.priority === 'high' ? '▲' : task.priority === 'low' ? '▼' : '─'}
              </span>
              {task.priority === 'high' ? 'Alta' : task.priority === 'low' ? 'Baja' : 'Media'}
            </span>
            {hasSubtasks && (
              <button
                type="button"
                className="task-meta-item subtasks-toggle"
                onClick={() => setShowSubtasks(s => !s)}
                aria-expanded={showSubtasks}
                aria-label={`${completedSubtasks} de ${totalSubtasks} subtareas completadas`}
              >
                ☑ {completedSubtasks}/{totalSubtasks}
                <span className="subtasks-arrow">{showSubtasks ? '▾' : '▸'}</span>
              </button>
            )}
            {!hasSubtasks && !showSubtasks && !task.is_completed && onSubtaskAdd && (
              <button
                type="button"
                className="task-meta-item subtasks-add-trigger"
                onClick={() => setShowSubtasks(true)}
                aria-label="Agregar pasos"
              >
                + Pasos
              </button>
            )}
            <button
              type="button"
              className="task-meta-item comments-toggle"
              onClick={() => setShowComments((s) => !s)}
              aria-expanded={showComments}
              aria-label={showComments ? 'Ocultar comentarios' : 'Ver comentarios'}
            >
              💬{comments.length > 0 ? ` ${comments.length}` : ''}
            </button>
          </div>

          {showComments && (
            <div className="comments-section">
              {!commentsLoaded ? (
                <p className="comments-loading">Cargando…</p>
              ) : comments.length === 0 ? (
                <p className="comments-empty">Aún no hay comentarios. Sé el primero 💕</p>
              ) : (
                <ul className="comments-list">
                  {comments.map((c) => (
                    <li key={c.id} className="comment-item">
                      <div className="comment-author">
                        <span className="comment-avatar">{c.author_avatar || '💬'}</span>
                        <strong>{c.author_name || 'Anon'}</strong>
                        <time className="comment-time">{formatDateDisplay(c.created_at)}</time>
                      </div>
                      <div className="comment-body-row">
                        <p className="comment-body">{c.body}</p>
                        {c.author_id === currentUserId && (
                          <button
                            type="button"
                            className="comment-delete"
                            onClick={() => handleCommentDelete(c.id)}
                            aria-label="Eliminar comentario"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <form className="comment-add-form" onSubmit={handleCommentSubmit}>
                <input
                  type="text"
                  className="comment-add-input"
                  placeholder="Escribe un comentario…"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  disabled={sendingComment}
                  aria-label="Nuevo comentario"
                  maxLength={2000}
                />
                <button
                  type="submit"
                  className="comment-add-btn"
                  disabled={sendingComment || !newComment.trim()}
                  aria-label="Enviar comentario"
                >
                  ↵
                </button>
              </form>
            </div>
          )}

          {/* Subtareas (lista + input) cuando expandidas */}
          {showSubtasks && onSubtaskAdd && (
            <div className="subtasks-section">
              {hasSubtasks && (
                <ul className="subtasks-list">
                  {subtasks.map(sub => (
                    <li key={sub.id} className={`subtask-item ${sub.is_completed ? 'completed' : ''}`}>
                      <button
                        type="button"
                        className={`subtask-checkbox ${sub.is_completed ? 'checked' : ''}`}
                        onClick={() => onSubtaskToggle?.(task.id, sub.id)}
                        role="checkbox"
                        aria-checked={sub.is_completed}
                        aria-label={`Marcar "${sub.title}" como ${sub.is_completed ? 'pendiente' : 'completada'}`}
                      />
                      <span className="subtask-title">{sub.title}</span>
                      <button
                        type="button"
                        className="subtask-delete"
                        onClick={() => onSubtaskDelete?.(task.id, sub.id)}
                        aria-label={`Eliminar subtarea "${sub.title}"`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!task.is_completed && (
                <form className="subtask-add-form" onSubmit={handleSubtaskFormSubmit}>
                  <input
                    type="text"
                    className="subtask-add-input"
                    placeholder="Agregar paso..."
                    value={newSubtaskTitle}
                    onChange={e => setNewSubtaskTitle(e.target.value)}
                    aria-label="Nueva subtarea"
                    autoFocus={!hasSubtasks}
                  />
                  <button
                    type="submit"
                    className="subtask-add-btn"
                    disabled={!newSubtaskTitle.trim()}
                    aria-label="Agregar subtarea"
                  >
                    +
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Reaction buttons for completed tasks assigned by current user */}
          {canReact && !task.reaction && (
            <div className="task-reaction-section">
              {showReactions ? (
                <div className="reaction-picker">
                  {reactionEmojis.map(emoji => (
                    <button
                      key={emoji}
                      className="reaction-btn"
                      disabled={sendingReaction}
                      onClick={async () => {
                        // Disable + await previene doble-tap rápido en dos
                        // emojis distintos: antes ambos se mandaban y el
                        // último ganaba arbitrariamente.
                        if (sendingReaction) return;
                        setSendingReaction(true);
                        try {
                          await onReaction(task.id, emoji);
                        } finally {
                          setSendingReaction(false);
                          setShowReactions(false);
                        }
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    className="reaction-btn reaction-close"
                    disabled={sendingReaction}
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
