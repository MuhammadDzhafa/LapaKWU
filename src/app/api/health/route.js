import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await (await getDatabase()).query('SELECT 1');
    return Response.json({ ok: true, database: 'available' });
  } catch {
    return Response.json({ ok: false, database: 'unavailable' }, { status: 503 });
  }
}
