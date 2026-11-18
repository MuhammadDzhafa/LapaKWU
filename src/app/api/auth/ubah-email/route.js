// POST /api/auth/ubah-email — Ubah email akun setelah konfirmasi password
import { getUserIdDariCookie, cariAkunByEmail, verifikasiPassword, ubahEmail } from '@/lib/auth';
import { cariSatu, ubahData, denganTransaksi } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const uid = await getUserIdDariCookie();
    if (!uid) return Response.json({ error: 'Belum masuk.' }, { status: 401 });

    const { emailBaru, password } = await req.json();
    if (!emailBaru || !password) {
      return Response.json({ error: 'Email baru dan kata sandi wajib diisi.' }, { status: 400 });
    }

    const cleanEmail = emailBaru.trim().toLowerCase();
    const existing = await cariAkunByEmail(cleanEmail);
    if (existing && existing.id !== uid) {
      return Response.json({ error: 'Email tersebut sudah digunakan akun lain.' }, { status: 409 });
    }

    const userWithHash = await cariSatu('users', { _id: uid });
    if (!userWithHash) return Response.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });

    const cocok = await verifikasiPassword(userWithHash, password);
    if (!cocok) {
      return Response.json({ error: 'Kata sandi saat ini salah.' }, { status: 400 });
    }

    await denganTransaksi(async () => {
      await ubahEmail(uid, cleanEmail);
      await ubahData('pengguna', { _id: uid }, { email: cleanEmail, kontak_terverifikasi: false });
    });

    return Response.json({ ok: true, email: cleanEmail, verifikasi: true });
  } catch (e) {
    if (e.code === 11000) return Response.json({ error: 'Email tersebut sudah digunakan akun lain.' }, { status: 409 });
    console.error('[/api/auth/ubah-email]', e?.message);
    return Response.json({ error: 'Gagal mengubah email.' }, { status: 500 });
  }
}
