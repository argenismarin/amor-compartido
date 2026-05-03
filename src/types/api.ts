// Shapes de request/response para los endpoints API. Derivados de
// los esquemas zod cuando aplica (single source of truth).

import { z } from 'zod';
import {
  createTaskSchema,
  updateTaskSchema,
  toggleTaskSchema,
  reactionTaskSchema,
  createProjectSchema,
  updateProjectSchema,
  createSubtaskSchema,
  updateSubtaskSchema,
  toggleSubtaskSchema,
  createCommentSchema,
  specialDateSchema,
  updateUserSchema,
  importPayloadSchema,
  subscribeSchema,
} from '@/lib/validation/schemas';

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ToggleTaskInput = z.infer<typeof toggleTaskSchema>;
export type ReactionTaskInput = z.infer<typeof reactionTaskSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>;
export type UpdateSubtaskInput = z.infer<typeof updateSubtaskSchema>;
export type ToggleSubtaskInput = z.infer<typeof toggleSubtaskSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type SpecialDateInput = z.infer<typeof specialDateSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ImportPayload = z.infer<typeof importPayloadSchema>;
export type SubscribeInput = z.infer<typeof subscribeSchema>;

// Common response shapes
export interface SuccessResponse {
  success: true;
}
export interface SuccessWithIdResponse extends SuccessResponse {
  id: number;
}
export interface ErrorResponse {
  error: string;
  message?: string;
}
export interface ConflictResponse extends ErrorResponse {
  error: 'conflict';
  current: unknown;
}
