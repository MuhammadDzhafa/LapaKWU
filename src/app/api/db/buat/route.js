import { put, getRow, siapa, err } from '@/lib/server';
import { cariSatu, pastikanPembeli } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { tabel, data } = await req.json();
    if (!['item_keranjang', 'keranjang'].includes(tabel)) return err('Operasi tidak diizinkan.', 403);
    const u = await siapa(req);
    if (!u) return err('Belum masuk.', 401);
    await pastikanPembeli(u);
    if (tabel === 'keranjang') return Response.json(await getRow(null, 'keranjang', u.$id));
    const { id_produk, jumlah, subtotal } = data || {};
    if (typeof id_produk !== 'string' || !Number.isSafeInteger(jumlah) || jumlah < 1 || !Number.isFinite(subtotal) || subtotal < 0) {
      return err('Item keranjang tidak valid.');
    }
    const produk = await cariSatu('produk', { _id: id_produk });
    if (!produk || jumlah > produk.stok) return err('Stok tidak cukup.', 409);
    return Response.json(await put(null, tabel, null, { id_keranjang: u.$id, id_produk, jumlah, subtotal: jumlah * produk.harga }));
  } catch (e) {
    console.error('[/api/db/buat]', e?.message);
    return err('Gagal buat data.', 500);
  }
}
