// GET /api/auth/saya — Kembalikan profil & peran user secara instan dan akurat
import { getSesiDariCookie } from '@/lib/auth';
import { cariSatu, databaseTidakTersedia } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sesi = await getSesiDariCookie();
    if (!sesi) return Response.json(null);
    const { akun, pengguna } = sesi;
    const uid = akun.id;
    const [mitra, admin, pembeli] = await Promise.all([
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
