'use client';

import { useEffect, useRef } from 'react';

// Selector de elementos que pueden recibir foco con Tab
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), ' +
  '[tabindex]:not([tabindex="-1"])';

// useFocusTrap — atrapa el foco dentro de un contenedor (modal),
// dispara onClose en Escape, y restaura el foco al cerrar.
//
// Uso:
//   const containerRef = useFocusTrap(onClose);
//   return <div ref={containerRef}>...</div>
//
// El componente se asume que solo se renderiza cuando el modal está
// abierto (el caller hace `{showModal && <Modal />}`), así que no
// necesitamos un flag isOpen — el useEffect corre al montar y limpia
// al desmontar.
export default function useFocusTrap(onClose) {
  const containerRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Guardar onClose en una ref para que el useEffect no re-corra cuando
  // el caller pasa una arrow function inline (cambia cada render).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    // Guardar el elemento con foco actual para restaurarlo al cerrar
    previousFocusRef.current = document.activeElement;

    const container = containerRef.current;

    // Autofocus: preferir el primer input/textarea sobre un botón
    if (container) {
      const firstInput = container.querySelector(
        'input:not([disabled]):not([type="hidden"]), textarea:not([disabled])'
      );
      if (firstInput) {
        firstInput.focus();
      } else {
        const focusables = container.querySelectorAll(FOCUSABLE_SELECTOR);
        if (focusables.length > 0) focusables[0].focus();
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (e.key !== 'Tab' || !container) return;

      const focusables = container.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restaurar foco al disparador original del modal
      const previous = previousFocusRef.current;
      if (previous && typeof previous.focus === 'function') {
        try {
          previous.focus();
        } catch {
          // el elemento puede haber sido removido del DOM
        }
      }
    };
  }, []);

  return containerRef;
}
