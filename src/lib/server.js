// Helper server untuk data PostgreSQL LapaKWU.
// Semua fungsi helper DB yang dipakai API routes.
import { cariSatu, cariBanyak, tulis, ubahData, hapusData, nilaiDb, denganTransaksi, sesudahCommit } from './db';
import { cariAkunById } from './auth';
import { kabari } from './kirim';
import { nanoid } from 'nanoid';
export const ID = Object.assign(() => nanoid(), {
  unique: () => nanoid(),
  custom: (id) => id,
});

// ── Auth helper ────────────────────────────────────────────
// Ambil user dari JWT cookie (server-side Next.js route handler)
export async function siapa(req) {
  // Sesi browser diverifikasi dari cookie JWT.
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.match(/lapakwu_sess=([^;]+)/);
  if (!match) return null;
  const { verifyToken } = await import('./auth');
  const payload = await verifyToken(match[1]);
  if (!payload?.sub) return null;
  const akun = await cariAkunById(payload.sub);
  if (!akun) return null;
  // Kembalikan objek mirip Appwrite user agar kode API tidak perlu banyak diubah
  return { $id: akun.id, name: akun.nama, email: akun.email };
}

export const err = (m, s = 400) => Response.json({ error: m }, { status: s });

// ── CRUD helpers (mirip Appwrite TablesDB) ─────────────────

const defaults = {
  pengguna: { no_telepon: '', kontak_terverifikasi: false },
  kode_verifikasi: { percobaan: 0 },
  notifikasi: { sudah_dibaca: false },
  pembeli: { alamat: '' }, mitra: { alamat_usaha: '' }, admin: { level_akses: 'SUPER' },
  produk: { stok: 0 }, keranjang: { total_harga: 0 }, item_keranjang: { jumlah: 1, subtotal: 0 },
  pesanan: { jenis_pemesanan: 'OFFLINE' },
  rekap_penjualan: { total_penjualan: 0, jumlah_transaksi: 0, total_komisi: 0, total_digital: 0, total_offline: 0, jumlah_offline: 0, status_pencairan: 'BELUM' },
};

function metadata(row) {
  return { ...row, $id: row.id, $createdAt: row.created_at, $updatedAt: row.updated_at };
}

export async function getRow(_, tabel, id) {
  const row = typeof id === 'string' ? await cariSatu(tabel, { _id: id }) : null;
  if (!row) throw Object.assign(new Error('Not found'), { code: 404 });
  return metadata(row);
}

const aliases = { '$id': '_id', id: '_id', '$createdAt': 'created_at', '$updatedAt': 'updated_at' };
const skalar = (v) => v === null || typeof v === 'string' || typeof v === 'boolean' || Number.isFinite(v);
const operators = { eq: '$eq', gt: '$gt', lt: '$lt' };

export async function rows(_, tabel, queries = []) {
  const filters = [];
  let limit = 100;
  let sort;
  for (const q of queries) {
    if (!q) continue;
    if (q.type === 'limit') {
      if (!Number.isInteger(q.n) || q.n < 0) throw new Error('Limit tidak valid.');
      limit = q.n;
      continue;
    }
    const col = Object.hasOwn(aliases, q.col) ? aliases[q.col] : q.col;
    if (typeof col !== 'string' || !/^[a-z_][a-z0-9_]*$/.test(col)) throw new Error('Kolom tidak valid.');
    if (q.type === 'orderDesc' || q.type === 'orderAsc') {
      sort = { [col]: q.type === 'orderDesc' ? -1 : 1 };
    } else if (q.type === 'eq' && Array.isArray(q.val) && q.val.every(skalar)) {
      filters.push({ [col]: { $in: q.val.map((v) => nilaiDb(col, v)) } });
    } else if (Object.hasOwn(operators, q.type) && skalar(q.val)) {
      filters.push({ [col]: { [operators[q.type]]: nilaiDb(col, q.val) } });
    } else {
      throw new Error('Filter tidak valid.');
    }
  }
  return (await cariBanyak(tabel, filters.length ? { $and: filters } : {}, { limit, sort })).map(metadata);
}

