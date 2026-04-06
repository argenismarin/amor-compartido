// Toast notification flotante. Soporta acción opcional (botón Deshacer).
//
// Props:
// - toast: { message, type: 'success'|'error'|'info', action?: { label, onClick } }
// - onDismiss: cierra el toast (cancela el timer también)
export default function Toast({ toast, onDismiss }) {
  if (!toast) return null;

  return (
    <div
      className={`toast toast-${toast.type}`}
      role="alert"
      aria-live="polite"
      style={{ '--toast-fade-delay': toast.action ? '6.7s' : '2.7s' }}
    >
      <span className="toast-icon">
        {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
      </span>
      <span className="toast-message">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.action.onClick();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
