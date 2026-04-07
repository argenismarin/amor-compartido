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

// YYYY-MM-DD o null
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/)
  .nullable()
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
