import { cariSatu } from '@/lib/db';
import { siapa, err } from '@/lib/server';
import { FORMAT_ID_BUKTI } from '@/lib/bukti-pembayaran';
import { unduhFile } from '@/lib/backblaze';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const u = await siapa(req);
  if (!u) return err('Belum masuk.', 401);
  const { id } = await params;
  if (!FORMAT_ID_BUKTI.test(id)) return err('Bukti tidak ditemukan.', 404);
  const upload = await cariSatu('unggahan_bukti', { _id: id });
  if (!upload) return err('Bukti tidak ditemukan.', 404);
  if (upload.id_pembeli !== u.$id) {
    const [admin, mitra] = await Promise.all([cariSatu('admin', { _id: u.$id }), cariSatu('mitra', { _id: u.$id })]);
    if (!admin || mitra) return err('Bukti tidak ditemukan.', 404);
  }
  const buffer = await unduhFile(id).catch(() => null);
  if (!buffer) return err('Bukti tidak ditemukan.', 404);
  const ext = id.split('.').at(-1);
  return new Response(buffer, {
    headers: { 'Content-Type': ext === 'jpg' ? 'image/jpeg' : 'image/' + ext, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