export async function put(_, tabel, id, data = {}) {
  return metadata(await tulis(tabel, id || nanoid(), { ...defaults[tabel], ...data }));
}

export async function upd(_, tabel, id, data = {}) {
  return ubahData(tabel, { _id: id }, data);
}

const relasiHapus = {
  users: { cascade: [['pengguna', '_id']] },
  pengguna: { blokir: [['pesanan', 'id_pembeli']], cascade: [['kode_verifikasi', '_id'], ['notifikasi', 'id_pengguna'], ['pembeli', '_id'], ['mitra', '_id'], ['admin', '_id']] },
  pembeli: { cascade: [['keranjang', 'id_pembeli']] },
  keranjang: { cascade: [['item_keranjang', 'id_keranjang']] },
  mitra: { blokir: [['pesanan', 'id_mitra']], cascade: [['produk', 'id_mitra'], ['rekap_penjualan', 'id_mitra'], ['penjualan_offline', 'id_mitra']] },
  produk: { blokir: [['detail_pesanan', 'id_produk'], ['penjualan_offline', 'id_produk']], cascade: [['item_keranjang', 'id_produk']] },
  pesanan: { cascade: [['detail_pesanan', 'id_pesanan'], ['pembayaran', 'id_pesanan']] },
};

async function hapusRelasi(tabel, id) {
  const { blokir = [], cascade = [] } = relasiHapus[tabel] || {};
  for (const [koleksi, field] of blokir) {
    if (await cariSatu(koleksi, { [field]: id })) throw Object.assign(new Error('Data masih dipakai pada riwayat transaksi.'), { code: 409 });
  }
  for (const [koleksi, field] of cascade) {
    if (relasiHapus[koleksi]) {
      for (const row of await cariBanyak(koleksi, { [field]: id }, { limit: 2147483647 })) await hapusRelasi(koleksi, row.id);
    } else {
      await hapusData(koleksi, { [field]: id }, true);
    }
  }
  await hapusData(tabel, { _id: id });
}

export async function del(_, tabel, id) {
  if (relasiHapus[tabel]) return denganTransaksi(() => hapusRelasi(tabel, id));
  return hapusData(tabel, { _id: id });
}

export async function inc(_, tabel, id, kolom, nilai) {
  return ubahData(tabel, { _id: id }, {}, { inc: { [kolom]: nilai } });
}

export async function dec(_, tabel, id, kolom, nilai, min = 0) {
  if (!Number.isFinite(nilai) || nilai <= 0) throw new Error('Jumlah pengurangan tidak valid.');
  const result = await ubahData(tabel, { _id: id, [kolom]: { $gte: min + nilai } }, {}, { inc: { [kolom]: -nilai } });
  if (!result.matchedCount) throw Object.assign(new Error('Stok tidak cukup.'), { code: 'STOK_TIDAK_CUKUP' });
}

export async function kirimNotifLuar(uid, judul, pesan) {
  const pg = await cariSatu('pengguna', { _id: uid }).catch(() => null);
  if (pg) await kabari(pg, judul, pesan).catch(() => {});
}

export async function notif(_, uid, judul, pesan, luar = false) {
  await put(null, 'notifikasi', nanoid(), { id_pengguna: uid, judul, pesan, waktu_kirim: new Date() });
  if (luar) await sesudahCommit(() => kirimNotifLuar(uid, judul, pesan));
}

// Helper kueri data.
export const Query = {
  equal: (col, val) => ({ type: 'eq', col, val }),
  limit: (n) => ({ type: 'limit', n }),
  orderDesc: (col) => ({ type: 'orderDesc', col }),
  orderAsc: (col) => ({ type: 'orderAsc', col }),
  greaterThan: (col, val) => ({ type: 'gt', col, val }),
  lessThan: (col, val) => ({ type: 'lt', col, val }),
};

export const svc = () => ({ db: null, users: null, storage: null });
