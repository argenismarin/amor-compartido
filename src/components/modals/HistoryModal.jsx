import { formatDateTimeDisplay } from '@/lib/dates';

// Modal con el historial de tareas completadas y stats semanales.
//
// Props:
// - history: { tasks: [], stats: { thisWeek, total } }
// - onClose: cerrar el modal
export default function HistoryModal({ history, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal history-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">📜 Historial</h2>
          <button className="modal-close" onClick={onClose}>×</button>
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
                  <span>✅ {formatDateTimeDisplay(task.completed_at)}</span>
                  {task.reaction && <span className="history-item-reaction">{task.reaction}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
