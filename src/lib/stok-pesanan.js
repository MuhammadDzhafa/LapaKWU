import { getRow, upd } from './server.js';
import { kunciProduk } from './db.js';
import { perubahanStok } from './add-on.js';

export async function kembalikanStokPesanan(db, detail) {
  const perProduk = Map.groupBy(detail, (item) => item.id_produk);
  for (const id of [...perProduk.keys()].sort()) {
    if (!await kunciProduk(id)) continue;
    const produk = await getRow(db, 'produk', id);
    const perubahan = {};
    for (const item of perProduk.get(id)) {
      Object.assign(perubahan, perubahanStok({ ...produk, ...perubahan }, item.add_on, item.jumlah));
    }
    await upd(db, 'produk', id, perubahan);
  }
}
