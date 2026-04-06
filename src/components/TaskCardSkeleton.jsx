// Placeholder visual mientras se cargan las tareas
export default function TaskCardSkeleton() {
  return (
    <div className="task-card-skeleton">
      <div className="skeleton-header">
        <div className="skeleton skeleton-checkbox"></div>
        <div className="skeleton-content">
          <div className="skeleton skeleton-title"></div>
          <div className="skeleton skeleton-description"></div>
          <div className="skeleton-meta">
            <div className="skeleton skeleton-meta-item"></div>
            <div className="skeleton skeleton-meta-item"></div>
          </div>
        </div>
        <div className="skeleton-actions">
          <div className="skeleton skeleton-action-btn"></div>
          <div className="skeleton skeleton-action-btn"></div>
        </div>
      </div>
    </div>
  );
}
