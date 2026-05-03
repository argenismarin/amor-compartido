'use client';

// Badge fijo en la parte superior que aparece SOLO cuando el navegador
// está offline. Tambien muestra el contador de mutations pendientes
// (M6 offline-first) si hay cosas encoladas.
//
// Recibe { isOnline, pendingCount } como props para evitar duplicar la
// suscripcion al hook (page.js ya lo monta una vez para sync handler).
export default function OfflineBadge({ isOnline, pendingCount = 0 }) {
  // Si esta online y no hay pendientes, no renderizamos nada
  if (isOnline && pendingCount === 0) return null;

  // Online + pendientes: el sync ya se disparo (handleOnline en
  // useOnlineStatus). Mostrar badge transitorio mientras procesa.
  if (isOnline) {
    return (
      <div
        className="offline-badge"
        role="status"
        aria-live="polite"
        style={{ background: 'var(--success)' }}
      >
        <span className="offline-badge-icon" aria-hidden="true">🔄</span>
        <span>Sincronizando {pendingCount} {pendingCount === 1 ? 'cambio' : 'cambios'}…</span>
      </div>
    );
  }

  return (
    <div
      className="offline-badge"
      role="status"
      aria-live="polite"
      aria-label="Sin conexión a internet"
    >
      <span className="offline-badge-icon" aria-hidden="true">📡</span>
      <span>
        Sin conexión
        {pendingCount > 0 && ` — ${pendingCount} ${pendingCount === 1 ? 'cambio pendiente' : 'cambios pendientes'}`}
      </span>
    </div>
  );
}
