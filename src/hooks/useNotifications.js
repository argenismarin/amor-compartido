'use client';

import { useState, useEffect, useCallback } from 'react';

// Convierte una VAPID public key (base64url) a Uint8Array,
// que es lo que pushManager.subscribe() espera.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// useNotifications — registro del Service Worker, gestión de la suscripción
// Web Push y estado de permisos del navegador.
//
// Args:
// - currentUser: usuario para asociar la suscripción en el backend
// - showToast: función para mostrar feedback (mensajes de éxito/error)
//
// Devuelve: { notificationsEnabled, notificationPermission, enableNotifications, disableNotifications }
export default function useNotifications(currentUser, showToast) {
  // Lazy initialization para leer el permiso actual SIN llamar a setState
  // dentro de un useEffect (evita la regla react-hooks/set-state-in-effect
  // que es nueva en next 16.2). El check `typeof window` cubre SSR.
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });

  // Registrar el Service Worker al montar (esto SÍ es side effect legítimo)
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registrado:', registration);
        })
        .catch((error) => {
          console.error('Error registrando Service Worker:', error);
        });
    }
  }, []);

  const enableNotifications = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      showToast('Tu navegador no soporta notificaciones', 'error');
      return;
    }

    try {
      // Pedir la VAPID public key al backend (fuente de verdad)
      const keyRes = await fetch('/api/subscribe?publicKey=true');
      const { publicKey } = await keyRes.json();

      if (!publicKey) {
        showToast('Las notificaciones aún no están configuradas en el servidor', 'error');
        return;
      }

      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser?.id,
            subscription: subscription.toJSON(),
          }),
        });

        setNotificationsEnabled(true);
        showToast('¡Notificaciones activadas! 🔔');

        // Notificación de prueba
        registration.showNotification('Amor Compartido 💕', {
          body: '¡Notificaciones activadas! Te avisaremos de lo importante.',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
        });
      } else {
        showToast('Permiso de notificaciones denegado', 'error');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      showToast('Error al activar notificaciones', 'error');
    }
  }, [currentUser, showToast]);

  const disableNotifications = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await fetch(`/api/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: 'DELETE',
        });
      }

      setNotificationsEnabled(false);
      showToast('Notificaciones desactivadas');
    } catch (error) {
      console.error('Error disabling notifications:', error);
      showToast('Error al desactivar notificaciones', 'error');
    }
  }, [showToast]);

  return {
    notificationsEnabled,
    notificationPermission,
    enableNotifications,
    disableNotifications,
  };
}
