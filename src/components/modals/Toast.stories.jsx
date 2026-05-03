import Toast from './Toast';

const noop = () => {};

export default {
  title: 'Modals/Toast',
  component: Toast,
  args: { onDismiss: noop, onPause: noop, onResume: noop },
};

export const Success = {
  args: { toast: { message: 'Tarea creada 💕', type: 'success' } },
};

export const Error = {
  args: { toast: { message: 'Error al guardar la tarea', type: 'error' } },
};

export const Info = {
  args: {
    toast: {
      message: 'Tu pareja editó esta tarea, refrescamos los cambios',
      type: 'info',
    },
  },
};

export const WithAction = {
  args: {
    toast: {
      message: 'Tarea eliminada',
      type: 'success',
      action: { label: 'Deshacer', onClick: noop },
    },
  },
};
