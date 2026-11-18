// POST /api/auth/keluar — Hapus cookie sesi
import { hapusSesiCookie } from '@/lib/auth';
export const dynamic = 'force-dynamic';

export async function POST() {
  await hapusSesiCookie();
  return Response.json({ ok: true });
}
