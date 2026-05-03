import DateInputWithShortcuts from '@/components/DateInputWithShortcuts';
import useFocusTrap from '@/hooks/useFocusTrap';

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
              {['low', 'medium', 'high'].map(p => {
                const symbol = p === 'low' ? '▼' : p === 'medium' ? '─' : '▲';
                const label = p === 'low' ? 'Baja' : p === 'medium' ? 'Media' : 'Alta';
                return (
                  <button
                    type="button"
                    key={p}
                    className={`priority-option ${p} ${formData.priority === p ? 'selected' : ''}`}
                    onClick={() => setFormData({...formData, priority: p})}
                    role="radio"
                    aria-checked={formData.priority === p}
                    aria-label={`Prioridad ${label.toLowerCase()}`}
                  >
                    <span aria-hidden="true">{symbol}</span> {label}
                  </button>
                );
              })}
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
                { value: 'monthly', label: '🗓️ Mensual' },
                { value: 'custom', label: '⚙️ Personalizada' },
              ].map(opt => (
                <button
                  type="button"
                  key={opt.value || 'none'}
                  className={`recurrence-option ${formData.recurrence === opt.value ? 'selected' : ''}`}
                  onClick={() => setFormData({
                    ...formData,
                    recurrence: opt.value,
                    // Limpiar recurrence_days si se cambia a algo que no es custom
                    recurrence_days: opt.value === 'custom' ? formData.recurrence_days : null,
                  })}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Selector de dias de la semana, solo cuando recurrence === 'custom'.
                recurrence_days se almacena como JSON array de ints 0-6 (0=domingo). */}
            {formData.recurrence === 'custom' && (
              <div className="weekdays-selector" role="group" aria-label="Días de la semana">
                {[
                  { idx: 1, label: 'L' },
                  { idx: 2, label: 'M' },
                  { idx: 3, label: 'X' },
                  { idx: 4, label: 'J' },
                  { idx: 5, label: 'V' },
                  { idx: 6, label: 'S' },
                  { idx: 0, label: 'D' },
                ].map((day) => {
                  let selected = [];
                  try {
                    selected = formData.recurrence_days
                      ? JSON.parse(formData.recurrence_days)
                      : [];
                  } catch {
                    selected = [];
                  }
                  const isSelected = selected.includes(day.idx);
                  return (
                    <button
                      type="button"
                      key={day.idx}
                      className={`weekday-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        const next = isSelected
                          ? selected.filter((d) => d !== day.idx)
                          : [...selected, day.idx].sort((a, b) => a - b);
                        setFormData({
                          ...formData,
                          recurrence_days: next.length > 0 ? JSON.stringify(next) : null,
                        });
                      }}
                      aria-pressed={isSelected}
                      aria-label={`Repetir los ${day.label === 'L' ? 'lunes' : day.label === 'M' ? 'martes' : day.label === 'X' ? 'miércoles' : day.label === 'J' ? 'jueves' : day.label === 'V' ? 'viernes' : day.label === 'S' ? 'sábados' : 'domingos'}`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button type="submit" className="submit-btn" disabled={isSaving}>
            {isSaving ? 'Guardando...' : (editingTask ? 'Guardar cambios' : 'Crear tarea')} {!isSaving && '💕'}
          </button>
        </form>
      </div>
    </div>
  );
}
