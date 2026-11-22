import { denganTransaksi, queryDatabase } from './db.js';

export function transaksiKategori(jalankan) {
  return denganTransaksi(async () => {
    await queryDatabase('LOCK TABLE kategori_produk IN SHARE ROW EXCLUSIVE MODE');
    return jalankan();
  });
}

export async function dataKategoriProduk(pilihan) {
  const { rows } = await queryDatabase(
    `SELECT k.nama FROM unnest($1::text[]) WITH ORDINALITY AS p(nama, urutan)
     JOIN kategori_produk k ON lower(k.nama) = lower(p.nama)
     ORDER BY p.urutan`,
    [pilihan],
  );
  if (rows.length !== pilihan.length) {
    throw Object.assign(new Error('Ada kategori yang sudah tidak tersedia. Muat ulang daftar kategori.'), { code: 409 });
  }
  const kategori_list = rows.map(({ nama }) => nama);
  return { kategori: kategori_list[0], kategori_list };
}
