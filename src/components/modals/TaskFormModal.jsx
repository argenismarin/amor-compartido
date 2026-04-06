import DateInputWithShortcuts from '@/components/DateInputWithShortcuts';

// Modal de crear / editar tarea con todos los selectores (asignar, prioridad,
// proyecto, categoría, recurrencia, fecha límite).
//
// Props:
// - editingTask: tarea siendo editada o null si es nueva
// - formData: estado del formulario controlado desde el padre
// - setFormData: setter del estado
// - users: lista de usuarios para asignar
// - currentUser: usuario actual (para "Ambos")
// - projects: lista de proyectos disponibles
// - categories: lista de categorías
// - isSaving: bool para deshabilitar el submit
// - onSubmit: handler del form (e) => Promise
// - onClose: cierra el modal
export default function TaskFormModal({
  editingTask,
  formData,
  setFormData,
  users,
  currentUser,
  projects,
  categories,
  isSaving,
  onSubmit,
  onClose,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {editingTask ? '✏️ Editar tarea' : '✨ Nueva tarea'}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={onSubmit}>
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
                  className={`assign-option ${formData.assigned_to === user.id && !formData.is_shared ? 'selected' : ''}`}
                  onClick={() => setFormData({...formData, assigned_to: user.id, is_shared: false})}
                  role="radio"
                  aria-checked={formData.assigned_to === user.id && !formData.is_shared}
                  aria-label={`Asignar a ${user.name}`}
                >
                  <span className="assign-emoji">{user.avatar_emoji}</span>
                  <span className="assign-name">{user.name}</span>
                </button>
              ))}
              <button
                type="button"
                className={`assign-option assign-both ${formData.is_shared ? 'selected' : ''}`}
                onClick={() => setFormData({...formData, assigned_to: currentUser?.id, is_shared: true})}
                role="radio"
                aria-checked={formData.is_shared}
                aria-label="Asignar a ambos"
              >
                <span className="assign-emoji">💑</span>
                <span className="assign-name">Ambos</span>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Fecha límite (opcional)</label>
            <DateInputWithShortcuts
              value={formData.due_date}
              onChange={value => setFormData({...formData, due_date: value})}
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

          {/* Project selector - only show if there are projects */}
          {projects.length > 0 && (
            <div className="form-group">
              <label className="form-label">Proyecto (opcional)</label>
              <div className="project-selector">
                <button
                  type="button"
                  className={`project-option ${formData.project_id === null ? 'selected' : ''}`}
                  onClick={() => setFormData({...formData, project_id: null})}
                >
                  Sin proyecto
                </button>
                {projects.map(proj => (
                  <button
                    type="button"
                    key={proj.id}
                    className={`project-option ${formData.project_id === proj.id ? 'selected' : ''}`}
                    onClick={() => setFormData({...formData, project_id: proj.id})}
                    style={{ '--project-color': proj.color }}
                  >
                    {proj.emoji} {proj.name}
                  </button>
                ))}
              </div>
            </div>
          )}

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
  );
}
