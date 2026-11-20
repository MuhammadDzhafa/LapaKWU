// POST /api/auth/masuk — Login email + password, set cookie sesi
import { cariAkunByEmail, verifikasiPassword, setSesiCookie } from '@/lib/auth';
import { cariSatu, databaseTidakTersedia } from '@/lib/db';
import { alamatKlien, batasiLaju } from '@/lib/rate-limit';
import { originValid } from '@/lib/server';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    if (!originValid(req)) return Response.json({ error: 'Sumber permintaan tidak diizinkan.' }, { status: 403 });
    const { email, password } = await req.json().catch(() => null) || {};
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return Response.json({ error: 'Email dan kata sandi wajib diisi.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const allowed = await Promise.all([
      batasiLaju(`login-email:${cleanEmail}`, 10, 900),
      batasiLaju(`login-ip:${alamatKlien(req)}`, 40, 900),
    ]);
    if (allowed.includes(false)) return Response.json({ error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' }, { status: 429 });
    const user = await cariAkunByEmail(cleanEmail);
    if (!user) {
      return Response.json({ error: 'Email atau kata sandi salah.' }, { status: 401 });
    }

    const profil = await cariSatu('pengguna', { _id: user.id });
    if (profil?.status_akun === 'DIBLOKIR') {
      return Response.json({ error: 'Akun tidak dapat digunakan. Hubungi admin.' }, { status: 403 });
    }

    const cocok = await verifikasiPassword(user, password);
    if (!cocok) {
      return Response.json({ error: 'Email atau kata sandi salah.' }, { status: 401 });
    }

    const [mitra, admin] = await Promise.all([
      cariSatu('mitra', { _id: user.id }),
      cariSatu('admin', { _id: user.id }),
    ]);
    const peran = mitra ? 'mitra' : admin ? 'admin' : 'pembeli';
    await setSesiCookie(user.id);
    return Response.json({ ok: true, $id: user.id, name: user.nama, email: user.email, peran });
  } catch (e) {
    console.error('[/api/auth/masuk]', e?.code || e?.name);
    if (databaseTidakTersedia(e)) return Response.json({ error: 'Database belum dapat dihubungi. Coba lagi sebentar.' }, { status: 503 });
    return Response.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
