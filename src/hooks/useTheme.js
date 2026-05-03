'use client';

import { useState, useEffect, useCallback } from 'react';

// useTheme — gestiona preferencia de tema con override manual.
//
// Tres opciones: 'light', 'dark', 'auto'
//   - 'auto' (default): respeta prefers-color-scheme del OS
//   - 'light' / 'dark': fuerza, ignora el OS
//
// Implementacion:
//   - Setea atributo `data-theme` en <html> con el valor efectivo
//     ('light' o 'dark', nunca 'auto')
//   - El CSS usa @media (prefers-color-scheme) para 'auto', y selectors
//     [data-theme="dark"] para los overrides manuales
//   - Persiste preferencia en localStorage('theme-preference')
//
// Devuelve { theme, effectiveTheme, setTheme } donde:
//   - theme: la preferencia ('light'|'dark'|'auto')
//   - effectiveTheme: lo que esta aplicado realmente ('light'|'dark')
//   - setTheme: setter
export default function useTheme() {
  const [theme, setThemeState] = useState('auto');
  const [effectiveTheme, setEffectiveTheme] = useState('light');

  // Aplica el tema al <html> y actualiza effectiveTheme.
  const applyTheme = useCallback((pref) => {
    if (typeof document === 'undefined') return;
    let resolved = pref;
    if (pref === 'auto') {
      resolved = window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    document.documentElement.setAttribute('data-theme', resolved);
    setEffectiveTheme(resolved);
  }, []);

  // Cargar preferencia guardada y aplicar
  useEffect(() => {
    const saved = localStorage.getItem('theme-preference');
    const pref = ['light', 'dark', 'auto'].includes(saved) ? saved : 'auto';
    setThemeState(pref);
    applyTheme(pref);
  }, [applyTheme]);

  // Si el usuario eligio 'auto', escuchar cambios del OS
  useEffect(() => {
    if (theme !== 'auto') return undefined;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const handler = () => applyTheme('auto');
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, [theme, applyTheme]);

  const setTheme = useCallback((pref) => {
    if (!['light', 'dark', 'auto'].includes(pref)) return;
    localStorage.setItem('theme-preference', pref);
    setThemeState(pref);
    applyTheme(pref);
  }, [applyTheme]);

  return { theme, effectiveTheme, setTheme };
}
