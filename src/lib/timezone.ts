// Helpers de zona horaria del lado servidor.
//
// Toda la lógica server-side de la app vive en zona horaria de Bogotá
// (Colombia, UTC-5). Esto es importante para "hoy", "ayer", streaks y
// agregaciones por día — sin esto, una tarea completada a las 11pm Bogotá
// podría contar para el día siguiente si el server corre en UTC.
//
// El frontend tiene helpers similares en src/lib/dates.ts.

export const TIMEZONE = 'America/Bogota';

// Obtiene la fecha/hora actual en zona horaria de Bogotá
export const getBogotaDate = (): Date => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
};

// Formatea una fecha como YYYY-MM-DD
const formatYmd = (date: Date): string =>
  date.getFullYear() + '-' +
  String(date.getMonth() + 1).padStart(2, '0') + '-' +
  String(date.getDate()).padStart(2, '0');

// Devuelve la fecha de hoy en formato YYYY-MM-DD (Bogotá)
export const getTodayBogota = (): string => formatYmd(getBogotaDate());

// Devuelve la fecha de ayer en formato YYYY-MM-DD (Bogotá)
export const getYesterdayBogota = (): string => {
  const bogota = getBogotaDate();
  bogota.setDate(bogota.getDate() - 1);
  return formatYmd(bogota);
};
