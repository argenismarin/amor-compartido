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

// Status codes que se reintentan automaticamente. Errores de red
// (fetch throws TypeError) tambien. Status como 4xx (excepto 408/429)
// se consideran problemas del cliente y NO se reintentan.
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Hace un fetch y devuelve el JSON parseado. Tira un Error si el
 * status no está en el rango 2xx.
 *
 * Reintenta automáticamente errores transitorios (network errors,
 * 408/429/5xx) hasta `retries` veces con backoff exponencial. Para
 * mutaciones no idempotentes pasar `{ retries: 0 }` para desactivar.
 *
 * @param {string} url — endpoint (relativo o absoluto)
 * @param {RequestInit & { retries?: number, retryBaseMs?: number }} [init] — opciones de fetch + retry
 * @returns {Promise<unknown>} — body JSON parseado
 * @throws {Error} con propiedad `.status` si el server respondió !ok después de los retries
 */
export async function fetchJson(url, init = {}) {
  const { retries = 2, retryBaseMs = 400, ...fetchInit } = init;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, fetchInit);
      if (res.ok) return res.json();

      // Status no-OK: extraer mensaje y decidir si reintentar.
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
          // no-op
        }
      }
      const err = new Error(message);
      err.status = res.status;

      // Status no-retryable (4xx que no es 408/429): tirar inmediatamente.
      if (!RETRYABLE_STATUS.has(res.status) || attempt === retries) {
        throw err;
      }
      lastError = err;
    } catch (err) {
      // Si ya tiramos err con .status arriba, propagar.
      if (err.status && !RETRYABLE_STATUS.has(err.status)) throw err;
      // Network error (TypeError de fetch) o status retryable agotado.
      lastError = err;
      if (attempt === retries) throw err;
    }
    // Backoff exponencial: 400ms, 800ms, 1600ms... + jitter +-25%
    const base = retryBaseMs * Math.pow(2, attempt);
    const jitter = base * (0.75 + Math.random() * 0.5);
    await new Promise((r) => setTimeout(r, jitter));
  }

  throw lastError;
}
