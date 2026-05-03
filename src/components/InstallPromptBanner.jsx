'use client';

// InstallPromptBanner — banner discreto en la parte inferior que sugiere
// instalar la PWA cuando isInstallable es true.
//
// Se muestra UNA sola vez por sesion (deferredPrompt se consume al
// primer click), y respeta dismissal por 30 dias via useInstallPrompt.
//
// Posicion: fixed bottom, encima del FAB pero por debajo de toasts,
// para no tapar el contenido principal.
export default function InstallPromptBanner({ isInstallable, onInstall, onDismiss }) {
  if (!isInstallable) return null;

  return (
    <div className="install-prompt-banner" role="region" aria-label="Sugerencia de instalación">
      <div className="install-prompt-content">
        <span className="install-prompt-emoji" aria-hidden="true">📱</span>
        <div className="install-prompt-text">
          <strong>¡Instala Amor Compartido!</strong>
          <span>Acceso rápido desde tu pantalla de inicio</span>
        </div>
      </div>
      <div className="install-prompt-actions">
        <button
          type="button"
          className="install-prompt-btn install-prompt-btn-primary"
          onClick={onInstall}
        >
          Instalar
        </button>
        <button
          type="button"
          className="install-prompt-btn install-prompt-btn-secondary"
          onClick={onDismiss}
          aria-label="Cerrar sugerencia"
        >
          ×
        </button>
      </div>
    </div>
  );
}
