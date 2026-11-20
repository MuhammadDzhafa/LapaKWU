// POST /api/upload, upload gambar produk, QRIS, atau bukti bayar ke Backblaze B2.
import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import { siapa } from '@/lib/server';
import { MAKS_BUKTI_PEMBAYARAN, PESAN_UKURAN_BUKTI } from '@/lib/bukti-pembayaran';
import { tulis, denganTransaksi, queryDatabase } from '@/lib/db';
import { hapusFile, unggahFile } from '@/lib/backblaze';
export const dynamic = 'force-dynamic';

const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const MAKS_UNGGAHAN_24_JAM = 20;

async function simpanFile(uploaderId, nama, buffer, jenis, contentType, simpanTambahan) {
  let tersimpanDiB2 = false;
  try {
    return await denganTransaksi(async () => {
      await queryDatabase('SELECT pg_advisory_xact_lock(hashtext($1))', [uploaderId]);
      const { rows: [hitung] } = await queryDatabase(
        "SELECT COUNT(*)::int AS jumlah FROM unggahan_file WHERE id_pengguna = $1 AND created_at > NOW() - INTERVAL '24 hours'",
        [uploaderId]
      );
      if (hitung.jumlah >= MAKS_UNGGAHAN_24_JAM) return false;
      await unggahFile(nama, buffer, contentType);
      tersimpanDiB2 = true;
      await tulis('unggahan_file', nama, { id_pengguna: uploaderId, ukuran: buffer.length, jenis });
      if (simpanTambahan) await simpanTambahan();
      return true;
    });
  } catch (error) {
    if (tersimpanDiB2) await hapusFile(nama).catch(() => {});
    throw error;
  }
}
export async function POST(req) {
  try {
    const u = await siapa(req);
    if (!u) return Response.json({ error: 'Sesi login tidak valid. Silakan masuk kembali.' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file');
    const buktiPembayaran = form.get('jenis') === 'bukti-pembayaran';

    if (!file || typeof file === 'string' || !(file instanceof Blob)) {
      return Response.json({ error: 'File gambar tidak ditemukan atau tidak valid.' }, { status: 400 });
    }

    const extFromName = file.name ? file.name.split('.').pop()?.toLowerCase() : '';
    const isMimeOk = ALLOWED_MIME.includes(file.type?.toLowerCase());
    const isExtOk = ALLOWED_EXT.includes(extFromName);

    if (!isMimeOk && !isExtOk) {
      return Response.json({ error: 'Format file harus berupa gambar (JPG, PNG, atau WebP).' }, { status: 400 });
    }

    if (file.size > (buktiPembayaran ? MAKS_BUKTI_PEMBAYARAN : MAX_SIZE)) {
      return Response.json({ error: buktiPembayaran ? PESAN_UKURAN_BUKTI : 'Ukuran file terlalu besar. Maksimal 10 MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buktiPembayaran) {
      const ekstensi = buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? 'jpg'
        : buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
        : buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null;
      if (!ekstensi) return Response.json({ error: 'Format bukti pembayaran harus JPG, PNG, atau WebP.' }, { status: 400 });
      const nama = `bukti-${nanoid()}.${ekstensi}`;
      const tersimpan = await simpanFile(u.$id, nama, buffer, 'bukti-pembayaran', file.type || `image/${ekstensi}`, async () => {
        await tulis('unggahan_bukti', nama, {
          id_pembeli: u.$id, ukuran: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex'),
        });
      });
      if (!tersimpan) return Response.json({ error: 'Batas unggahan harian tercapai. Coba lagi besok.' }, { status: 429 });
      return Response.json({ $id: nama, ok: true });
    }

    const cleanExt = (isExtOk ? extFromName : (file.type?.split('/')[1] || 'jpg')).replace('jpeg', 'jpg');
    const nama = `${nanoid()}.${cleanExt}`;
    const tersimpan = await simpanFile(u.$id, nama, buffer, 'gambar', file.type || `image/${cleanExt}`);
    if (!tersimpan) return Response.json({ error: 'Batas unggahan harian tercapai. Coba lagi besok.' }, { status: 429 });

    return Response.json({ $id: nama, ok: true });
  } catch (e) {
    console.error('[/api/upload] Error:', {
      name: e?.name,
      message: e?.message,
      code: e?.code,
      cause: e?.cause?.message,
      causeCode: e?.cause?.code,
      causeHost: e?.cause?.hostname,
      stack: e?.stack,
    });
    return Response.json({ error: 'Terjadi kesalahan saat mengunggah gambar.' }, { status: 500 });
  }
}
