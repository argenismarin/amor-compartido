// Service Worker para Amor Compartido
// Maneja notificaciones push y cache básico

const CACHE_NAME = 'amor-compartido-v4';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
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

// Fetch event - network first for dynamic content, cache for static assets.
//
// M6 (offline-first): para requests de navegacion (HTML), intentamos
// network primero pero degradamos a cached '/' si no hay red. Asi la
// app abre offline mostrando el shell, y los datos los toma del
// optimistic state local + offline queue (ver src/lib/offlineQueue.js).
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // APIs nunca van por cache; tienen su propio offline queue
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Build files de Next: directo a red (varian por hash)
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Navegacion (HTML): network-first con fallback al shell cacheado
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // Cachear copia para offline (clone porque body se consume)
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then((m) => m || caches.match(event.request)))
    );
    return;
  }

  // Resto (estaticos, imagenes): cache-first
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  let data = {
    title: 'Amor Compartido',
    body: '',
    type: 'motivation',
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  };

  let hadPayload = false;
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
      hadPayload = true;
    } catch (e) {
      data.body = event.data.text();
      hadPayload = !!data.body;
    }
  }

  // Si el push no trajo body real, usar un mensaje motivacional random
  // (caso de pushes silenciosos sin payload).
  if (!hadPayload || !data.body) {
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
