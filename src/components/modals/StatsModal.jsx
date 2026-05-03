'use client';

import { useEffect, useState } from 'react';
import useFocusTrap from '@/hooks/useFocusTrap';
import { fetchJson } from '@/lib/api';

// StatsModal — dashboard de metricas de la pareja.
//
// Render simple sin libreria de charts: SVG inline para barras y
// sparkline. Para una app de 2 usuarios y dashboards basicos esto
// es mas que suficiente y evita 80KB+ de Chart.js / Recharts.
//
// Props:
// - onClose: cierra el modal
export default function StatsModal({ onClose }) {
  const containerRef = useFocusTrap(onClose);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson('/api/stats')
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Error fetching stats:', err);
          setError('No pudimos cargar las estadísticas');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal stats-modal"
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h2 className="modal-title">📊 Estadísticas de la pareja</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading && <p className="empty-state-text">Cargando…</p>}
        {error && <p className="empty-state-text" style={{ color: 'var(--accent)' }}>{error}</p>}
        {stats && <StatsContent stats={stats} />}
      </div>
    </div>
  );
}

function StatsContent({ stats }) {
  const { byUser, byCategory, last30Days, byPriority, totals } = stats;

  // Sparkline de los ultimos 30 dias
  const maxDay = Math.max(1, ...last30Days.map((d) => parseInt(d.completed) || 0));

  return (
    <>
      <div className="stats-totals">
        <Totals
          label="Hoy"
          value={parseInt(totals.completed_today || 0)}
        />
        <Totals
          label="Esta semana"
          value={parseInt(totals.completed_this_week || 0)}
        />
        <Totals
          label="Total"
          value={parseInt(totals.completed_all_time || 0)}
        />
      </div>

      <div className="stats-section">
        <h3 className="stats-section-title">📈 Últimos 30 días</h3>
        <div className="stats-sparkline" role="img" aria-label="Tareas completadas por día">
          {last30Days.map((d) => {
            const v = parseInt(d.completed) || 0;
            const h = (v / maxDay) * 100;
            return (
              <div
                key={d.date}
                className="sparkline-bar"
                style={{ height: `${h}%` }}
                title={`${d.date}: ${v}`}
                aria-label={`${d.date}: ${v} tareas`}
              />
            );
          })}
        </div>
      </div>

      <div className="stats-section">
        <h3 className="stats-section-title">👥 Por usuario</h3>
        {byUser.map((u) => {
          const completed = parseInt(u.completed) || 0;
          const created = parseInt(u.created) || 0;
          const max = Math.max(completed, created, 1);
          return (
            <div key={u.id} className="stats-user-row">
              <div className="stats-user-name">
                <span>{u.avatar_emoji}</span>
                <strong>{u.name}</strong>
              </div>
              <Bar label="Completadas" value={completed} max={max} color="var(--success)" />
              <Bar label="Creadas" value={created} max={max} color="var(--primary)" />
            </div>
          );
        })}
      </div>

      <div className="stats-section">
        <h3 className="stats-section-title">📋 Por categoría</h3>
        {byCategory.map((c) => {
          const v = parseInt(c.completed) || 0;
          const max = Math.max(...byCategory.map((x) => parseInt(x.completed) || 0), 1);
          return (
            <div key={c.id} className="stats-cat-row">
              <span className="stats-cat-label">
                {c.emoji} {c.name}
              </span>
              <Bar value={v} max={max} color={c.color} inline />
              <span className="stats-cat-value">{v}</span>
            </div>
          );
        })}
      </div>

      <div className="stats-section">
        <h3 className="stats-section-title">🎯 Por prioridad</h3>
        <div className="stats-priority-grid">
          {['high', 'medium', 'low'].map((p) => {
            const row = byPriority.find((r) => r.priority === p);
            const v = row ? parseInt(row.completed) : 0;
            const symbol = p === 'high' ? '▲' : p === 'low' ? '▼' : '─';
            const label = p === 'high' ? 'Alta' : p === 'low' ? 'Baja' : 'Media';
            return (
              <div key={p} className={`stats-priority-card priority-${p}`}>
                <span className="stats-priority-symbol">{symbol}</span>
                <span className="stats-priority-value">{v}</span>
                <span className="stats-priority-label">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Totals({ label, value }) {
  return (
    <div className="stats-total-card">
      <span className="stats-total-value">{value}</span>
      <span className="stats-total-label">{label}</span>
    </div>
  );
}

function Bar({ label, value, max, color, inline = false }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className={`stats-bar-row ${inline ? 'inline' : ''}`}>
      {label && (
        <span className="stats-bar-label">
          {label}: {value}
        </span>
      )}
      <div className="stats-bar-track">
        <div className="stats-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
