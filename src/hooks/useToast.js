'use client';

import { useState, useRef, useCallback } from 'react';

// useToast — manejo del toast con timer auto-dismiss y soporte de acción.
//
// Devuelve: { toast, showToast, dismissToast }
//
// showToast(message, type, options):
// - type: 'success' | 'error' | 'info' (default: 'success')
// - options.duration: ms (default: 3000 sin acción, 7000 con acción)
// - options.action: { label, onClick } — botón opcional en el toast
//
// dismissToast(): cierra inmediatamente y limpia el timer.
export default function useToast() {
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, type = 'success', options = {}) => {
    const { duration, action = null } = options;
    const finalDuration = duration ?? (action ? 7000 : 3000);

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type, action });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, finalDuration);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  return { toast, showToast, dismissToast };
}
