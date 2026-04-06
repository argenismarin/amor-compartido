import DateInputWithShortcuts from '@/components/DateInputWithShortcuts';
import useFocusTrap from '@/hooks/useFocusTrap';

const PROJECT_EMOJIS = ['📁', '🚀', '💼', '🏠', '🎯', '💡', '🎨', '📱', '💻', '🛒', '✈️', '🎁', '📚', '🏋️', '🎵'];
const PROJECT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'];

// Modal de crear / editar proyecto.
//
// Props:
// - editingProject: proyecto siendo editado o null si es nuevo
// - formData: { name, description, emoji, color, due_date }
// - setFormData: setter del estado
// - isSaving: bool para deshabilitar el submit
// - onSubmit: handler del form
// - onClose: cerrar el modal
export default function ProjectFormModal({
  editingProject,
  formData,
  setFormData,
  isSaving,
  onSubmit,
  onClose,
}) {
  const containerRef = useFocusTrap(onClose);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        ref={containerRef}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h2 className="modal-title">
            {editingProject ? '✏️ Editar proyecto' : '📁 Nuevo proyecto'}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label">Nombre del proyecto</label>
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="Ej: App Minera, Vacaciones, etc."
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Descripción (opcional)</label>
            <textarea
              className="form-textarea"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Describe el proyecto..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Emoji</label>
            <div className="emoji-selector">
              {PROJECT_EMOJIS.map(emoji => (
                <button
                  type="button"
                  key={emoji}
                  className={`emoji-option ${formData.emoji === emoji ? 'selected' : ''}`}
                  onClick={() => setFormData({...formData, emoji})}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Color</label>
            <div className="color-selector">
              {PROJECT_COLORS.map(color => (
                <button
                  type="button"
                  key={color}
                  className={`color-option ${formData.color === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData({...formData, color})}
                  aria-label={`Color ${color}`}
                />
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Fecha límite (opcional)</label>
            <DateInputWithShortcuts
              value={formData.due_date}
              onChange={value => setFormData({...formData, due_date: value})}
            />
          </div>

          <button type="submit" className="submit-btn" disabled={isSaving}>
            {isSaving ? 'Guardando...' : (editingProject ? 'Guardar cambios' : 'Crear proyecto')} {!isSaving && '📁'}
          </button>
        </form>
      </div>
    </div>
  );
}
