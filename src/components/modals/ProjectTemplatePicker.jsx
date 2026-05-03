'use client';

import { useState } from 'react';
import useFocusTrap from '@/hooks/useFocusTrap';
import { PROJECT_TEMPLATES } from '@/lib/projectTemplates';

// Modal que ofrece plantillas de proyectos pre-armadas. El usuario
// elige una y la app crea el proyecto + todas sus tareas en cadena.
//
// Props:
// - currentUserId: para asignar las tareas creadas
// - onCreate: async (template) => Promise<void>. El padre maneja los
//   POSTs y los refetchs; este modal solo dispara con la plantilla.
// - onClose: cerrar
// - busyTemplateId: id de la plantilla que se esta creando (para spinner)
export default function ProjectTemplatePicker({ onCreate, onClose, busyTemplateId }) {
  const containerRef = useFocusTrap(onClose);
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal templates-modal"
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h2 className="modal-title">📦 Plantillas de proyecto</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <p className="settings-section-desc">
          Elegí una plantilla para arrancar con tareas pre-armadas.
        </p>
        <div className="templates-list">
          {PROJECT_TEMPLATES.map((tpl) => {
            const isBusy = busyTemplateId === tpl.id;
            const isExpanded = expandedId === tpl.id;
            return (
              <div key={tpl.id} className="template-card" style={{ '--project-color': tpl.color }}>
                <button
                  type="button"
                  className="template-card-header"
                  onClick={() => setExpandedId(isExpanded ? null : tpl.id)}
                  aria-expanded={isExpanded}
                >
                  <span className="template-emoji">{tpl.emoji}</span>
                  <div className="template-meta">
                    <strong>{tpl.name}</strong>
                    <span className="template-desc">{tpl.description}</span>
                    <span className="template-count">{tpl.tasks.length} tareas</span>
                  </div>
                  <span className="template-toggle">{isExpanded ? '▾' : '▸'}</span>
                </button>
                {isExpanded && (
                  <ul className="template-tasks-list">
                    {tpl.tasks.map((t, i) => (
                      <li key={i}>
                        <span className={`template-task-priority priority-${t.priority || 'medium'}`} aria-hidden="true">
                          {t.priority === 'high' ? '▲' : t.priority === 'low' ? '▼' : '─'}
                        </span>
                        <span>{t.title}</span>
                        {t.recurrence && (
                          <span className="template-task-recurrence" title={`Repetir: ${t.recurrence}`}>🔄</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="template-create-btn"
                  onClick={() => onCreate(tpl)}
                  disabled={!!busyTemplateId}
                >
                  {isBusy ? 'Creando...' : 'Usar esta plantilla'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
