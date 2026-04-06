# Amor Compartido 💕

PWA para parejas que permite compartir y gestionar tareas, proyectos y celebraciones juntos.

## Características

- Gestión de tareas compartidas con asignación a un usuario o a ambos
- Proyectos con tareas agrupadas, progreso y archivado
- Categorías, prioridades y fechas límite
- Búsqueda y ordenamiento configurable
- Tareas recurrentes (diaria/semanal/mensual)
- Subtareas dentro de cada tarea
- Reacciones con emojis y celebraciones animadas
- Gamificación: rachas, logros y mesiversarios
- Push notifications reales (Web Push API)
- Dos usuarios con cambio rápido y temas duales
- Diseño mobile-first
- Instalable como PWA con Service Worker

## Stack

- **Framework**: Next.js 16 + React 19
- **Estilos**: CSS vanilla con variables (themes por usuario)
- **Base de datos**: PostgreSQL (vía `pg`)
- **Push**: `web-push` con VAPID
- **Deploy**: Vercel

## Configuración

### Variables de entorno

Crear `.env.local` en la raíz con:

```env
# PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/database

# VAPID keys para push notifications
# Generar con: npm run generate-vapid
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:tu-email@ejemplo.com
```

### Desarrollo local

```bash
npm install
npm run generate-vapid   # genera VAPID keys (correr una sola vez)
npm run dev              # http://localhost:3000
```

### Despliegue en Vercel

1. Conectar el repo a Vercel.
2. Configurar las mismas env vars en Project Settings → Environment Variables (Production).
3. Push a `master` → Vercel hace deploy automático.

## Estructura de la base de datos

Las tablas usan el prefijo `AppChecklist_` y se crean automáticamente al primer request:

- `AppChecklist_users` — usuarios (Jenifer y Argenis por defecto)
- `AppChecklist_tasks` — tareas con asignación, prioridad, recurrencia
- `AppChecklist_subtasks` — subtareas (checklist dentro de cada tarea)
- `AppChecklist_projects` — proyectos con archivado
- `AppChecklist_categories` — categorías predefinidas
- `AppChecklist_streaks` — racha de actividad por usuario
- `AppChecklist_achievements` — definición de logros
- `AppChecklist_user_achievements` — logros desbloqueados
- `AppChecklist_special_dates` — aniversarios y cumpleaños
- `AppChecklist_push_subscriptions` — suscripciones de Web Push
- `AppChecklist_app_usage` — fecha del primer uso

## Scripts

```bash
npm run dev             # servidor de desarrollo
npm run build           # build de producción
npm run start           # servidor de producción
npm run lint            # ESLint
npm run generate-vapid  # genera VAPID keys nuevas
npm run test:e2e        # tests E2E con Playwright (headless)
npm run test:e2e:ui     # tests E2E con UI interactiva
```

## Tests E2E

Los tests viven en `tests/e2e/` y usan **Playwright** con mocks de las API
routes (`tests/e2e/helpers/mockApi.js`). Esto significa que NO necesitan
una BD para correr — el state vive en memoria por test y `page.route()`
intercepta todas las llamadas a `/api/*`.

```bash
# Correr todos los tests
npm run test:e2e

# UI interactiva (recomendado para debug)
npm run test:e2e:ui

# Un test específico
npx playwright test smoke.spec.js
```

La primera vez hay que descargar los browsers de Playwright:

```bash
npx playwright install --with-deps chromium
```

### CI

Cada push a `master` y cada PR dispara `.github/workflows/test.yml` que corre
ESLint + los tests E2E en Ubuntu con Chromium. El workflow falla si algún
test falla y sube el reporte HTML como artifact.
