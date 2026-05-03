import { NextResponse } from 'next/server';
import { query, ensureDatabase } from '@/lib/db';
import { getBogotaDate } from '@/lib/timezone';
import { specialDateSchema, validateBody } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/rateLimit';

// Helper: Parsea una fecha de forma segura (evita problemas de zona horaria).
// Acepta:
//   - Date object (lo que devuelve pg para columnas DATE/TIMESTAMP)
//   - string ISO/YYYY-MM-DD
//   - string del Date.toString() ("Wed Jan 15 2020 00:00:00 GMT+0000")
//
// Antes: solo manejaba strings YYYY-MM-DD. Cuando pg devolvia un Date
// object para `anniversary.date`, String(d).split('T')[0] producia
// "Wed Jan 15 2020 ..." (sin T), parsearlo daba NaN, y todo el calculo
// de mesiversarioInfo (monthsTogether, daysTogether, etc.) quedaba
// invalido — lo que rompia el banner "X meses juntos".
const parseDateSafe = (dateStr) => {
  if (!dateStr) return null;
  // Caso 1: ya es Date object (pg devuelve esto para columnas DATE/TIMESTAMP).
  // Lo normalizamos a mediodia local para evitar shifts de TZ al renderizar.
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

export async function GET() {
  try {
    await ensureDatabase();
    const dates = await query(`
      SELECT sd.*, u.name as user_name
      FROM AppChecklist_special_dates sd
      LEFT JOIN AppChecklist_users u ON sd.user_id = u.id
      ORDER BY sd.date
    `);

    // Calculate mesiversario info
    const anniversary = dates.find(d => d.type === 'anniversary');
    let mesiversarioInfo = null;

    if (anniversary?.date) {
      const annivDate = parseDateSafe(anniversary.date);
      const today = getBogotaDate();

      // Calculate total days together
      const daysTogether = Math.floor((today - annivDate) / (1000 * 60 * 60 * 24));

      // Calculate months together
      const monthsTogether = (today.getFullYear() - annivDate.getFullYear()) * 12 +
                            (today.getMonth() - annivDate.getMonth());

      // Check if today is a mesiversario (same day of month)
      const isMesiversario = annivDate.getDate() === today.getDate() && monthsTogether > 0;

      // Calculate days until next mesiversario
      let nextMesiversario = new Date(today.getFullYear(), today.getMonth(), annivDate.getDate(), 12, 0, 0);
      if (nextMesiversario <= today) {
        nextMesiversario = new Date(today.getFullYear(), today.getMonth() + 1, annivDate.getDate(), 12, 0, 0);
      }
      const daysUntilNext = Math.ceil((nextMesiversario - today) / (1000 * 60 * 60 * 24));

      // Check if today is the actual anniversary (same day and month)
      const isAnniversary = annivDate.getDate() === today.getDate() &&
                           annivDate.getMonth() === today.getMonth() &&
                           today.getFullYear() > annivDate.getFullYear();
      const yearsTogether = isAnniversary ? today.getFullYear() - annivDate.getFullYear() : 0;

      mesiversarioInfo = {
        daysTogether,
        monthsTogether,
        isMesiversario,
        isAnniversary,
        yearsTogether,
        daysUntilNext: isMesiversario ? 0 : daysUntilNext,
        anniversaryDate: anniversary.date
      };
    }

    return NextResponse.json({ dates, mesiversarioInfo });
  } catch (error) {
    console.error('Error fetching special dates:', error);
    return NextResponse.json({ error: 'Failed to fetch special dates' }, { status: 500 });
  }
}

export async function POST(request) {
  const limited = enforceRateLimit(request, 'POST /api/special-dates', 20, 60_000);
  if (limited) return limited;
  try {
    await ensureDatabase();
    const body = await request.json();
    const { data, error } = validateBody(specialDateSchema, body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const { type, date, user_id, label } = data;

    // Upsert special date
    await query(`
      INSERT INTO AppChecklist_special_dates (type, date, user_id, label)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (type, user_id)
      DO UPDATE SET date = $2, label = $4
    `, [type, date, user_id || null, label || null]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving special date:', error);
    return NextResponse.json({ error: 'Failed to save special date' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await query('DELETE FROM AppChecklist_special_dates WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting special date:', error);
    return NextResponse.json({ error: 'Failed to delete special date' }, { status: 500 });
  }
}
