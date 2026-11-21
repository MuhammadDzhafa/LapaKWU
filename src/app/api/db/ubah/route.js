import { siapa, err } from '@/lib/server';
import { cariSatu, pastikanPembeli, ubahData } from '@/lib/db';

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
      const produk = await cariSatu('produk', { _id: item.id_produk, diarsipkan: false });
      if (!produk || data.jumlah > produk.stok) return err('Stok tidak cukup.', 409);
      await ubahData(tabel, filter, { jumlah: data.jumlah, subtotal: data.jumlah * produk.harga });
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[/api/db/ubah]', e?.message);
    return err('Gagal ubah data.', 500);
  }
}
