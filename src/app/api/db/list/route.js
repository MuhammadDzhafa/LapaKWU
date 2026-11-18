import { rows, siapa, err } from '@/lib/server';
import { TABEL_PUBLIK, TABEL_PRIVAT, batasAkses } from '@/lib/akses-data';

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

    return Response.json({ rows: await rows(null, tabel, [...queries, ...akses]) });
  } catch (e) {
    console.error('[/api/db/list]', e?.message);
    return err('Gagal ambil data.', 500);
  }
}
