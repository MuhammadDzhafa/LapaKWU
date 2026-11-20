// POST /api/upload, upload gambar produk, QRIS, atau bukti bayar ke Backblaze B2.
import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import { siapa } from '@/lib/server';
import { MAKS_BUKTI_PEMBAYARAN, PESAN_UKURAN_BUKTI } from '@/lib/bukti-pembayaran';
import { tulis, denganTransaksi, queryDatabase } from '@/lib/db';
import { hapusFile, unggahFile } from '@/lib/backblaze';
import { kompresGambar } from '@/lib/kompres-gambar';
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
    const jenis = form.get('jenis');
    const buktiPembayaran = jenis === 'bukti-pembayaran';

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

    const asli = Buffer.from(await file.arrayBuffer());
    const jenisGambar = buktiPembayaran || jenis === 'qris' ? jenis : 'gambar';
    let gambar;
    try {
      gambar = await kompresGambar(asli, jenisGambar);
    } catch {
      return Response.json({ error: 'Gambar tidak dapat diproses. Gunakan file gambar yang valid dengan resolusi lebih kecil.' }, { status: 400 });
    }
    const { buffer, ekstensi, tipe } = gambar;
    const nama = `${buktiPembayaran ? 'bukti-' : ''}${nanoid()}.${ekstensi}`;
    const simpanBukti = buktiPembayaran ? () => tulis('unggahan_bukti', nama, {
      // Pemeriksaan bukti ganda tetap menggunakan sidik jari file asli.
      id_pembeli: u.$id, ukuran: buffer.length, sha256: createHash('sha256').update(asli).digest('hex'),
    }) : null;
    const tersimpan = await simpanFile(u.$id, nama, buffer, buktiPembayaran ? jenis : 'gambar', tipe, simpanBukti);
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
