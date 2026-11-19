// POST /api/upload/hapus, hapus file dari Backblaze B2.
import { basename } from 'node:path';
import { siapa } from '@/lib/server';
import { hapusFile } from '@/lib/backblaze';
import { cariSatu, hapusData } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const u = await siapa(req);
    if (!u) return Response.json({ error: 'Belum masuk.' }, { status: 401 });

    const { id } = await req.json();
    if (!id) return Response.json({ error: 'ID file diperlukan.' }, { status: 400 });

    // Sanitasi: hanya ambil basename, cegah path traversal
    const namaFile = basename(id);
    if (!namaFile || namaFile.includes('/') || namaFile.includes('\\')) {
      return Response.json({ error: 'Nama file tidak valid.' }, { status: 400 });
    }

    const file = await cariSatu('unggahan_file', { _id: namaFile, id_pengguna: u.$id });
    if (!file) return Response.json({ error: 'File tidak ditemukan.' }, { status: 404 });
    const [produk, mitra, payout, bukti, pembayaran] = await Promise.all([
      cariSatu('produk', { id_gambar: namaFile }),
      cariSatu('mitra', { _id: u.$id, id_qris: namaFile }),
      cariSatu('pencairan_dompet', { id_qris: namaFile }),
      cariSatu('unggahan_bukti', { _id: namaFile, id_pembeli: u.$id }),
      cariSatu('pembayaran', { id_bukti: namaFile }),
    ]);
    const checkout = bukti ? await cariSatu('bukti_checkout', { id_bukti: namaFile }) : null;
    if (produk || mitra || payout || pembayaran || checkout) return Response.json({ error: 'File masih digunakan. Lepaskan dari produk, QRIS, atau pesanan terlebih dahulu.' }, { status: 409 });
    await hapusFile(namaFile);
    await hapusData('unggahan_file', { _id: namaFile, id_pengguna: u.$id });
    await hapusData('unggahan_bukti', { _id: namaFile, id_pembeli: u.$id }).catch(() => {});
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[/api/upload/hapus]', {
      name: e?.name,
      message: e?.message,
      code: e?.code,
      cause: e?.cause?.message,
      causeCode: e?.cause?.code,
      causeHost: e?.cause?.hostname,
      stack: e?.stack,
    });
    return Response.json({ error: 'Gagal hapus file.' }, { status: 500 });
  }
}
