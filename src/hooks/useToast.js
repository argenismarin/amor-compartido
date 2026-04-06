'use client';

import { useState, useRef, useCallback } from 'react';

// useToast — manejo del toast con timer auto-dismiss, soporte de acción
// y pausa on hover.
//
// Devuelve: { toast, showToast, dismissToast, pauseTimer, resumeTimer }
//
// showToast(message, type, options):
// - type: 'success' | 'error' | 'info' (default: 'success')
// - options.duration: ms (default: 3000 sin acción, 7000 con acción)
// - options.action: { label, onClick } — botón opcional en el toast
//
// dismissToast(): cierra inmediatamente y limpia el timer.
// pauseTimer(): cancela el auto-dismiss (el toast queda hasta nuevo aviso).
// resumeTimer(): reinicia el auto-dismiss con la duración original.
export default function useToast() {
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const toastDurationRef = useRef(3000);

  const startTimer = useCallback((ms) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, ms);
  }, []);

  const showToast = useCallback((message, type = 'success', options = {}) => {
    const { duration, action = null } = options;
    const finalDuration = duration ?? (action ? 7000 : 3000);

    toastDurationRef.current = finalDuration;
    setToast({ message, type, action });
    startTimer(finalDuration);
  }, [startTimer]);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const pauseTimer = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const resumeTimer = useCallback(() => {
    // Reinicia con la duración original — no es "remaining" real, pero es
    // buena UX: mientras el cursor está encima el tiempo "se recarga".
    startTimer(toastDurationRef.current);
  }, [startTimer]);

  return { toast, showToast, dismissToast, pauseTimer, resumeTimer };
}
