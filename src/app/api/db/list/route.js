import { rows, siapa, err, Query } from '@/lib/server';
import { TABEL_PUBLIK, TABEL_PRIVAT, batasAkses, kueriPublikValid, sanitasiPublik } from '@/lib/akses-data';
import { cariBanyak, databaseTidakTersedia } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return err('Data kueri tidak valid.');
    const { tabel, queries = [] } = body;
    if (![...TABEL_PUBLIK, ...TABEL_PRIVAT].includes(tabel) || !kueriPublikValid(tabel, queries)) return err('Tabel atau kueri tidak valid.');

    let akses = [];
    if (TABEL_PRIVAT.includes(tabel)) {
      const u = await siapa(req);
      if (!u) return err('Belum masuk.', 401);
      akses = await batasAkses(tabel, u.$id, queries);
    }

    if (tabel === 'produk') akses.push(Query.equal('diarsipkan', false));
    const hasil = await rows(null, tabel, [...queries, ...akses]);
    if (tabel === 'detail_pesanan' && hasil.length) {
      const produk = await cariBanyak('produk', { _id: { $in: [...new Set(hasil.map((item) => item.id_produk))] } }, { limit: hasil.length });
      const nama = new Map(produk.map((item) => [item.id, item.nama]));
      return Response.json({ rows: hasil.map((item) => ({ ...item, nama_produk: item.nama_produk || nama.get(item.id_produk) })) });
    }
    return Response.json({ rows: TABEL_PUBLIK.includes(tabel) ? hasil.map((row) => sanitasiPublik(tabel, row)) : hasil });
  } catch (e) {
    if (databaseTidakTersedia(e)) return err('Database belum dapat dihubungi. Coba lagi sebentar.', 503);
    console.error('[/api/db/list]', e?.message);
    return err('Gagal ambil data.', 500);
  }
}
