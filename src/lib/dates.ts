// Helpers de fecha y zona horaria. Toda la app vive en Bogotá (UTC-5).
//
// Estos helpers manejan dos casos delicados:
// - getTodayString / addDaysToToday: trabajar con "hoy" según Bogotá, sin
//   importar dónde corra el cliente
// - parseDateSafe: parsear fechas YYYY-MM-DD evitando shifts de zona horaria
//   (el problema clásico de "new Date('2024-01-15')" que devuelve 14 en
//   timezones negativos)

export const TIMEZONE = 'America/Bogota';

type DateInput = string | Date | null | undefined;

// Devuelve la fecha/hora actual en zona horaria de Bogotá
export const getBogotaDate = (): Date => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
};

// Formatea una fecha como YYYY-MM-DD
export const toDateString = (date: Date): string =>
  date.getFullYear() + '-' +
  String(date.getMonth() + 1).padStart(2, '0') + '-' +
  String(date.getDate()).padStart(2, '0');

// Devuelve la fecha de hoy en formato YYYY-MM-DD (Bogotá)
export const getTodayString = (): string => toDateString(getBogotaDate());

// Devuelve una fecha relativa a hoy (Bogotá) en formato YYYY-MM-DD
export const addDaysToToday = (days: number): string => {
  const d = getBogotaDate();
  d.setDate(d.getDate() + days);
  return toDateString(d);
};

// Parsea una fecha ISO/DATE evitando el problema de zona horaria.
// Acepta:
//   - Date object (lo que devuelve pg para columnas DATE/TIMESTAMP en server-side)
//   - string ISO/YYYY-MM-DD
//
// Antes: solo manejaba strings YYYY-MM-DD. Cuando se pasaba un Date
// (ej: anniversary.date deserializada por pg), String(d).split('T')[0]
// producia "Wed Jan 15 2020 ..." (sin T), y el parseo resultaba en NaN
// — rompiendo formatDateDisplay y los calculos de mesiversario.
export const parseDateSafe = (dateStr: DateInput): Date | null => {
  if (!dateStr) return null;
  // Caso 1: ya es Date object → normalizar a mediodia local
  if (dateStr instanceof Date) {
    if (Number.isNaN(dateStr.getTime())) return null;
    return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate(), 12, 0, 0);
  }
  // Caso 2: string ISO o YYYY-MM-DD
  const str = String(dateStr);
  const datePart = str.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return null;
  const [year, month, day] = parts.map(Number);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
};

// Formatea una fecha para mostrar (sin hora)
export const formatDateDisplay = (
  dateStr: DateInput,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
): string => {
  const date = parseDateSafe(dateStr);
  if (!date) return '';
  return date.toLocaleDateString('es-CO', options);
};

// Formatea una fecha con hora para mostrar.
//
// Tras la migracion C7 a TIMESTAMPTZ (ver src/lib/db.ts), las columnas
// timestamp guardan correctamente el momento UTC absoluto. Aca usamos
// timeZone: 'America/Bogota' explicitamente para mostrarlo siempre en
// hora Bogota independiente del browser del cliente.
export const formatDateTimeDisplay = (
  dateStr: DateInput,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }
): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr as string);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-CO', { ...options, timeZone: TIMEZONE });
};
