'use client';

import { useState, useEffect, useCallback } from 'react';

// useInstallPrompt — captura el evento beforeinstallprompt del browser
// para ofrecer al usuario instalar la PWA en su home screen.
//
// El navegador dispara `beforeinstallprompt` cuando detecta que la PWA
// puede instalarse (manifest valido, sw registrado, criterio de
// engagement). Lo capturamos, lo guardamos, y lo disparamos cuando el
// usuario hace click en nuestro CTA.
//
// Flow:
//   1. Listen 'beforeinstallprompt' → guardar event, setIsInstallable(true)
//   2. UI muestra boton "Instalar app" cuando isInstallable
//   3. Click → event.prompt() → usuario acepta o rechaza
//   4. Si acepta → app instala, isInstallable = false
//   5. Si rechaza → marcar 'dismissed' en localStorage, no volver a ofrecer
//      por 30 dias (evita spam)
//
// Detecta tambien si ya esta instalada via display-mode: standalone.
export default function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    // Detectar si ya esta instalada (modo standalone)
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsInstalled(standalone);
    if (standalone) return undefined;

    // Respetar dismissal previo (no spammear el prompt)
    const dismissedAt = parseInt(localStorage.getItem('install-prompt-dismissed-at') || '0', 10);
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - dismissedAt < THIRTY_DAYS) return undefined;

    const handleBeforeInstall = (e) => {
      // Prevenir el mini-infobar default del browser; nosotros mostramos
      // nuestro propio CTA controlado.
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsInstallable(false);
    if (outcome === 'dismissed') {
      localStorage.setItem('install-prompt-dismissed-at', String(Date.now()));
    }
    return outcome; // 'accepted' | 'dismissed'
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    localStorage.setItem('install-prompt-dismissed-at', String(Date.now()));
    setIsInstallable(false);
  }, []);

  return { isInstallable, isInstalled, promptInstall, dismiss };
}
