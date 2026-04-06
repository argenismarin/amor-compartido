import { formatDateDisplay } from '@/lib/dates';

// Tarjeta visual de un proyecto con progreso, emoji y acciones
export default function ProjectCard({ project, onSelect, onEdit, onDelete }) {
  const progressPercentage = project.total_tasks > 0
    ? Math.round((project.completed_tasks / project.total_tasks) * 100)
    : 0;

  return (
    <div
      className="project-card"
      onClick={onSelect}
      style={{ '--project-color': project.color }}
    >
      <div className="project-card-header">
        <span className="project-card-emoji">{project.emoji}</span>
        <div className="project-card-actions" onClick={e => e.stopPropagation()}>
          <button
            className="project-action-btn"
            onClick={onEdit}
            aria-label="Editar proyecto"
          >
            ✏️
          </button>
          <button
            className="project-action-btn delete"
            onClick={onDelete}
            aria-label="Archivar proyecto"
          >
            🗑️
          </button>
        </div>
      </div>
      <h3 className="project-card-name">{project.name}</h3>
      {project.description && (
        <p className="project-card-description">{project.description}</p>
      )}
      <div className="project-card-progress">
        <div className="project-card-progress-bar">
          <div
            className="project-card-progress-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <span className="project-card-progress-text">
          {project.completed_tasks}/{project.total_tasks}
        </span>
      </div>
      <div className="project-card-footer">
        {project.due_date && (
          <span className="project-card-date">📅 {formatDateDisplay(project.due_date)}</span>
        )}
        <span className="project-card-percentage">{progressPercentage}%</span>
      </div>
    </div>
  );
}
