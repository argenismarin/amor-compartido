// Tipos de las filas que devuelve PostgreSQL via pg driver.
// Mapean 1:1 con las columnas de cada tabla AppChecklist_*.
// Las columnas TIMESTAMPTZ las declaramos como string (ISO) porque
// el driver pg las serializa asi por defecto.

export type Priority = 'low' | 'medium' | 'high';
export type Recurrence = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface UserRow {
  id: number;
  name: string;
  avatar_emoji: string;
  created_at: string;
}

export interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  assigned_to: number;
  assigned_by: number;
  is_completed: boolean;
  completed_at: string | null;
  due_date: string | null;
  priority: Priority;
  reaction: string | null;
  category_id: number | null;
  project_id: number | null;
  recurrence: Recurrence | null;
  recurrence_days: string | null;
  is_shared: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubtaskRow {
  id: number;
  task_id: number;
  title: string;
  is_completed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: number;
  name: string;
  description: string | null;
  emoji: string;
  color: string;
  due_date: string | null;
  is_archived: boolean;
  total_tasks: number;
  completed_tasks: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: number;
  name: string;
  emoji: string;
  color: string;
  created_at: string;
}

export interface StreakRow {
  id: number;
  user_id: number;
  current_streak: number;
  best_streak: number;
  last_activity: string | null;
  updated_at: string;
}

export interface AchievementRow {
  id: number;
  name: string;
  description: string;
  emoji: string;
  condition_type: string;
  condition_value: number;
  created_at: string;
}

export interface UserAchievementRow {
  id: number;
  user_id: number;
  achievement_id: number;
  unlocked_at: string;
}

export interface SpecialDateRow {
  id: number;
  type: string;
  date: string;
  user_id: number | null;
  label: string | null;
  created_at: string;
}

export interface CommentRow {
  id: number;
  task_id: number;
  author_id: number;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityRow {
  id: number;
  actor_id: number | null;
  action: string;
  target_type: string;
  target_id: number | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface PushSubscriptionRow {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

// Tipos enriquecidos que devuelven los GETs (con JOINs)
export interface TaskWithRelations extends TaskRow {
  assigned_to_name?: string;
  assigned_to_avatar?: string;
  assigned_by_name?: string;
  assigned_by_avatar?: string;
  category_name?: string | null;
  category_emoji?: string | null;
  category_color?: string | null;
  project_name?: string | null;
  project_emoji?: string | null;
  project_color?: string | null;
  subtasks?: SubtaskRow[];
}

export interface CommentWithAuthor extends CommentRow {
  author_name: string;
  author_avatar: string;
}

export interface ActivityWithActor extends ActivityRow {
  actor_name: string | null;
  actor_avatar: string | null;
}
