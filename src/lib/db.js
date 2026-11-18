import { MongoClient } from 'mongodb';
import { AsyncLocalStorage } from 'node:async_hooks';

const state = globalThis[Symbol.for('lapakwu.mongo')] ??= {};
const transaksi = new AsyncLocalStorage();

export const koleksiInti = [
  'users', 'pengguna', 'kode_verifikasi', 'notifikasi', 'pembeli', 'mitra', 'admin',
  'produk', 'keranjang', 'item_keranjang', 'pesanan', 'detail_pesanan', 'payment_gateway',
  'pembayaran', 'rekap_penjualan', 'penjualan_offline',
];

const indeks = {
  users: [{ key: { email: 1 }, unique: true }],
  notifikasi: [{ key: { id_pengguna: 1, created_at: -1 } }],
  produk: [{ key: { id_mitra: 1 } }],
  item_keranjang: [{ key: { id_keranjang: 1 } }, { key: { id_produk: 1 } }],
  pesanan: [{ key: { id_pembeli: 1 } }, { key: { id_mitra: 1 } }, { key: { status_pesanan: 1, tanggal_pesanan: 1 } }],
  detail_pesanan: [{ key: { id_pesanan: 1 } }, { key: { id_produk: 1 } }],
  pembayaran: [
    { key: { id_pesanan: 1 } }, { key: { id_bukti: 1 } }, { key: { id_bukti_checkout: 1 } },
    { key: { metode: 1, status_pembayaran: 1, created_at: 1 } },
  ],
  bukti_checkout: [{ key: { referensi: 1, total: 1, status_ocr: 1, status_pembayaran: 1, created_at: -1 } }],
  rekap_penjualan: [{ key: { id_mitra: 1, periode: 1 } }],
  penjualan_offline: [{ key: { id_mitra: 1, id_produk: 1, periode: 1, waktu: -1 } }],
};

export async function getDatabase() {
  if (!state.connection) {
    const uri = process.env.MONGODB_URI?.trim();
    if (!uri) throw Object.assign(new Error('MONGODB_URI belum dikonfigurasi di .env.local.'), { code: 'MONGODB_CONFIG' });
    const client = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000 });
    state.connection = client.connect().then(async () => {
      const dbName = process.env.MONGODB_DB?.trim();
      if (!dbName) throw Object.assign(new Error('MONGODB_DB belum dikonfigurasi di .env.local.'), { code: 'MONGODB_CONFIG' });
      const db = client.db(dbName);
      await Promise.all(Object.entries(indeks).map(([name, specs]) => db.collection(name).createIndexes(specs)));
      return { client, db };
    }).catch(async (error) => {
      await client.close().catch(() => {});
      state.connection = null;
      throw error;
    });
  }
  return state.connection;
}

export function databaseTidakTersedia(error) {
  return error?.code === 'MONGODB_CONFIG' || [13, 18, 8000].includes(error?.code) || [
    'MongoParseError', 'MongoServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError', 'MongoNotConnectedError',
  ].includes(error?.name);
}

export async function denganTransaksi(jalankan) {
  if (transaksi.getStore()) return jalankan();
  const { client } = await getDatabase();
  const { hasil, setelahCommit } = await client.withSession((session) => session.withTransaction(async () => {
    const context = { session, setelahCommit: [] };
    const hasil = await transaksi.run(context, jalankan);
    return { hasil, setelahCommit: context.setelahCommit };
  }));
  await Promise.allSettled(setelahCommit.map((callback) => callback()));
  return hasil;
}

export async function sesudahCommit(callback) {
  const context = transaksi.getStore();
  if (context) context.setelahCommit.push(callback);
  else await callback();
}

async function akses(tabel) {
  const { db } = await getDatabase();
  return [db.collection(tabel), { session: transaksi.getStore()?.session }];
}

const tanggal = new Set(['created_at', 'updated_at', 'kedaluwarsa', 'waktu_kirim', 'tanggal_pesanan', 'waktu_pengambilan', 'waktu_bayar', 'tanggal_cair', 'waktu']);
export function nilaiDb(kolom, nilai) {
  return tanggal.has(kolom) && typeof nilai === 'string' && Number.isFinite(Date.parse(nilai)) ? new Date(nilai) : nilai;
}

function bersihkan(data) {
  return Object.fromEntries(Object.entries(data)
    .filter(([k, v]) => /^[a-z][a-z0-9_]*$/.test(k) && k !== 'id' && v !== undefined)
    .map(([k, v]) => [k, nilaiDb(k, v)]));
}

function dokumen(row) {
  if (!row) return null;
  const { _id, ...data } = row;
  return { ...data, id: _id };
}

export async function cariSatu(tabel, filter) {
  const [collection, options] = await akses(tabel);
  return dokumen(await collection.findOne(filter, options));
}

export async function cariBanyak(tabel, filter, { sort, limit = 100, skip = 0 } = {}) {
  if (limit === 0) return [];
  const [collection, options] = await akses(tabel);
  const rows = await collection.find(filter, { ...options, sort, limit, skip }).toArray();
  return rows.map(dokumen);
}

export async function tulis(tabel, id, data) {
  const [collection, options] = await akses(tabel);
  const now = new Date();
  const row = { _id: id, created_at: now, updated_at: now, ...bersihkan(data) };
  try {
    await collection.insertOne(row, options);
  } catch (e) {
    if (e.code === 11000) throw Object.assign(new Error('Data sudah ada.'), { code: 409 });
    throw e;
  }
  return dokumen(row);
}

export async function ubahData(tabel, filter, data, { upsert = false, inc, insertOnly = false } = {}) {
  const [collection, options] = await akses(tabel);
  const fields = bersihkan(data);
  if (!upsert && !inc && !Object.keys(fields).length) return null;
  const now = new Date();
  const update = insertOnly
    ? { $setOnInsert: { ...fields, created_at: now, updated_at: now } }
    : { $set: { ...fields, updated_at: now }, ...(upsert ? { $setOnInsert: { created_at: now } } : {}), ...(inc ? { $inc: inc } : {}) };
  return collection.updateOne(filter, update, { ...options, upsert });
}

export async function hapusData(tabel, filter, banyak = false) {
  const [collection, options] = await akses(tabel);
  return banyak ? collection.deleteMany(filter, options) : collection.deleteOne(filter, options);
}

export async function pastikanPembeli({ $id, name, email }) {
  const options = { upsert: true, insertOnly: true };
  await ubahData('pengguna', { _id: $id }, {
    nama: name || 'Pengguna', email, no_telepon: '', status_akun: 'AKTIF', kanal: 'EMAIL', kontak_terverifikasi: true,
  }, options);
  await ubahData('pembeli', { _id: $id }, { alamat: '' }, options);
  await ubahData('keranjang', { _id: $id }, { id_pembeli: $id, total_harga: 0 }, options);
}
