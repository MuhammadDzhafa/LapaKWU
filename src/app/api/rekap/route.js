import { svc, siapa, err, getRow, upd, rows, notif, Query } from '@/lib/server';
export const dynamic = 'force-dynamic';

// Mitra mengajukan pencairan saldo (penjualan digital dikurangi komisi) untuk satu periode.
export async function POST(req) {
  const u = await siapa(req);
  if (!u) return err('Belum masuk.', 401);
  const { id } = await req.json();
  const { db } = svc();
  const r = await getRow(db, 'rekap_penjualan', id).catch(() => null);
  if (!r || r.id_mitra !== u.$id) return err('Rekap tidak ditemukan.', 404);
  if (r.periode >= new Date().toISOString().slice(0, 7)) return err('Pencairan bisa diajukan setelah periode berakhir.');
  if (r.status_pencairan !== 'BELUM') return err('Rekap ini sudah diajukan atau dicairkan.');
  const mt = await getRow(db, 'mitra', u.$id);
  if (!mt.rekening) return err('Isi rekening pencairan di menu Profil dulu.');
  const saldo = r.total_digital - r.total_komisi;
  if (saldo <= 0) return err('Saldo periode ini nol atau negatif, jadi tidak ada yang bisa dicairkan.');
  await upd(db, 'rekap_penjualan', id, { status_pencairan: 'DIAJUKAN' });
  for (const a of await rows(db, 'admin', [Query.limit(5)])) await notif(db, a.$id, 'Pengajuan pencairan', `${mt.nama_usaha} mengajukan pencairan periode ${r.periode} sebesar Rp ${saldo.toLocaleString('id-ID')}.`, true);
  return Response.json({ ok: true });
}
