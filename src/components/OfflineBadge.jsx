'use client';

import useOnlineStatus from '@/hooks/useOnlineStatus';

// Badge fijo en la parte superior que aparece SOLO cuando el navegador
// está offline. No es intrusivo: es un aviso pasivo para que el usuario
// sepa que sus cambios quedarán locales (optimistic updates) hasta que
// vuelva la conexión.
//
// Pensado como componente "mount-and-forget": una sola instancia en
// page.js basta.
export default function OfflineBadge() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="offline-badge"
      role="status"
      aria-live="polite"
      aria-label="Sin conexión a internet"
    >
      <span className="offline-badge-icon" aria-hidden="true">📡</span>
      <span>Sin conexión — tus cambios se guardarán al reconectarte</span>
    </div>
  );
}
