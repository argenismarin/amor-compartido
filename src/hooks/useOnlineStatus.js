'use client';

import { useState, useEffect } from 'react';

// useOnlineStatus — suscribe a los eventos `online` / `offline` del navegador
// y devuelve un booleano que refleja si hay conexión.
//
// Se usa para mostrar un badge de "sin conexión" y (eventualmente) para
// deshabilitar acciones que requieren red. Es un PWA instalable, así que
// el usuario puede abrir la app offline y necesita feedback claro.
//
// Nota SSR: durante el primer render en servidor `navigator` no existe,
// así que asumimos `true` (la gran mayoría de los usuarios entran con
// conexión). El primer useEffect del cliente corrige el valor real
// inmediatamente si está offline.
export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Sincronizar con el estado real del navegador al montar
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
