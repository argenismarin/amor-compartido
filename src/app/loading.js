// Loading UI mostrada por Next mientras la pagina hidrata.
// Ver https://nextjs.org/docs/app/api-reference/file-conventions/loading
//
// Antes el primer paint mostraba un blank y el browser se quedaba sin
// nada que mostrar. Ahora muestra el mismo spinner que page.js usa
// internamente, asi la transicion es invisible.
export default function Loading() {
  return (
    <div className="loading" style={{ height: '100vh' }}>
      <div className="loading-spinner" aria-label="Cargando" />
    </div>
  );
}
