import { NextResponse } from 'next/server';
import { ensureDatabase } from '@/lib/db';
import { getSpacesForUser, createSpace } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rateLimit';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/schemas';

// GET /api/spaces?userId=N — lista los spaces del usuario.
//
// Modo legacy (sin auth): el cliente pasa ?userId=N (mismo patron que
// el resto de los GETs hoy). Cuando se active auth real, este endpoint
// va a leer el userId desde la session en vez del query.
export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '0', 10);
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }
    const spaces = await getSpacesForUser(userId);
    return NextResponse.json({ spaces });
  } catch (err) {
    console.error('Error fetching spaces:', err);
    return NextResponse.json({ error: 'Failed to fetch spaces' }, { status: 500 });
  }
}

const createSpaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  created_by: z.number().int().positive(),
});

// POST /api/spaces — crear nuevo space (el creador queda como admin).
export async function POST(request) {
  const limited = enforceRateLimit(request, 'POST /api/spaces', 10, 60_000);
  if (limited) return limited;
  try {
    await ensureDatabase();
    const body = await request.json();
    const { data, error } = validateBody(createSpaceSchema, body);
    if (error) return NextResponse.json({ error }, { status: 400 });
    const space = await createSpace(data.name, data.created_by);
    return NextResponse.json({ success: true, space });
  } catch (err) {
    console.error('Error creating space:', err);
    return NextResponse.json({ error: 'Failed to create space' }, { status: 500 });
  }
}
