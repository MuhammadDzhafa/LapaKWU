// POST /api/auth/ganti-sandi — Ganti kata sandi dengan kata sandi lama
import { getUserIdDariCookie, cariAkunById, verifikasiPassword, ubahPassword } from '@/lib/auth';
import { cariSatu } from '@/lib/db';
import { originValid } from '@/lib/server';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    if (!originValid(req)) return Response.json({ error: 'Sumber permintaan tidak diizinkan.' }, { status: 403 });
    const uid = await getUserIdDariCookie();
    if (!uid) return Response.json({ error: 'Belum masuk.' }, { status: 401 });

    const { sandiLama, sandiBaru } = await req.json();
    if (!sandiLama || !sandiBaru) {
      return Response.json({ error: 'Kata sandi lama dan baru wajib diisi.' }, { status: 400 });
    }

    if (typeof sandiBaru !== 'string' || sandiBaru.length < 8) {
      return Response.json({ error: 'Kata sandi baru minimal 8 karakter.' }, { status: 400 });
    }

    const userWithHash = await cariSatu('users', { _id: uid });
    if (!userWithHash) return Response.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });

    const cocok = await verifikasiPassword(userWithHash, sandiLama);
    if (!cocok) {
      return Response.json({ error: 'Kata sandi lama salah.' }, { status: 400 });
    }

    await ubahPassword(uid, sandiBaru);
    return Response.json({ ok: true, pesan: 'Kata sandi berhasil diubah.' });
  } catch (e) {
    console.error('[/api/auth/ganti-sandi]', e?.message);
    return Response.json({ error: 'Gagal mengganti kata sandi.' }, { status: 500 });
  }
}
