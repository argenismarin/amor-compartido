# Backlog técnico

Mejoras pendientes que son demasiado grandes para una sesión casual. Cada una tiene una spec implementable y referencias a los archivos relevantes. Atacar de a una por sesión dedicada.

---

## M6 — Offline-first (queue mutations, sync on reconnect)

**Estimación**: 4–6 horas

**Problema actual**: hoy hay un `OfflineBadge` cosmético (`src/components/OfflineBadge.jsx`) pero la app no funciona offline. Si pierdes conexión a mitad de uso, los toggles, creates y edits se pierden.

**Solución**:

1. **Cachear shell**: en `src/app/layout.js`, registrar Service Worker que cachea `/`, `/sw.js`, `/icon-*.png`, `/manifest.json` y los chunks de Next con strategy `network-first` para HTML y `cache-first` para estáticos.

2. **IndexedDB queue de mutations**:
   - Crear `src/lib/offlineQueue.js` con API:
     ```
     enqueue(method, url, body) → Promise<id>
     getPending() → Promise<MutationRecord[]>
     remove(id) → Promise<void>
     ```
   - Almacén `idb-keyval` o `idb` (peso ~3KB).
   - Cada record: `{ id, method, url, body, createdAt, attempts }`.

3. **Wrapper en `fetchJson`** (`src/lib/api.js`):
   - Si `navigator.onLine === false` Y `method ≠ GET`, encolar y devolver respuesta optimista `{ queued: true }`.
   - El UI optimista del hook de tasks ya cubre el feedback inmediato.

4. **Sync background**:
   - `useOnlineStatus` hook (ya existe) detecta `online` event.
   - En `online`, drain la queue: por cada mutation pendiente, replay POST/PUT/DELETE en orden, retry con backoff si falla.
   - Si el servidor responde 409 (optimistic locking conflict), descartar la mutation con toast informativo ("se descartó tu cambio, tu pareja lo modificó primero").

5. **UX**:
   - Badge offline ya está. Agregar contador `({N} cambios pendientes)`.
   - Toast cuando sync completa: "✅ Sincronizado".

**Archivos a tocar**:
- `src/lib/offlineQueue.js` (nuevo)
- `src/lib/api.js` — interceptar mutations
- `src/hooks/useOnlineStatus.js` — agregar handler de sync
- `src/components/OfflineBadge.jsx` — contador
- `public/sw.js` (nuevo) — service worker

**Riesgos**:
- Conflictos de optimistic locking necesitan UX clara.
- IndexedDB tiene quirks en Safari (private mode); detectar y degradar a in-memory.
- Tests E2E necesitan simular `offline` → ver `playwright.config.js` para context options.

---

## M20 — Multi-couple support (auth + spaces)

**Estimación**: 8–12 horas

**Problema**: hoy la app es hardcoded para Jenifer + Argenis. ID 1 y 2 son fijos. No hay auth.

**Solución**:

1. **Auth provider**: Auth.js (NextAuth v5) con email magic links via Resend, o Clerk si quieres UX out-of-the-box. Auth.js es más control + free tier ilimitado.

2. **Schema cambios**:
   ```sql
   CREATE TABLE AppChecklist_spaces (
     id SERIAL PRIMARY KEY,
     name VARCHAR(100) NOT NULL,
     created_by INT NOT NULL REFERENCES AppChecklist_users(id),
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   CREATE TABLE AppChecklist_space_members (
     space_id INT REFERENCES AppChecklist_spaces(id) ON DELETE CASCADE,
     user_id INT REFERENCES AppChecklist_users(id) ON DELETE CASCADE,
     role VARCHAR(20) DEFAULT 'member',
     joined_at TIMESTAMPTZ DEFAULT NOW(),
     PRIMARY KEY (space_id, user_id)
   );

   ALTER TABLE AppChecklist_users ADD COLUMN email VARCHAR(255) UNIQUE;
   ALTER TABLE AppChecklist_users ADD COLUMN password_hash TEXT;

   ALTER TABLE AppChecklist_tasks ADD COLUMN space_id INT REFERENCES AppChecklist_spaces(id) ON DELETE CASCADE;
   ALTER TABLE AppChecklist_projects ADD COLUMN space_id INT REFERENCES AppChecklist_spaces(id) ON DELETE CASCADE;
   ALTER TABLE AppChecklist_categories ADD COLUMN space_id INT;  -- null = global
   ALTER TABLE AppChecklist_special_dates ADD COLUMN space_id INT REFERENCES AppChecklist_spaces(id) ON DELETE CASCADE;
   -- comments, activity ya estan scoped via task_id que lleva space_id
   ```

3. **Migración de datos**:
   - Crear space "Jenifer & Argenis" automático en init si hay user 1+2.
   - Backfill `space_id` de todas las tablas.

