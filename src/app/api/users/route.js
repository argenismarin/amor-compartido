import { NextResponse } from 'next/server';
import { query, ensureDatabase } from '@/lib/db';

export async function GET() {
  try {
    await ensureDatabase();
    const users = await query('SELECT * FROM AppChecklist_users ORDER BY id');
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, name, avatar_emoji } = await request.json();
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
