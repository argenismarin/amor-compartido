// Toast notification flotante. Soporta acción opcional (botón Deshacer),
// botón X de cierre manual y pausa del auto-dismiss mientras el cursor
// está encima.
//
// Props:
// - toast: { message, type: 'success'|'error'|'info', action?: { label, onClick } }
// - onDismiss: cierra el toast (usa el botón X)
// - onPause, onResume: handlers de pausa del timer (hover)
export default function Toast({ toast, onDismiss, onPause, onResume }) {
  if (!toast) return null;

  return (
    <div
      className={`toast toast-${toast.type}`}
      role="alert"
      aria-live="polite"
      style={{ '--toast-fade-delay': toast.action ? '6.7s' : '2.7s' }}
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocus={onPause}
      onBlur={onResume}
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
      <button
        type="button"
        className="toast-close"
        onClick={onDismiss}
        aria-label="Cerrar notificación"
      >
        ×
      </button>
    </div>
  );
}
