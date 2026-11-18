// POST /api/upload/hapus — Hapus file gambar dari public/uploads/
import { unlink } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { siapa, getRow } from '@/lib/server';
export const dynamic = 'force-dynamic';

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads');

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

    await unlink(join(UPLOAD_DIR, namaFile)).catch(() => {}); // abaikan jika sudah tidak ada
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[/api/upload/hapus]', e?.message);
    return Response.json({ error: 'Gagal hapus file.' }, { status: 500 });
  }
}
