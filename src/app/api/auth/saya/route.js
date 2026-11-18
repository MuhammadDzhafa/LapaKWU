// GET /api/auth/saya — Kembalikan profil & peran user secara instan dan akurat
import { getUserIdDariCookie, cariAkunById } from '@/lib/auth';
import { cariSatu, databaseTidakTersedia } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const uid = await getUserIdDariCookie();
    if (!uid) return Response.json({ error: 'Tidak ada sesi.' }, { status: 401 });

    const akun = await cariAkunById(uid);
    if (!akun) return Response.json({ error: 'Sesi tidak lagi berlaku. Silakan masuk kembali.' }, { status: 401 });

    // Ambil data profil, mitra, admin, pembeli sekaligus dalam 1 batch paralel cepat
    const [pengguna, mitra, admin, pembeli] = await Promise.all([
      cariSatu('pengguna', { _id: uid }),
      cariSatu('mitra', { _id: uid }),
      cariSatu('admin', { _id: uid }),
      cariSatu('pembeli', { _id: uid }),
    ]);

    const peran = mitra ? 'mitra' : admin ? 'admin' : 'pembeli';

    return Response.json({
      $id: akun.id,
      name: akun.nama,
      email: akun.email,
      peran,
      pengguna: pengguna ? { ...pengguna, $id: pengguna.id } : null,
      mitra: mitra ? { ...mitra, $id: mitra.id } : null,
      admin: peran === 'admin' ? { ...admin, $id: admin.id } : null,
      pembeli: pembeli ? { ...pembeli, $id: pembeli.id } : null,
    });
  } catch (e) {
    console.error('[/api/auth/saya]', e?.code || e?.name);
    if (databaseTidakTersedia(e)) return Response.json({ error: 'Database belum dapat dihubungi. Coba lagi sebentar.' }, { status: 503 });
    return Response.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
