import { siapa, err } from '@/lib/server';
import { cariBanyak, cariSatu, denganTransaksi, kunciProduk, pastikanPembeli, ubahData } from '@/lib/db';

import { addOnValid, hargaSatuanProduk, stokPilihan } from '@/lib/add-on';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { tabel, id, data } = await req.json();
    if (!['item_keranjang', 'keranjang', 'notifikasi'].includes(tabel)) return err('Operasi tidak diizinkan.', 403);
    const u = await siapa(req);
    if (!u) return err('Belum masuk.', 401);
    if (typeof id !== 'string' || !id || !data) return err('Data tidak valid.');

    if (tabel === 'notifikasi') {
      if (data.sudah_dibaca !== true) return err('Data pemberitahuan tidak valid.');
      const result = await ubahData(tabel, { _id: id, id_pengguna: u.$id }, { sudah_dibaca: true });
      if (!result.matchedCount) return err('Pemberitahuan tidak ditemukan.', 404);
    } else if (tabel === 'keranjang') {
      if (id !== u.$id) return err('Keranjang tidak ditemukan.', 404);
      if (!Number.isFinite(data.total_harga) || data.total_harga < 0) return err('Total keranjang tidak valid.');
      await pastikanPembeli(u);
      await ubahData(tabel, { _id: id }, { total_harga: data.total_harga });
    } else {
      const filter = { _id: id, id_keranjang: u.$id };
      const item = await cariSatu(tabel, filter);
      if (!item) return err('Item tidak ditemukan.', 404);
      if (!Number.isSafeInteger(data.jumlah) || data.jumlah < 1) return err('Jumlah tidak valid.');
      return await denganTransaksi(async () => {
        await kunciProduk(item.id_produk);
        const produk = await cariSatu('produk', { _id: item.id_produk, diarsipkan: false });
        if (!produk) return err('Produk tidak tersedia.', 409);
        if (!addOnValid(produk, item.add_on)) return err('Pilihan add-on sudah berubah. Hapus item ini dan pilih ulang.', 409);
        const items = await cariBanyak(tabel, { id_keranjang: u.$id, id_produk: item.id_produk }, { limit: 5000 });
        const jumlahProduk = items
          .filter((baris) => baris.id !== id && (!produk.stok_varian || baris.add_on === item.add_on))
          .reduce((total, baris) => total + baris.jumlah, data.jumlah);
        if (jumlahProduk > stokPilihan(produk, item.add_on)) return err('Stok tidak cukup untuk pilihan produk ini.', 409);
        const result = await ubahData(tabel, filter, { jumlah: data.jumlah, subtotal: data.jumlah * hargaSatuanProduk(produk, item.add_on) });
        if (!result.matchedCount) return err('Item tidak ditemukan.', 404);
        return Response.json({ ok: true });
      });
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[/api/db/ubah]', e?.message);
    return err('Gagal ubah data.', 500);
  }
}
