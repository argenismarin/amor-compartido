import { NextResponse } from 'next/server';
import { query, ensureDatabase } from '@/lib/db';
import { updateUserSchema, validateBody } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/rateLimit';

export async function GET() {
  try {
    await ensureDatabase();
    // Listar columnas explícitas: si en el futuro se agrega una columna
    // sensible (password_hash, email, etc.) no se filtra al cliente.
    const users = await query(
      'SELECT id, name, avatar_emoji FROM AppChecklist_users ORDER BY id'
    );
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function PUT(request) {
  const limited = enforceRateLimit(request, 'PUT /api/users', 20, 60_000);
  if (limited) return limited;
  try {
    const body = await request.json();
    const { data, error } = validateBody(updateUserSchema, body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const { id, name, avatar_emoji } = data;
    await query(
      'UPDATE AppChecklist_users SET name = $1, avatar_emoji = $2 WHERE id = $3',
      [name, avatar_emoji, id]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
