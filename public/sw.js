// Service Worker para Amor Compartido
// Maneja notificaciones push y cache básico

const CACHE_NAME = 'amor-compartido-v2';
const urlsToCache = [
  '/icon-192.png',
  '/icon-512.png'
];

// NO cachear archivos de Next.js (_next/) para evitar problemas de versiones

// Mensajes bonitos para notificaciones
const NOTIFICATION_MESSAGES = {
  motivation: [
    'Tu amor te espera en la app',
    '¡Juntos son imparables!',
    'El amor se demuestra en los pequeños detalles',
    '¡Hoy es un gran día para completar tareas juntos!',
    'Tu pareja confía en ti',
    'Cada tarea es una muestra de amor',
    '¡El equipo perfecto!',
    'Construyendo sueños juntos',
    '¡Amor en acción!',
    'Unidos somos más fuertes'
  ],
  streak: [
    '¡No pierdas tu racha de amor!',
    '¡Mantén el fuego encendido!',
    'Tu racha te está esperando',
    '¡Sigue brillando!'
  ],
  task: [
    'Tu amor te dejó una tarea',
    'Tienes una nueva misión de amor',
    '¡Nueva tarea de tu persona especial!',
    'Tu pareja pensó en ti'
  ],
  mesiversario: [
    '¡Feliz mesiversario!',
    '¡Otro mes de amor juntos!',
    '¡Celebren este día especial!',
    '¡El amor crece cada mes!'
  ],
  achievement: [
    '¡Nuevo logro desbloqueado!',
    '¡Felicidades por tu logro!',
    '¡Lo lograste!',
    '¡Eres increíble!'
  ]
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first for dynamic content, cache for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache Next.js build files or API calls - always go to network
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For other requests, try cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  let data = {
    title: 'Amor Compartido',
    body: 'Tienes una nueva notificación',
    type: 'motivation',
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  // Select a message based on type if no specific body
  if (!data.customBody) {
    const messages = NOTIFICATION_MESSAGES[data.type] || NOTIFICATION_MESSAGES.motivation;
    data.body = messages[Math.floor(Math.random() * messages.length)];
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: [100, 50, 100, 50, 100],
    tag: data.tag || 'amor-compartido-notification',
    renotify: true,
    requireInteraction: data.type === 'mesiversario' || data.type === 'achievement',
    data: {
      url: data.url || '/',
      type: data.type
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir app'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if not
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Message event - for sending scheduled notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { delay, notification } = event.data;

    setTimeout(() => {
      self.registration.showNotification(notification.title, {
        body: notification.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [100, 50, 100],
        tag: notification.tag || 'scheduled-notification',
        data: { url: '/' }
      });
    }, delay);
  }
});
