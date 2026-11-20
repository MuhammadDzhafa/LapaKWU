import { rows, siapa, err } from '@/lib/server';
import { TABEL_PUBLIK, TABEL_PRIVAT, batasAkses, sanitasiPublik } from '@/lib/akses-data';
import { databaseTidakTersedia } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { tabel, queries = [] } = await req.json();
    if (![...TABEL_PUBLIK, ...TABEL_PRIVAT].includes(tabel) || !Array.isArray(queries)) return err('Tabel atau kueri tidak valid.');

    let akses = [];
    if (TABEL_PRIVAT.includes(tabel)) {
      const u = await siapa(req);
      if (!u) return err('Belum masuk.', 401);
      akses = await batasAkses(tabel, u.$id, queries);
    }

    const hasil = await rows(null, tabel, [...queries, ...akses]);
    return Response.json({ rows: TABEL_PUBLIK.includes(tabel) ? hasil.map((row) => sanitasiPublik(tabel, row)) : hasil });
  } catch (e) {
    if (databaseTidakTersedia(e)) return err('Database belum dapat dihubungi. Coba lagi sebentar.', 503);
    console.error('[/api/db/list]', e?.message);
    return err('Gagal ambil data.', 500);
  }
}
