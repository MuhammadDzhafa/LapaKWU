import { cariBanyak, cariSatu } from './db';
import { Query } from './server';

export const TABEL_PUBLIK = ['produk', 'mitra', 'payment_gateway'];
export const TABEL_PRIVAT = [
  'pengguna', 'pembeli', 'admin', 'keranjang', 'item_keranjang', 'notifikasi',
  'pesanan', 'detail_pesanan', 'pembayaran', 'rekap_penjualan', 'penjualan_offline',
];

const kolomKueri = {
  produk: ['id_mitra', 'kategori', 'nama', 'harga', 'stok', 'diarsipkan'],
  mitra: ['nama_usaha', 'nomor_tenant'],
  item_keranjang: ['id_keranjang', 'id_produk'],
  keranjang: ['id_pembeli'],
  notifikasi: ['id_pengguna', 'sudah_dibaca'],
  pesanan: ['id_mitra', 'id_pembeli', 'tanggal_pesanan', 'status_pesanan'],
  detail_pesanan: ['id_pesanan', 'id_produk'],
  pembayaran: ['id_pesanan', 'metode', 'status_pembayaran'],
  rekap_penjualan: ['id_mitra', 'periode'],
  penjualan_offline: ['id_mitra', 'id_produk', 'periode'],
};
const kolomUmum = new Set(['$id', 'id', '$createdAt', '$updatedAt', 'created_at', 'updated_at']);
const nilaiKueriValid = (v) => v === null || typeof v === 'boolean' || Number.isFinite(v)
  || (typeof v === 'string' && v.length <= 512 && !v.includes('\0'));

export function kueriPublikValid(tabel, queries) {
  return Array.isArray(queries) && queries.length <= 16 && queries.every((q) => {
    if (!q || typeof q !== 'object' || Array.isArray(q)) return false;
    if (q.type === 'limit' || q.type === 'offset') return Number.isSafeInteger(q.n) && q.n >= 0;
    if (!kolomUmum.has(q.col) && !kolomKueri[tabel]?.includes(q.col)) return false;
    if (q.type === 'orderDesc' || q.type === 'orderAsc') return true;
    if (q.type === 'eq' && Array.isArray(q.val)) return q.val.length <= 500 && q.val.every(nilaiKueriValid);
    return ['eq', 'gt', 'lt'].includes(q.type) && nilaiKueriValid(q.val);
  });
}

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
    const { $id, nama_usaha, nomor_tenant } = row;
    return { $id, nama_usaha, nomor_tenant, antar_aktif: row.antar_aktif === true, ongkir: row.ongkir ?? 0 };
  }
  if (tabel === 'payment_gateway') {
    const { $id, nama_layanan } = row;
    return { $id, nama_layanan };
  }
  return row;
}
