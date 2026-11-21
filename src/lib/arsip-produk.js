import { denganTransaksi, queryDatabase } from './db';

function arsipProdukUntuk(id, idMitra) {
  return denganTransaksi(async () => {
    const { rows: produk } = await queryDatabase(
      `UPDATE produk SET diarsipkan = TRUE, updated_at = NOW()
       WHERE ($1::text IS NULL OR id = $1) AND ($2::text IS NULL OR id_mitra = $2)
       RETURNING id`,
      [id, idMitra],
    );
    if (!produk.length) return false;
    const { rows: keranjang } = await queryDatabase(
      'DELETE FROM item_keranjang WHERE id_produk = ANY($1::text[]) RETURNING id_keranjang',
      [produk.map((item) => item.id)],
    );
    if (keranjang.length) {
      await queryDatabase(
        `UPDATE keranjang k SET total_harga = COALESCE((SELECT SUM(i.subtotal)
         FROM item_keranjang i WHERE i.id_keranjang = k.id), 0)
         WHERE k.id = ANY($1::text[])`,
        [keranjang.map((item) => item.id_keranjang)],
      );
    }
    return true;
  });
}

export function arsipProduk(id, idMitra = null) {
  return arsipProdukUntuk(id, idMitra);
}

export function arsipProdukMitra(idMitra) {
  return arsipProdukUntuk(null, idMitra);
}
