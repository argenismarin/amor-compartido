// Helpers de fecha y zona horaria. Toda la app vive en Bogotá (UTC-5).
//
// Estos helpers manejan dos casos delicados:
// - getTodayString / addDaysToToday: trabajar con "hoy" según Bogotá, sin
//   importar dónde corra el cliente
// - parseDateSafe: parsear fechas YYYY-MM-DD evitando shifts de zona horaria
//   (el problema clásico de "new Date('2024-01-15')" que devuelve 14 en
//   timezones negativos)

export const TIMEZONE = 'America/Bogota';

// Devuelve la fecha/hora actual en zona horaria de Bogotá
export const getBogotaDate = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
};

// Formatea una fecha como YYYY-MM-DD
export const toDateString = (date) =>
  date.getFullYear() + '-' +
  String(date.getMonth() + 1).padStart(2, '0') + '-' +
  String(date.getDate()).padStart(2, '0');

// Devuelve la fecha de hoy en formato YYYY-MM-DD (Bogotá)
export const getTodayString = () => toDateString(getBogotaDate());

// Devuelve una fecha relativa a hoy (Bogotá) en formato YYYY-MM-DD
export const addDaysToToday = (days) => {
  const d = getBogotaDate();
  d.setDate(d.getDate() + days);
  return toDateString(d);
};

// Parsea una fecha ISO/DATE evitando el problema de zona horaria.
// Para fechas tipo "2024-01-15" o "2024-01-15T00:00:00", extrae los
// componentes directamente y crea la fecha al mediodía local.
export const parseDateSafe = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr);
  const datePart = str.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

// Formatea una fecha para mostrar (sin hora)
export const formatDateDisplay = (dateStr, options = { day: 'numeric', month: 'short' }) => {
  const date = parseDateSafe(dateStr);
  if (!date) return '';
  return date.toLocaleDateString('es-CO', options);
};

// Formatea una fecha con hora para mostrar.
//
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ⚠️  FIX COMPENSATORIO — REVERTIR JUNTO AL FIX DE RAÍZ  ⚠️        ║
// ║                                                                  ║
// ║  Hay un bug en el helper server-side `getBogotaDate()` de        ║
// ║  `src/lib/timezone.js`: cuando corre en Vercel (TZ=UTC), produce ║
// ║  un Date object desplazado -5 horas vs el momento real. Ese      ║
// ║  valor se guarda en `completed_at` vía pg driver, así que la DB  ║
// ║  tiene todos los timestamps "pretend-UTC" pero representando     ║
// ║  hora Bogotá. Las queries SQL sobre el valor crudo funcionan     ║
// ║  por accidente (el mismo shift aplica en INSERT y SELECT), pero  ║
// ║  si convertimos explícitamente con `timeZone: 'America/Bogota'`  ║
// ║  acá, restamos 5 horas extra y mostramos 05:31 am para una       ║
// ║  tarea completada a las 10:31 am.                                ║
// ║                                                                  ║
// ║  Esta función compensa el bug: interpreta el ISO como "ya está   ║
// ║  en hora Bogotá" ignorando el Z, parsea como local y formatea    ║
// ║  sin timeZone option. Para un cliente en Colombia muestra la     ║
// ║  hora real; para clientes en otra zona muestra la misma hora     ║
// ║  Bogotá sin reinterpretar.                                       ║
// ║                                                                  ║
// ║  FIX DE RAÍZ PENDIENTE: migrar columna a TIMESTAMPTZ + usar      ║
// ║  NOW() en inserts + AT TIME ZONE 'America/Bogota' en selects +   ║
// ║  migración de datos históricos. Cuando se haga, REVERTIR esta    ║
// ║  función a su versión original (usar { timeZone: TIMEZONE } en   ║
// ║  toLocaleString) y BUSCAR TODO:TIMEZONE-FIX-ROOT en el repo.     ║
// ╚══════════════════════════════════════════════════════════════════╝
// TODO:TIMEZONE-FIX-ROOT — ver bloque arriba
export const formatDateTimeDisplay = (
  dateStr,
  options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
) => {
  if (!dateStr) return '';
  // Quitar milisegundos y marca Z; el resto del string queda como
  // "YYYY-MM-DDTHH:MM:SS" que `new Date()` interpretará como local.
  const str = String(dateStr).replace(/\.\d+/, '').replace(/Z$/, '');
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return '';
  // Sin timeZone option — dejamos que el navegador use el local del
  // cliente. Como el string ya está "en Bogotá", el resultado refleja
  // la hora real de completado.
  return date.toLocaleString('es-CO', options);
};
