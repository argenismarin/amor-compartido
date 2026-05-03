'use client';

// offlineQueue — cola persistente de mutations en IndexedDB.
//
// Cuando el cliente esta offline (navigator.onLine === false), las
// mutations (POST/PUT/DELETE) se encolan aca en lugar de hacer fetch.
// Cuando vuelve online (evento 'online'), useOnlineStatus dispara
// drainQueue() que reproduce las mutations en orden.
//
// Diseño:
//   - IndexedDB tiene quirks en Safari private mode (queda bloqueado).
//     Si la apertura falla, degradamos a in-memory (volatile pero no
//     bloquea la app).
//   - Las mutations se ordenan por id (autoincrement) para preservar
//     el orden de creacion del usuario.
//   - Si una mutation falla con 4xx no retryable (excepto 408/429),
//     se descarta (probablemente body invalido o conflict).
//   - Si falla con 5xx o network error, se mantiene para retry.
//   - Cap de 100 mutations: si hay mas, las antiguas se descartan
//     (probablemente algo se rompio y mantenerlas para siempre es peor).

const DB_NAME = 'amor-compartido-offline';
const DB_VERSION = 1;
const STORE = 'mutations';

// Fallback in-memory si IndexedDB no esta disponible (Safari private)
let memoryStore = [];
let memoryNextId = 1;
let useMemoryFallback = false;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      useMemoryFallback = true;
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      useMemoryFallback = true;
      reject(req.error);
    };
  });
}

async function withStore(mode, fn) {
  if (useMemoryFallback) return fn(null);
  let db;
  try {
    db = await openDB();
  } catch {
    useMemoryFallback = true;
    return fn(null);
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result;
    try {
      result = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Encolar una mutation para reproducir cuando vuelva la conexion.
 * @returns {Promise<number>} id asignado a la mutation
 */
export async function enqueue(mutation) {
  const record = {
    method: mutation.method,
    url: mutation.url,
    body: mutation.body || null,
    headers: mutation.headers || null,
    createdAt: Date.now(),
    attempts: 0,
  };

  if (useMemoryFallback) {
    record.id = memoryNextId++;
    memoryStore.push(record);
    if (memoryStore.length > 100) memoryStore.shift();
    return record.id;
  }

  try {
    const id = await withStore('readwrite', (store) => {
      const req = store.add(record);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    });
    // Cap a 100: borrar las antiguas si crecimos demasiado
    const all = await listAll();
    if (all.length > 100) {
      const toDelete = all.slice(0, all.length - 100);
      for (const m of toDelete) await remove(m.id);
    }
    return id;
  } catch (err) {
    console.error('[offlineQueue] enqueue failed, falling back to memory:', err);
    useMemoryFallback = true;
    record.id = memoryNextId++;
    memoryStore.push(record);
    return record.id;
  }
}

export async function listAll() {
  if (useMemoryFallback) return [...memoryStore];
  try {
    return await withStore('readonly', (store) => {
      const req = store.getAll();
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  } catch {
    return [];
  }
}

export async function remove(id) {
  if (useMemoryFallback) {
    memoryStore = memoryStore.filter((m) => m.id !== id);
    return;
  }
  try {
    await withStore('readwrite', (store) => {
      store.delete(id);
    });
  } catch (err) {
    console.error('[offlineQueue] remove failed:', err);
  }
}

export async function count() {
  const all = await listAll();
  return all.length;
}

// Status codes que NO se reintentan (4xx excepto 408/429)
const NON_RETRYABLE = new Set([400, 401, 403, 404, 405, 409, 410, 422]);

/**
 * Drena la cola: reproduce todas las mutations en orden.
 * Devuelve { sent, failed, conflicts } para que el caller muestre toast.
 */
export async function drainQueue() {
  const pending = await listAll();
  pending.sort((a, b) => a.id - b.id);
  const result = { sent: 0, failed: 0, conflicts: 0 };

  for (const mut of pending) {
    try {
      const res = await fetch(mut.url, {
        method: mut.method,
        headers: mut.headers || { 'Content-Type': 'application/json' },
        body: mut.body || undefined,
      });
      if (res.ok) {
        await remove(mut.id);
        result.sent++;
      } else if (res.status === 409) {
        // Conflict: descartar, ya no es relevante reproducirlo
        await remove(mut.id);
        result.conflicts++;
      } else if (NON_RETRYABLE.has(res.status)) {
        // Error de cliente: descartar (body malformado, etc.)
        await remove(mut.id);
        result.failed++;
        console.warn('[offlineQueue] dropping non-retryable mutation:', mut, 'status:', res.status);
      } else {
        // 5xx o network: dejar para retry futuro
        result.failed++;
        break; // si el server esta caido, no insistir con las demas
      }
    } catch (err) {
      // Network error: probablemente perdimos conexion otra vez
      result.failed++;
      console.error('[offlineQueue] mutation failed during drain:', err);
      break;
    }
  }

  return result;
}
