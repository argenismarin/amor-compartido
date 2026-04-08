// Wrapper client-side para fetchs que esperan JSON.
//
// Contexto: muchos GETs del cliente (fetchTasks, fetchProjects,
// fetchCategories...) hacían el patrón ingenuo:
//
//   const res = await fetch(url);
//   const data = await res.json();
//   setState(data);
//
// El problema: si el server devuelve 500 con `{ error: "..." }`, ese
// objeto termina llegando a setState y la UI queda en un estado raro
// (ej: una lista con { error: "..." } en vez de un array), o el catch
// atrapa el error de render sin contexto sobre qué salió mal.
//
// fetchJson centraliza la verificación: si !res.ok, tira un Error con
// el mensaje del server (cuando viene en el body) para que el catch
// del caller pueda loggearlo y mostrar un toast útil.

/**
 * Hace un fetch y devuelve el JSON parseado. Tira un Error si el
 * status no está en el rango 2xx.
 *
 * @param {string} url — endpoint (relativo o absoluto)
 * @param {RequestInit} [init] — opciones estándar de fetch
 * @returns {Promise<unknown>} — body JSON parseado
 * @throws {Error} con propiedad `.status` si el server respondió !ok
 */
export async function fetchJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    // Intentamos extraer el mensaje del server; si no es JSON, tomamos
    // el texto crudo. El status code va como propiedad del Error para
    // que callers puedan diferenciar 409 conflict de 500 server error.
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body.error === 'string') {
        message = `${message}: ${body.error}`;
      }
    } catch {
      try {
        const text = await res.text();
        if (text) message = `${message}: ${text.slice(0, 200)}`;
      } catch {
        // no-op: si ni json ni text funcionan, nos quedamos con el HTTP N
      }
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
