// Esquemas de validación con zod para los inputs de las API routes.
//
// Cada endpoint mutador usa estos esquemas con `validateBody(schema, body)`
// para garantizar que los datos entrantes son del tipo correcto antes de
// ejecutar SQL. Si fallan, devuelven 400 con un mensaje útil.

import { z } from 'zod';

// Helpers compartidos
const positiveInt = z.number().int().positive();
const optionalPositiveInt = positiveInt.nullable().optional();
const trimmedString = (max) => z.string().trim().min(1).max(max);
const optionalTrimmedString = (max) =>
  z.string().trim().max(max).nullable().optional();

// YYYY-MM-DD, cadena vacía (se normaliza a null), null o undefined.
//
// Aceptamos '' y la transformamos a null porque el <input type="date">
// del cliente devuelve '' cuando el usuario no elige fecha. Clientes
// cacheados del service worker del PWA (que aún no tienen el fix del
// hook) siguen enviando '', así que el servidor tiene que tolerar esa
// forma para no devolver 400.
//
// El regex anterior `/^\d{4}-\d{2}-\d{2}/` (sin `$`) aceptaba fechas
// inválidas como "2024-13-45" o "2024-01-01-extra", que luego rompían
// PostgreSQL con un 500. Ahora exigimos formato exacto + validamos que
// el día/mes existan realmente (no más Feb 30, no más mes 13).
const dateString = z
  .union([
    z.literal('').transform(() => null),
    z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato debe ser YYYY-MM-DD')
      .refine((s) => {
        const [y, m, d] = s.split('-').map(Number);
        if (m < 1 || m > 12 || d < 1 || d > 31) return false;
        // Round-trip: si construir Date(y, m-1, d) no devuelve los mismos
        // componentes, la fecha era inválida (ej: Feb 30 → Mar 2).
        const dt = new Date(Date.UTC(y, m - 1, d));
        return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
      }, 'Fecha inválida'),
    z.null(),
  ])
  .optional();

const priorityEnum = z.enum(['low', 'medium', 'high']);
const recurrenceEnum = z.enum(['daily', 'weekly', 'monthly', 'custom']);

// ─── Tasks ──────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  title: trimmedString(255),
  description: optionalTrimmedString(2000),
  assigned_to: positiveInt,
  assigned_by: positiveInt,
  due_date: dateString,
  priority: priorityEnum.optional().default('medium'),
  category_id: optionalPositiveInt,
  project_id: optionalPositiveInt,
  recurrence: recurrenceEnum.nullable().optional(),
  recurrence_days: z.string().nullable().optional(),
  is_shared: z.boolean().optional().default(false),
});

// PUT /api/tasks/[id] tiene 3 modos: toggle_complete, reaction, full update.
// Cada modo tiene su propio esquema; el handler discrimina por las keys
// presentes en el body.
export const toggleTaskSchema = z.object({
  toggle_complete: z.literal(true),
});

export const reactionTaskSchema = z.object({
  // Permitimos null para "quitar reacción"
  reaction: z.string().max(20).nullable(),
});

export const updateTaskSchema = z.object({
  title: trimmedString(255).optional(),
  description: optionalTrimmedString(2000),
  assigned_to: positiveInt.optional(),
  due_date: dateString,
  priority: priorityEnum.optional(),
  category_id: optionalPositiveInt,
  project_id: optionalPositiveInt,
  recurrence: recurrenceEnum.nullable().optional(),
  recurrence_days: z.string().nullable().optional(),
  is_shared: z.boolean().optional(),
  // Para el optimistic locking
  expected_updated_at: z.string().nullable().optional(),
});

// ─── Users ──────────────────────────────────────────────────────────

export const updateUserSchema = z.object({
  id: positiveInt,
  name: trimmedString(100),
  avatar_emoji: z.string().max(20),
});

// ─── Projects ───────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: trimmedString(100),
  description: optionalTrimmedString(2000),
  emoji: z.string().max(10).optional().default('📁'),
  color: z.string().max(20).optional().default('#6366f1'),
  due_date: dateString,
});

