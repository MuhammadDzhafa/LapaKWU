// POST /api/auth/daftar — Buat akun baru, langsung login
import { buatAkun, cariAkunByEmail, setSesiCookie } from '@/lib/auth';
import { denganTransaksi, pastikanPembeli } from '@/lib/db';
import { nanoid } from 'nanoid';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { email, password, nama, userId } = await req.json();
    if (!email || !password || !nama) return Response.json({ error: 'Isi nama, email, dan kata sandi.' }, { status: 400 });
    if (password.length < 8) return Response.json({ error: 'Kata sandi minimal 8 karakter.' }, { status: 400 });

    const emailNorm = email.trim().toLowerCase();
    const namaNorm = nama.trim();

    const ada = await cariAkunByEmail(emailNorm);
    if (ada) return Response.json({ error: 'Email sudah terdaftar.' }, { status: 409 });

    const id = typeof userId === 'string' && /^[a-zA-Z0-9_-]{1,36}$/.test(userId) ? userId : nanoid();
    await denganTransaksi(async () => {
      await buatAkun({ id, email: emailNorm, password, nama: namaNorm });
      await pastikanPembeli({ $id: id, name: namaNorm, email: emailNorm });
    });

    await setSesiCookie(id);
    return Response.json({ ok: true, $id: id, name: namaNorm, email: emailNorm });
  } catch (e) {
    if (e.code === 409) return Response.json({ error: 'Email atau ID akun sudah terdaftar.' }, { status: 409 });
    console.error('[/api/auth/daftar]', e?.message);
    return Response.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
