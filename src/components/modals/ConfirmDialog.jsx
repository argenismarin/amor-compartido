import useFocusTrap from '@/hooks/useFocusTrap';

// Dialog modal de confirmación con acciones Cancelar/Eliminar.
// Escape dispara onCancel (equivale a "Cancelar").
//
// El caller debe renderizarlo condicionalmente: {dialog && <ConfirmDialog dialog={dialog} />}
//
// Props:
// - dialog: { message, onConfirm, onCancel }
export default function ConfirmDialog({ dialog }) {
  const containerRef = useFocusTrap(dialog.onCancel);

  return (
    <div className="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="confirm-dialog" ref={containerRef}>
        <p id="confirm-title" className="confirm-message">{dialog.message}</p>
        <div className="confirm-actions">
          <button
            className="confirm-btn confirm-btn-cancel"
            onClick={dialog.onCancel}
          >
            Cancelar
          </button>
          <button
            className="confirm-btn confirm-btn-delete"
            onClick={dialog.onConfirm}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
