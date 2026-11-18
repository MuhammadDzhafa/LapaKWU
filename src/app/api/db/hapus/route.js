// POST /api/db/hapus — Delete row (hanya item_keranjang milik user)
import { del, getRow, siapa } from '@/lib/server';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { tabel, id } = await req.json();
    if (!['item_keranjang'].includes(tabel)) return Response.json({ error: 'Operasi tidak diizinkan.' }, { status: 403 });
    const u = await siapa(req);
    if (!u) return Response.json({ error: 'Belum masuk.' }, { status: 401 });
    // Validasi item milik user ini
    const item = await getRow(null, tabel, id).catch(() => null);
    if (!item || item.id_keranjang !== u.$id) return Response.json({ error: 'Item tidak ditemukan.' }, { status: 404 });
    await del(null, tabel, id);
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[/api/db/hapus]', e?.message);
    return Response.json({ error: 'Gagal hapus data.' }, { status: 500 });
  }
}
