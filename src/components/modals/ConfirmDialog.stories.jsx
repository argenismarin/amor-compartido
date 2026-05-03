import ConfirmDialog from './ConfirmDialog';

const noop = () => {};

export default {
  title: 'Modals/ConfirmDialog',
  component: ConfirmDialog,
};

export const ArchiveProject = {
  args: {
    dialog: {
      message: '¿Archivar este proyecto? Las tareas se conservan.',
      onConfirm: noop,
      onCancel: noop,
    },
  },
};

export const DeletePermanent = {
  args: {
    dialog: {
      message: '¿Eliminar "Mudanza" permanentemente? Esto borra el proyecto y todas sus tareas.',
      onConfirm: noop,
      onCancel: noop,
    },
  },
};

export const Import = {
  args: {
    dialog: {
      message: '¿Importar "amor-compartido-backup-2026-05-03.json"? Los datos se agregarán a los existentes.',
      onConfirm: noop,
      onCancel: noop,
    },
  },
};