4. **Cambios en API routes**:
   - Cada endpoint: extraer `userId` desde session (NO desde query param).
   - Cada query: agregar `WHERE space_id = $current` derivado de la membership del user.
   - Crear helper `getSpaceForRequest(req)` en `src/lib/auth.js`.

5. **Frontend**:
   - Página `/login`, `/signup`, `/spaces/invite`.
   - Reemplazar localStorage `currentUserId` por session.
   - Selector de space si user pertenece a múltiples (futuro: "espacios" para amigos, no solo parejas).

6. **Compatibilidad**:
   - Mantener path actual funcionando para Jenifer+Argenis sin re-login durante transición (cookie con flag `legacy`).

**Archivos**:
- `src/lib/auth.js` (nuevo)
- `src/app/api/auth/[...nextauth]/route.js` (nuevo)
- `src/app/login/page.js`, `src/app/signup/page.js` (nuevos)
- Cada API route: agregar guard de auth + scoping
- `src/hooks/useUsers.js` — switch a `useSession`

**Riesgos**:
- Migración de datos: si falla a mitad, app rota. Hacer en staging primero.
- Push subscriptions: tabla actual asume userId fijo, hay que re-suscribir todos.
- Activity log: existing rows sin space_id → backfill o filtrar.

---

## M27 — TypeScript incremental migration

**Estimación**: 6–8 horas (parcial), 20+ horas (completa)

**Estrategia incremental** (evita rewrite big bang):

1. **Setup mínimo** (~30 min):
   - `npm i -D typescript @types/react @types/node @types/pg`
   - `tsconfig.json` con `allowJs: true`, `checkJs: false`, `strict: true` para `.ts/.tsx`.
   - `next.config.mjs`: habilitar TypeScript mode (no necesita cambios, Next lo detecta).

2. **Migrar archivo por archivo** (rename .js → .ts, fix errors):
   - **Prioridad 1** (alto valor, bajo riesgo): `src/lib/db.js`, `src/lib/api.js`, `src/lib/validation/schemas.js`, `src/lib/timezone.js`, `src/lib/dates.js`, `src/lib/rateLimit.js`, `src/lib/activity.js`, `src/lib/fuzzy.js`.
   - **Prioridad 2**: hooks (`src/hooks/*.js`).
   - **Prioridad 3**: componentes (`src/components/*.jsx`).
   - **Prioridad 4**: API routes (`src/app/api/**/*.js`).
   - **Prioridad 5**: `src/app/page.js` (más complejo, dejar al final).

3. **Tipos derivados de zod**:
   - `import { z } from 'zod'`
   - `type CreateTaskInput = z.infer<typeof createTaskSchema>` — single source of truth de tipos.

4. **Tipos de DB rows**:
   - Crear `src/types/db.ts` con interfaces para cada tabla.
   - Usar como return type de `query<TaskRow>(...)`.

5. **Strict en nuevo código solamente**:
   - `tsconfig.json` con `"strict": true` aplica solo a `.ts`. JS files siguen sin checks.
   - Cuando un archivo migra a `.ts`, sus errores aparecen y se arreglan en ese commit.

**Archivos guía**:
- `tsconfig.json` (nuevo)
- `src/types/db.ts` (nuevo)
- `src/types/api.ts` (nuevo, request/response shapes)

**Riesgos**:
- Tipos de pg driver son débiles; agregar wrapper tipado.
- React 19 + Next 16 tipos pueden ser inestables; lockfile.

---

## M28 — Convert SPA to Next App Router routes

**Estimación**: 6–8 horas

**Problema**: `page.js` tiene 1400+ LOC con todo el state. Difícil de navegar, lento de build, no hay code splitting por feature.

**Solución**:

1. **Routes a crear**:
   ```
   /                        → solo "Mis Tareas" (refactor de page.js actual)
   /assigned                → tab "Para [Pareja]"
   /projects                → grid de proyectos
   /projects/[id]           → detalle de proyecto (reemplaza /project/[id] redirect)
   /tasks/[id]              → modal-página de tarea (reemplaza /task/[id] redirect)
   /history                 → modal-página de historial
   /achievements            → modal-página de logros
   /settings                → modal-página de configuración
   /stats                   → modal-página de stats
   ```

2. **State sharing**: Context Provider en `src/app/layout.js`:
   ```
   <UserProvider>
     <TasksProvider>   {/* useTasks adaptado a context */}
       <ProjectsProvider>
         {children}
       </ProjectsProvider>
     </TasksProvider>
   </UserProvider>
   ```
   Cada route consume del context con `useContext`.

3. **Server components donde aplica**:
   - `/projects` puede ser RSC con fetch directo a DB (sin pasar por API).
   - `/stats` puede ser RSC.
   - Tareas necesitan client component por interactividad.

