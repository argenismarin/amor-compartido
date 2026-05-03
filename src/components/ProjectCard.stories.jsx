import ProjectCard from './ProjectCard';

const noop = () => {};

export default {
  title: 'Components/ProjectCard',
  component: ProjectCard,
  args: { onSelect: noop, onEdit: noop, onDelete: noop },
};

export const Empty = {
  args: {
    project: {
      id: 1,
      name: 'Mudanza',
      description: '',
      emoji: '🏠',
      color: '#f97316',
      due_date: null,
      total_tasks: 0,
      completed_tasks: 0,
    },
  },
};

export const InProgress = {
  args: {
    project: {
      id: 2,
      name: 'Plan de viaje a Cartagena',
      description: 'Vuelos, hotel, paseos, restaurantes',
      emoji: '✈️',
      color: '#06b6d4',
      due_date: '2026-07-15',
      total_tasks: 8,
      completed_tasks: 3,
    },
  },
};

export const Completed = {
  args: {
    project: {
      id: 3,
      name: 'Decoración cuarto',
      description: 'Listo!',
      emoji: '🎨',
      color: '#ec4899',
      due_date: '2026-04-30',
      total_tasks: 5,
      completed_tasks: 5,
    },
  },
};

export const LongName = {
  args: {
    project: {
      id: 4,
      name: 'Proyecto con un nombre extremadamente largo que debería truncarse con ellipsis en la card',
      description: 'Y una descripción que también es bastante larga para verificar el line-clamp de 2 líneas que aplicamos en CSS',
      emoji: '📚',
      color: '#8b5cf6',
      due_date: null,
      total_tasks: 12,
      completed_tasks: 4,
    },
  },
};

export const NoEmoji = {
  args: {
    project: {
      id: 5,
      name: 'Proyecto antiguo',
      description: 'Importado de backup sin emoji',
      emoji: null,
      color: '#6366f1',
      due_date: null,
      total_tasks: 3,
      completed_tasks: 1,
    },
  },
};
