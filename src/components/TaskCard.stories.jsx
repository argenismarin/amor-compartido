import TaskCard from './TaskCard';

const baseTask = {
  id: 1,
  title: 'Comprar las flores',
  description: 'Las amarillas que le gustan a ella',
  assigned_to: 1,
  assigned_by: 2,
  is_completed: false,
  due_date: '2026-05-20',
  priority: 'medium',
  reaction: null,
  category_id: 4,
  category_name: 'Juntos',
  category_emoji: '💑',
  category_color: '#9C27B0',
  recurrence: null,
  is_shared: false,
  assigned_by_name: 'Argenis',
  subtasks: [],
};

const REACTIONS = ['❤️', '😍', '🥰', '👏', '🎉', '🔥'];

const noop = () => {};

export default {
  title: 'Components/TaskCard',
  component: TaskCard,
  args: {
    onToggle: noop,
    onEdit: noop,
    onDelete: noop,
    onReaction: noop,
    onSubtaskAdd: noop,
    onSubtaskToggle: noop,
    onSubtaskDelete: noop,
    onSubtaskReorder: noop,
    showAssignedBy: true,
    currentUserId: 1,
    reactionEmojis: REACTIONS,
    togglingTaskId: null,
  },
};

export const Pending = {
  args: { task: baseTask, assignedByName: 'Argenis' },
};

export const Completed = {
  args: {
    task: { ...baseTask, is_completed: true, completed_at: new Date().toISOString() },
    assignedByName: 'Argenis',
  },
};

export const HighPriority = {
  args: {
    task: { ...baseTask, priority: 'high', title: 'URGENTE: pagar factura del gas' },
    assignedByName: 'Argenis',
  },
};

export const Shared = {
  args: {
    task: { ...baseTask, is_shared: true, title: 'Limpiar el apartamento' },
    assignedByName: 'Jenifer',
  },
};

export const WithSubtasks = {
  args: {
    task: {
      ...baseTask,
      title: 'Plan del fin de semana',
      subtasks: [
        { id: 10, title: 'Reservar restaurante', is_completed: true, sort_order: 1 },
        { id: 11, title: 'Comprar entradas cine', is_completed: true, sort_order: 2 },
        { id: 12, title: 'Llamar a los papás', is_completed: false, sort_order: 3 },
        { id: 13, title: 'Pasear al perro', is_completed: false, sort_order: 4 },
      ],
    },
    assignedByName: 'Argenis',
  },
};

export const WithReaction = {
  args: {
    task: {
      ...baseTask,
      is_completed: true,
      completed_at: new Date().toISOString(),
      reaction: '🥰',
    },
    assignedByName: 'Argenis',
  },
};

export const Recurring = {
  args: {
    task: {
      ...baseTask,
      title: 'Sacar la basura',
      recurrence: 'weekly',
      due_date: null,
    },
    assignedByName: 'Argenis',
  },
};

export const Toggling = {
  args: {
    task: baseTask,
    assignedByName: 'Argenis',
    togglingTaskId: baseTask.id,
  },
};