4. **Loading + error boundaries**:
   - `loading.js` por route → skeleton mientras hidrata.
   - `error.js` → mostrar fallback en vez de blanco.

5. **Migración**:
   - Mover JSX de cada bloque de `page.js` a su nueva route.
   - Modal-páginas: usar `parallel routes` o `intercepting routes` para que sigan abriendo como modal pero tengan URL propia.

**Archivos**:
- `src/app/projects/page.js` (nuevo)
- `src/app/projects/[id]/page.js` (nuevo, reemplaza el redirect actual)
- `src/app/tasks/[id]/page.js` (nuevo, reemplaza el redirect actual)
- `src/app/history/page.js`, `src/app/settings/page.js`, etc.
- `src/contexts/TasksContext.js` (nuevo)
- `src/app/page.js` — adelgazar a ~200 LOC

**Beneficio**:
- URL navigable sin redirects
- Code splitting por route (~30% menos JS inicial)
- Mejor SEO si en el futuro hay landing
- Browser back/forward funciona naturalmente

**Riesgos**:
- Polling de tasks debe seguir funcionando cross-route.
- Modales actuales (Achievements, Settings) requieren refactor a "page that looks like modal".

---

## M29 — Storybook for components

**Estimación**: 3 horas

**Setup**:
1. `npx storybook@latest init` — autodetecta Next + React.
2. Configurar para usar Tailwind + globals.css en `.storybook/preview.js`.
3. Stories iniciales:
   - `TaskCard.stories.jsx` (estados: pendiente, completada, con subtareas, con reaction, con comentarios)
   - `ProjectCard.stories.jsx` (con/sin descripción, con/sin progreso)
   - `TaskCardSkeleton.stories.jsx`
   - `Toast.stories.jsx` (success, error, info, con action)
   - `ConfirmDialog.stories.jsx`
   - `ProjectFormModal.stories.jsx`
   - `TaskFormModal.stories.jsx`
4. Mock data en `.storybook/mocks/` con ejemplos de tasks/projects.
5. Visual regression: agregar `@chromatic-com/storybook` o `@storybook/test-runner` con Playwright para detectar regresiones de cascade en globals.css.

**Beneficio principal**: M2 (split CSS) bloqueado por riesgo de regresión queda desbloqueado con visual diffs automáticos.

**Archivos**:
- `.storybook/main.js`, `.storybook/preview.js` (nuevos)
- `src/components/**/*.stories.jsx` (nuevos)

---

## M30 — i18n (es/en) with next-intl

**Estimación**: 4 horas

**Setup**:
1. `npm i next-intl`
2. Crear `src/i18n/messages/{es,en}.json` con todas las keys.
3. Wrappear `src/app/layout.js` con `<NextIntlClientProvider>`.
4. Reemplazar todos los strings hardcoded por `t('keys.path')`:
   - Aproximadamente 200 strings esparcidos en page.js, modales, hooks.
5. Selector de idioma en SettingsModal junto al theme picker.
6. Persistir preferencia en localStorage `lang-preference`.

**Estrategia de extracción**:
- Grep por strings entre comillas en archivos JSX/JS.
- Agruparlos por feature: `tasks.*`, `projects.*`, `settings.*`, `errors.*`, etc.
- Empezar por es.json, copiar estructura a en.json y traducir.

**Archivos**:
- `src/i18n/messages/es.json` (nuevo, todas las keys)
- `src/i18n/messages/en.json` (nuevo, traducciones)
- `src/i18n/config.js` (nuevo)
- Cada archivo con strings: reemplazar literales por `useTranslations()` o `getTranslations()`.

**Riesgos**:
- Plurals (`{count} tareas` vs `{count} tarea`) requieren ICU MessageFormat.
- Date locale: cambiar `'es-CO'` a `useLocale()`.
- Push notifications server-side: el server no sabe el locale del cliente; pasar via subscription metadata o tener todos los pushes en el idioma "principal" del space.

---

## Cómo abordar este backlog

1. **No agarrar dos en paralelo**. Cada uno toca el corazón de la app.
2. **Empezar por M27 (TypeScript) si vas a hacer M28 después** — los tipos hacen el refactor de App Router mucho menos doloroso.
3. **M20 (multi-couple) requiere PR aparte por feature flag** — feature toggle + dual-mode mientras migras.
4. **M6 (offline) y M28 (App Router) chocan** — el offline asume cierto state model. Hacer M28 primero.
5. **M29 (Storybook) es prerequisito de un buen split de CSS** (que está documentado en globals.css TOC pero pendiente).
6. **M30 (i18n) último** — mejor cuando los strings están más estables (después de M28).

Orden recomendado: M27 → M28 → M29 → M6 → M30 → M20.
