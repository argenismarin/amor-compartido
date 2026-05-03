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
// Tras la migracion C7 a TIMESTAMPTZ (ver src/lib/db.js), las columnas
// timestamp guardan correctamente el momento UTC absoluto. Aca usamos
// timeZone: 'America/Bogota' explicitamente para mostrarlo siempre en
// hora Bogota independiente del browser del cliente.
export const formatDateTimeDisplay = (
  dateStr,
  options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-CO', { ...options, timeZone: TIMEZONE });
};
