import { put, getRow, siapa, err } from '@/lib/server';
import { cariSatu, cariBanyak, denganTransaksi, kunciProduk, pastikanPembeli } from '@/lib/db';

import { addOnValid, itemCocok, MAKS_CATATAN_ITEM } from '@/lib/add-on';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { tabel, data } = await req.json();
    if (!['item_keranjang', 'keranjang'].includes(tabel)) return err('Operasi tidak diizinkan.', 403);
    const u = await siapa(req);
    if (!u) return err('Belum masuk.', 401);
    await pastikanPembeli(u);
    if (tabel === 'keranjang') return Response.json(await getRow(null, 'keranjang', u.$id));
    const { id_produk, jumlah, subtotal, add_on = '', catatan_item = '' } = data || {};
    if (typeof id_produk !== 'string' || !Number.isSafeInteger(jumlah) || jumlah < 1 || !Number.isFinite(subtotal) || subtotal < 0) {
      return err('Item keranjang tidak valid.');
    }
    if (typeof catatan_item !== 'string' || catatan_item.length > MAKS_CATATAN_ITEM || (catatan_item.trim() && !add_on)) return err('Catatan item tidak valid.');
    const catatan = catatan_item.trim();
    return await denganTransaksi(async () => {
      if (!await kunciProduk(id_produk)) return err('Produk tidak tersedia.', 409);
      const produk = await cariSatu('produk', { _id: id_produk, diarsipkan: false });
      if (!produk || jumlah > produk.stok) return err('Produk tidak tersedia atau stok tidak cukup.', 409);
      if (!addOnValid(produk, add_on)) return err('Pilih add-on yang tersedia untuk produk ini.', 409);
      const items = await cariBanyak(tabel, { id_keranjang: u.$id, id_produk }, { limit: 5000 });
      if (items.some((item) => itemCocok(item, id_produk, add_on, catatan))) return err('Keranjang sudah berubah. Coba lagi.', 409);
      const jumlahProduk = items.reduce((total, item) => total + item.jumlah, jumlah);
      if (jumlahProduk > produk.stok) return err('Stok tidak cukup untuk semua pilihan produk ini.', 409);
      return Response.json(await put(null, tabel, null, { id_keranjang: u.$id, id_produk, jumlah, subtotal: jumlah * produk.harga, add_on, catatan_item: catatan }));
    });
  } catch (e) {
    console.error('[/api/db/buat]', e?.message);
    return err('Gagal buat data.', 500);
  }
}
