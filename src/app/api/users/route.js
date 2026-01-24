import { NextResponse } from 'next/server';
import { query, initDatabase } from '@/lib/db';

export async function GET() {
  try {
    await initDatabase();
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
      'UPDATE AppChecklist_users SET name = ?, avatar_emoji = ? WHERE id = ?',
      [name, avatar_emoji, id]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
