'use client';

import { useEffect, useRef } from 'react';

// usePolling — ejecuta una lista de callbacks en intervalos regulares
// mientras la pestaña esté visible. También dispara los callbacks
// inmediatamente cuando el usuario vuelve a la pestaña (visibilitychange).
//
// Args:
//   - enabled: bool, si false el polling se desactiva (útil para esperar
//     a que currentUser exista antes de empezar a hacer fetches)
//   - intervalMs: cada cuánto disparar (default 5000)
//   - tickFn: función que ejecuta TODAS las llamadas que querés hacer
//     en cada tick. Tiene que ser estable o el polling se reinicia
//     constantemente — por eso usamos un ref interno que la actualiza
//     en cada render sin re-disparar el efecto.
//
// Uso típico:
//   usePolling(!!currentUser, 5000, () => {
//     fetchTasks();
//     fetchProjects();
//   });
export default function usePolling(enabled, intervalMs, tickFn) {
  const tickRef = useRef(tickFn);

  // Mantener tickRef actualizada con la versión más reciente de tickFn
  // sin causar reset del setInterval
  useEffect(() => {
    tickRef.current = tickFn;
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const tick = () => {
      if (document.visibilityState === 'visible') {
        tickRef.current?.();
      }
    };

    const interval = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [enabled, intervalMs]);
}
