// Dialog modal de confirmación con acciones Cancelar/Eliminar.
//
// Props:
// - dialog: { message, onConfirm, onCancel } o null
export default function ConfirmDialog({ dialog }) {
  if (!dialog) return null;

  return (
    <div className="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="confirm-dialog">
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
