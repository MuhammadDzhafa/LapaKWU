import { cariBanyak, cariSatu } from './db';
import { Query } from './server';

export const TABEL_PUBLIK = ['produk', 'mitra', 'payment_gateway'];
export const TABEL_PRIVAT = [
  'pengguna', 'pembeli', 'admin', 'keranjang', 'item_keranjang', 'notifikasi',
  'pesanan', 'detail_pesanan', 'pembayaran', 'rekap_penjualan', 'penjualan_offline',
];

export async function batasAkses(tabel, uid, queries) {
  const kepemilikan = {
    pengguna: '$id', pembeli: '$id', admin: '$id', keranjang: 'id_pembeli',
    item_keranjang: 'id_keranjang', notifikasi: 'id_pengguna',
    rekap_penjualan: 'id_mitra', penjualan_offline: 'id_mitra',
  };
  if (['notifikasi', 'keranjang', 'item_keranjang'].includes(tabel)) {
    return [Query.equal(kepemilikan[tabel], uid)];
  }
  const [admin, mitra] = await Promise.all([cariSatu('admin', { _id: uid }), cariSatu('mitra', { _id: uid })]);
  if (admin && !mitra) return [];
  if (Object.hasOwn(kepemilikan, tabel)) return [Query.equal(kepemilikan[tabel], uid)];

  const aksesPesanan = { $or: [{ id_pembeli: uid }, { id_mitra: uid }] };
  const filterPesanan = queries.find((q) => q?.type === 'eq' && q.col === (tabel === 'pesanan' ? '$id' : 'id_pesanan'));
  const nilai = filterPesanan?.val;
  const ids = (Array.isArray(nilai) ? nilai : [nilai]).filter((id) => typeof id === 'string');
  const records = await cariBanyak('pesanan', {
    ...aksesPesanan,
    ...(filterPesanan ? { _id: { $in: ids } } : {}),
  }, { limit: 5000 });
  return [Query.equal(tabel === 'pesanan' ? '$id' : 'id_pesanan', records.map((row) => row.id))];
}

// Row mitra memuat rekening, QRIS, dan catatan verifikasi. Hanya kirim
// kolom yang memang dipakai katalog publik.
export function sanitasiPublik(tabel, row) {
  if (!row) return row;
  if (tabel === 'mitra') {
    const { $id, nama_usaha, alamat_usaha, nomor_tenant } = row;
    return { $id, nama_usaha, alamat_usaha, nomor_tenant };
  }
  if (tabel === 'payment_gateway') {
    const { $id, nama_layanan } = row;
    return { $id, nama_layanan };
  }
  return row;
}
