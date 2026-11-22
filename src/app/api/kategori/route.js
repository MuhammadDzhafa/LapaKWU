import { nanoid } from 'nanoid';
import { databaseTidakTersedia, queryDatabase } from '@/lib/db';
import { bacaKategori } from '@/lib/kategori';
import { dataKategoriProduk, transaksiKategori } from '@/lib/kategori-db';
import { err, siapa, upd } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { rows } = await queryDatabase('SELECT nama FROM kategori_produk ORDER BY lower(nama)');
    return Response.json({ kategori: rows.map(({ nama }) => nama) });
  } catch (error) {
    if (databaseTidakTersedia(error)) return err('Database belum dapat dihubungi. Coba lagi sebentar.', 503);
    console.error('[/api/kategori]', error.message);
    return err('Daftar kategori gagal dimuat.', 500);
  }
}

export async function POST(req) {
  try {
    const akun = await siapa(req);
    if (!akun) return err('Belum masuk.', 401);
    const { rows: [akses] } = await queryDatabase(
      `SELECT EXISTS (SELECT 1 FROM admin WHERE id = $1)
        AND NOT EXISTS (SELECT 1 FROM mitra WHERE id = $1) AS diizinkan`,
      [akun.$id],
    );
    if (!akses.diizinkan) return err('Khusus admin.', 403);

    const b = await req.json().catch(() => null);
    const aksi = b?.aksi;
    if (aksi === 'daftar') {
      const { rows } = await queryDatabase(
        `SELECT k.id, k.nama, COUNT(DISTINCT p.id_produk)::int AS jumlah_produk
         FROM kategori_produk k LEFT JOIN kategori_produk_terpakai p ON lower(k.nama) = p.kunci
         GROUP BY k.id ORDER BY lower(k.nama)`,
      );
      return Response.json({ kategori: rows });
    }

    if (!['tambah', 'ubah', 'hapus', 'atur_produk'].includes(aksi)) return err('Aksi kategori tidak dikenal.');
    const id = b.id;
    if (aksi !== 'tambah' && (typeof id !== 'string' || !id || id.length > 200 || id.includes('\0'))) {
      return err('ID tidak valid.');
    }
    const nama = typeof b.nama === 'string' ? bacaKategori(b.nama)?.[0] : null;
    if (['tambah', 'ubah'].includes(aksi) && !nama) return err('Isi nama kategori maksimal 100 karakter.');

    return await transaksiKategori(async () => {
      if (aksi === 'atur_produk') {
        const pilihan = bacaKategori(b.kategori_list);
        if (!pilihan?.length) return err('Pilih minimal satu kategori yang valid.');
        const hasil = await upd(null, 'produk', id, await dataKategoriProduk(pilihan));
        return hasil.matchedCount ? Response.json({ ok: true }) : err('Produk tidak ditemukan.', 404);
      }
      if (aksi === 'tambah') {
        await queryDatabase('INSERT INTO kategori_produk (id, nama) VALUES ($1, $2)', [nanoid(), nama]);
        return Response.json({ ok: true }, { status: 201 });
      }

      const { rows: [lama] } = await queryDatabase('SELECT nama FROM kategori_produk WHERE id = $1', [id]);
      if (!lama) return err('Kategori tidak ditemukan.', 404);
      if (aksi === 'hapus') {
        const dipakai = await queryDatabase(
          'SELECT 1 FROM kategori_produk_terpakai WHERE kunci = lower($1) LIMIT 1', [lama.nama],
        );
        if (dipakai.rowCount) return err('Pindahkan semua produk dari kategori ini sebelum menghapusnya.', 409);
        await queryDatabase('DELETE FROM kategori_produk WHERE id = $1', [id]);
      } else if (nama !== lama.nama) {
        await queryDatabase('UPDATE kategori_produk SET nama = $2 WHERE id = $1', [id, nama]);
        await queryDatabase(
          `WITH terdampak AS (
             SELECT DISTINCT id_produk FROM kategori_produk_terpakai WHERE kunci = lower($1)
           ), pilihan AS (
             SELECT p.id_produk, array_agg(COALESCE(k.nama, p.nama) ORDER BY p.urutan) AS daftar
             FROM kategori_produk_terpakai p
             JOIN terdampak t ON t.id_produk = p.id_produk
             LEFT JOIN kategori_produk k ON lower(k.nama) = CASE WHEN p.kunci = lower($1) THEN lower($2) ELSE p.kunci END
             GROUP BY p.id_produk
           )
           UPDATE produk p SET kategori = pilihan.daftar[1],
             extra = jsonb_set(p.extra, '{kategori_list}', to_jsonb(pilihan.daftar)), updated_at = NOW()
           FROM pilihan WHERE p.id = pilihan.id_produk`,
          [lama.nama, nama],
        );
      }
      return Response.json({ ok: true });
    });
  } catch (error) {
    if (databaseTidakTersedia(error)) return err('Database belum dapat dihubungi. Coba lagi sebentar.', 503);
    if (error.code === '23505') return err('Nama kategori sudah digunakan.', 409);
    if (error.code === 409) return err(error.message, 409);
    console.error('[/api/kategori]', error.message);
    return err('Gagal mengelola kategori. Coba lagi.', 500);
  }
}
