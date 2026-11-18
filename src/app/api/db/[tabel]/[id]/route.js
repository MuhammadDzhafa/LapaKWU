import { rows, siapa, err, Query } from '@/lib/server';
import { TABEL_PUBLIK, TABEL_PRIVAT, batasAkses } from '@/lib/akses-data';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const { tabel, id } = await params;
    if (![...TABEL_PUBLIK, ...TABEL_PRIVAT].includes(tabel)) return err('Tabel tidak valid.');
    const queries = [Query.equal('$id', id), Query.limit(1)];
    if (TABEL_PRIVAT.includes(tabel)) {
      const u = await siapa(req);
      if (!u) return err('Belum masuk.', 401);
      queries.push(...await batasAkses(tabel, u.$id, queries));
    }
    const [row] = await rows(null, tabel, queries);
    return row ? Response.json(row) : err('Data tidak ditemukan.', 404);
  } catch (e) {
    console.error('[/api/db/detail]', e?.message);
    return err('Gagal ambil data.', 500);
  }
}
