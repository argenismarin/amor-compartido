import { NextResponse } from 'next/server';
import { query, queryOne, ensureDatabase } from '@/lib/db';

export async function POST(request) {
  try {
    await ensureDatabase();
    const { userId, subscription } = await request.json();

    if (!userId || !subscription) {
      return NextResponse.json(
        { error: 'userId and subscription are required' },
        { status: 400 }
      );
    }

    const { endpoint, keys } = subscription;
    const { p256dh, auth } = keys;

    // Upsert subscription
    await query(`
      INSERT INTO AppChecklist_push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (endpoint)
      DO UPDATE SET user_id = $1, p256dh = $3, auth = $4
    `, [userId, endpoint, p256dh, auth]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving subscription:', error);
    return NextResponse.json(
      { error: 'Failed to save subscription' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json(
        { error: 'endpoint is required' },
        { status: 400 }
      );
    }

    await query(
      'DELETE FROM AppChecklist_push_subscriptions WHERE endpoint = $1',
      [endpoint]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    return NextResponse.json(
      { error: 'Failed to delete subscription' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      const subscriptions = await query(
        'SELECT * FROM AppChecklist_push_subscriptions WHERE user_id = $1',
        [userId]
      );
      return NextResponse.json(subscriptions);
    }

    const allSubscriptions = await query(
      'SELECT * FROM AppChecklist_push_subscriptions'
    );
    return NextResponse.json(allSubscriptions);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}
