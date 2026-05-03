'use client';

// Error boundary global para la app. Cuando un error no capturado
// burbujea hasta aqui, mostramos un fallback amigable en lugar del
// pantallazo en blanco / "Application error" generico.
//
// Sentry captura el error automaticamente via @sentry/nextjs.
// Ver https://nextjs.org/docs/app/api-reference/file-conventions/error
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // Reportar a Sentry (idempotente — Sentry deduplica por fingerprint)
    if (error) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <div className="error-boundary" role="alert">
      <div className="error-boundary-content">
        <span className="error-boundary-emoji" aria-hidden="true">💔</span>
        <h2 className="error-boundary-title">Algo salió mal</h2>
        <p className="error-boundary-message">
          Hubo un problema cargando esta sección. El error fue reportado
          y vamos a revisarlo.
        </p>
        {error?.message && (
          <details className="error-boundary-details">
            <summary>Detalles técnicos</summary>
            <code>{error.message}</code>
            {error.digest && <code>id: {error.digest}</code>}
          </details>
        )}
        <button
          type="button"
          className="submit-btn"
          onClick={() => reset()}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
