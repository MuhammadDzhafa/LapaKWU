// POST /api/auth/masuk — Login email + password, set cookie sesi
import { cariAkunByEmail, verifikasiPassword, setSesiCookie } from '@/lib/auth';
import { databaseTidakTersedia } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { email, password } = await req.json().catch(() => null) || {};
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return Response.json({ error: 'Email dan kata sandi wajib diisi.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await cariAkunByEmail(cleanEmail);
    if (!user) {
      // Email belum terdaftar: kirim status 404 dan type user_not_found agar diarahkan otomatis ke daftar
      return Response.json(
        { error: 'Email belum terdaftar.', type: 'user_not_found', notFound: true },
        { status: 404 }
      );
    }

    const cocok = await verifikasiPassword(user, password);
    if (!cocok) {
      return Response.json(
        { error: 'Kata sandi salah. Silakan periksa kembali kata sandimu.', type: 'invalid_password' },
        { status: 401 }
      );
    }

    await setSesiCookie(user.id);
    return Response.json({ ok: true, $id: user.id, name: user.nama, email: user.email });
  } catch (e) {
    console.error('[/api/auth/masuk]', e?.code || e?.name);
    if (databaseTidakTersedia(e)) return Response.json({ error: 'Database belum dapat dihubungi. Coba lagi sebentar.' }, { status: 503 });
    return Response.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
