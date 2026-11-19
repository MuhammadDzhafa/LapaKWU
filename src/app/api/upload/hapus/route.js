// POST /api/upload/hapus, hapus file dari Backblaze B2.
import { basename } from 'node:path';
import { siapa } from '@/lib/server';
import { hapusFile } from '@/lib/backblaze';
import { cariSatu } from '@/lib/db';
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

    const produk = await cariSatu('produk', { id_gambar: namaFile, id_mitra: u.$id });
    if (!produk) return Response.json({ error: 'File tidak ditemukan.' }, { status: 404 });
    await hapusFile(namaFile);
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
