import { NextResponse } from 'next/server';
import { query, ensureDatabase } from '@/lib/db';

export async function GET() {
  try {
    await ensureDatabase();
    const categories = await query('SELECT * FROM AppChecklist_categories ORDER BY id');
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
