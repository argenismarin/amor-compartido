'use client';

import { useState, useEffect, useCallback } from 'react';
import { count as queueCount, drainQueue } from '@/lib/offlineQueue';

// useOnlineStatus — suscribe a los eventos `online` / `offline` del navegador
// + integra el offline mutation queue (M6).
//
// Devuelve { isOnline, pendingCount, drainNow } donde:
//   - isOnline: bool del navegador
//   - pendingCount: cantidad de mutations encoladas (re-cuenta cuando
//     cambia online/offline o cuando un componente fuerza re-render)
//   - drainNow: dispara drenado manual (lo usa OfflineBadge cuando el
//     usuario hace click en "Sincronizar ahora")
//
// El drenado automatico ocurre cuando el evento 'online' dispara y
// el queue tiene mutations pendientes. Si falla a mitad, las mutations
// que quedaron se reintentan en la proxima conexion.
//
// onSyncComplete (opcional) recibe { sent, failed, conflicts } despues
// de drenar para que el caller pueda mostrar toast.
export default function useOnlineStatus(onSyncComplete) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshCount = useCallback(async () => {
    try {
      const n = await queueCount();
      setPendingCount(n);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const drainNow = useCallback(async () => {
    try {
      const result = await drainQueue();
      await refreshCount();
      onSyncComplete?.(result);
      return result;
    } catch (err) {
      console.error('[useOnlineStatus] drain failed:', err);
      return { sent: 0, failed: 0, conflicts: 0 };
    }
  }, [refreshCount, onSyncComplete]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      setIsOnline(navigator.onLine);
    }
    refreshCount();

    const handleOnline = () => {
      setIsOnline(true);
      // Drenar la cola asincronamente; si hay pendientes, sync.
      queueCount().then((n) => {
        if (n > 0) drainNow();
      });
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshCount, drainNow]);

  return { isOnline, pendingCount, drainNow, refreshCount };
}
