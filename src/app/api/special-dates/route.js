import { NextResponse } from 'next/server';
import { query, queryOne, initDatabase } from '@/lib/db';

export async function GET() {
  try {
    await initDatabase();
    const dates = await query(`
      SELECT sd.*, u.name as user_name
      FROM AppChecklist_special_dates sd
      LEFT JOIN AppChecklist_users u ON sd.user_id = u.id
      ORDER BY sd.date
    `);
    return NextResponse.json(dates);
  } catch (error) {
    console.error('Error fetching special dates:', error);
    return NextResponse.json({ error: 'Failed to fetch special dates' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await initDatabase();
    const { type, date, user_id, label } = await request.json();

    if (!type || !date) {
      return NextResponse.json({ error: 'type and date are required' }, { status: 400 });
    }

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
