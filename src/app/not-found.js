import Link from 'next/link';

// /404 personalizada. Antes Next mostraba la default verbose pagina
// de 404; ahora es coherente con el branding de la app.
export const metadata = {
  title: 'Página no encontrada · Amor Compartido',
};

export default function NotFound() {
  return (
    <div className="error-boundary" role="alert">
      <div className="error-boundary-content">
        <span className="error-boundary-emoji" aria-hidden="true">🔎</span>
        <h2 className="error-boundary-title">No encontramos esta página</h2>
        <p className="error-boundary-message">
          Quizás el link es viejo o la tarea/proyecto fue eliminado.
        </p>
        <Link href="/" className="submit-btn" style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