export const updateProjectSchema = z.object({
  name: trimmedString(100).optional(),
  description: optionalTrimmedString(2000),
  emoji: z.string().max(10).optional(),
  color: z.string().max(20).optional(),
  due_date: dateString,
  is_archived: z.boolean().optional(),
  // Para optimistic locking (mismo patrón que updateTaskSchema).
  // Si el cliente lo envía, el UPDATE valida que el updated_at actual
  // coincida; si no, devuelve 409 conflict.
  expected_updated_at: z.string().nullable().optional(),
});

// ─── Special dates ──────────────────────────────────────────────────

// Tipos válidos: el frontend solo usa 'anniversary' y 'birthday' (ver
// SettingsModal.jsx). Si en el futuro se agregan más tipos (custom,
// meeting, etc.) hay que ampliar este enum y validarlos en el banner
// de page.js.
export const specialDateSchema = z.object({
  type: z.enum(['anniversary', 'birthday']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato debe ser YYYY-MM-DD'),
  user_id: optionalPositiveInt,
  label: optionalTrimmedString(100),
});

// ─── Subtasks ───────────────────────────────────────────────────────

export const createSubtaskSchema = z.object({
  task_id: positiveInt,
  title: trimmedString(255),
});

// PUT /api/subtasks/[id] tiene 2 modos: toggle o edit title
export const toggleSubtaskSchema = z.object({
  toggle_complete: z.literal(true),
});

export const updateSubtaskSchema = z.object({
  title: trimmedString(255),
});

// ─── Import / Export ────────────────────────────────────────────────

// Schema del payload que acepta POST /api/import. Es el mismo formato
// que devuelve /api/export, así que un usuario puede re-importar sus
// backups. Los IDs del payload son "antiguos" — el endpoint los mapea
// a nuevos al insertar.
export const importPayloadSchema = z.object({
  version: z.number().int(),
  exportedAt: z.string().optional(),
  tasks: z
    .array(
      z.object({
        id: z.number().int().optional(),
        title: z.string().min(1).max(255),
        description: z.string().nullable().optional(),
        assigned_to: z.number().int(),
        assigned_by: z.number().int(),
        is_completed: z.boolean().optional().default(false),
        completed_at: z.string().nullable().optional(),
        due_date: z.string().nullable().optional(),
        priority: priorityEnum.optional().default('medium'),
        reaction: z.string().nullable().optional(),
        category_id: z.number().int().nullable().optional(),
        project_id: z.number().int().nullable().optional(),
        recurrence: recurrenceEnum.nullable().optional(),
        recurrence_days: z.string().nullable().optional(),
        is_shared: z.boolean().optional().default(false),
        deleted_at: z.string().nullable().optional(),
        subtasks: z
          .array(
            z.object({
              title: z.string().min(1).max(255),
              is_completed: z.boolean().optional().default(false),
              sort_order: z.number().int().optional().default(0),
            })
          )
          .optional()
          .default([]),
      })
    )
    .optional()
    .default([]),
  projects: z
    .array(
      z.object({
        id: z.number().int().optional(),
        name: z.string().min(1).max(100),
        description: z.string().nullable().optional(),
        emoji: z.string().max(10).optional().default('📁'),
        color: z.string().max(20).optional().default('#6366f1'),
        due_date: z.string().nullable().optional(),
        is_archived: z.boolean().optional().default(false),
      })
    )
    .optional()
    .default([]),
  specialDates: z
    .array(
      z.object({
        type: z.string().max(50),
        date: z.string(),
        user_id: z.number().int().nullable().optional(),
        label: z.string().nullable().optional(),
      })
    )
    .optional()
    .default([]),
});

// ─── Subscribe ──────────────────────────────────────────────────────

export const subscribeSchema = z.object({
  userId: positiveInt,
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
});

// ─── Helper ─────────────────────────────────────────────────────────

// Valida un body con un esquema. Devuelve { data } si pasa, o { error }
// con un mensaje human-readable si falla. Usar como:
//
//   const { data, error } = validateBody(createTaskSchema, body);
//   if (error) {
//     return NextResponse.json({ error }, { status: 400 });
//   }
//   // ... usar data ...
export function validateBody(schema, body) {
  const result = schema.safeParse(body);
  if (result.success) {
    return { data: result.data };
  }
  const issues = result.error.issues.map(
    (i) => `${i.path.join('.') || 'body'}: ${i.message}`
  );
  return { error: issues.join('; ') };
}
