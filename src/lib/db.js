import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

const { Pool } = pg;
const state = globalThis[Symbol.for('lapakwu.postgres')] ??= {};
const transaksi = new AsyncLocalStorage();

export const koleksiInti = [
  'users', 'pengguna', 'kode_verifikasi', 'notifikasi', 'pembeli', 'mitra', 'admin',
  'produk', 'keranjang', 'item_keranjang', 'pesanan', 'detail_pesanan', 'payment_gateway',
  'pembayaran', 'rekap_penjualan', 'penjualan_offline', 'unggahan_bukti', 'bukti_checkout', 'payhook_event',
  'pencairan_dompet',
];

const kolom = {
  users: ['nama', 'email', 'password_hash'],
  pengguna: ['nama', 'email', 'no_telepon', 'status_akun', 'kanal', 'kontak_terverifikasi'],
  kode_verifikasi: ['kode_hash', 'kanal', 'tujuan', 'kedaluwarsa', 'percobaan'],
  notifikasi: ['id_pengguna', 'judul', 'pesan', 'waktu_kirim', 'sudah_dibaca'],
  pembeli: ['alamat'],
  mitra: ['id_admin_verifikator', 'nama_usaha', 'alamat_usaha', 'catatan_verifikasi', 'rekening', 'id_qris', 'nomor_tenant'],
  admin: ['level_akses'],
  produk: ['id_mitra', 'nama', 'harga', 'kategori', 'deskripsi', 'stok', 'id_gambar'],
  keranjang: ['id_pembeli', 'total_harga'],
  item_keranjang: ['id_keranjang', 'id_produk', 'jumlah', 'subtotal'],
  pesanan: ['id_pembeli', 'id_mitra', 'tanggal_pesanan', 'jenis_pemesanan', 'total_harga', 'status_pesanan', 'alamat_pengiriman', 'lokasi_pengambilan', 'waktu_pengambilan', 'alasan_pembatalan'],
  detail_pesanan: ['id_pesanan', 'id_produk', 'jumlah', 'harga_satuan', 'subtotal'],
  payment_gateway: ['nama_layanan'],
  pembayaran: ['id_pesanan', 'id_gateway', 'metode', 'jumlah', 'status_pembayaran', 'waktu_bayar', 'id_bukti', 'id_bukti_checkout', 'status_ocr', 'catatan_ocr', 'hasil_ocr'],
  rekap_penjualan: ['id_mitra', 'periode', 'total_penjualan', 'jumlah_transaksi', 'total_komisi', 'total_digital', 'total_offline', 'jumlah_offline', 'status_pencairan', 'tanggal_cair', 'catatan_cair'],
  penjualan_offline: ['id_mitra', 'id_produk', 'nama_produk', 'jumlah', 'harga_satuan', 'subtotal', 'waktu', 'periode'],
  unggahan_bukti: ['id_pembeli', 'ukuran', 'sha256'],
  bukti_checkout: ['id_pembeli', 'id_bukti', 'total', 'status_ocr', 'referensi', 'status_pembayaran', 'waktu_bayar'],
  payhook_event: ['id_bukti_checkout'],
  pencairan_dompet: ['id_mitra', 'nama_usaha', 'id_qris', 'nominal', 'status', 'tanggal_cair', 'id_admin'],
};
const jsonKolom = new Set(['catatan_ocr', 'hasil_ocr']);
const tanggal = new Set(['created_at', 'updated_at', 'kedaluwarsa', 'waktu_kirim', 'tanggal_pesanan', 'waktu_pengambilan', 'waktu_bayar', 'tanggal_cair', 'waktu']);
const numerik = new Set(['harga', 'stok', 'total_harga', 'jumlah', 'subtotal', 'harga_satuan', 'jumlah_transaksi', 'total_komisi', 'total_digital', 'total_offline', 'jumlah_offline', 'total', 'ukuran', 'percobaan', 'nomor_tenant', 'nominal']);

function namaTabel(tabel) {
  if (!koleksiInti.includes(tabel)) throw Object.assign(new Error('Tabel tidak diizinkan.'), { code: 400 });
  return `"${tabel}"`;
}

export async function getDatabase() {
  if (!state.pool) {
    const connectionString = process.env.POSTGRES_URL?.trim() || process.env.DATABASE_URL?.trim();
    if (!connectionString) throw Object.assign(new Error('POSTGRES_URL belum dikonfigurasi.'), { code: 'POSTGRES_CONFIG' });
    state.pool = new Pool({ connectionString, max: Number(process.env.PG_POOL_MAX || 10), connectionTimeoutMillis: 8000, idleTimeoutMillis: 30000 });
    state.pool.on('error', (error) => console.error('[postgres] koneksi idle error:', error.message));
  }
  return state.pool;
}

export function databaseTidakTersedia(error) {
  return error?.code === 'POSTGRES_CONFIG' || ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', '28P01', '3D000', '57P01'].includes(error?.code);
}

async function query(text, values = []) {
  const client = transaksi.getStore()?.client;
  if (client) return client.query(text, values);
  return (await getDatabase()).query(text, values);
}

export { query as queryDatabase };

export async function denganTransaksi(jalankan) {
  if (transaksi.getStore()) return jalankan();
  const client = await (await getDatabase()).connect();
  const context = { client, setelahCommit: [] };
  try {
    await client.query('BEGIN');
    const hasil = await transaksi.run(context, jalankan);
    await client.query('COMMIT');
    await Promise.allSettled(context.setelahCommit.map((callback) => callback()));
    return hasil;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function sesudahCommit(callback) {
  const context = transaksi.getStore();
  if (context) context.setelahCommit.push(callback);
  else await callback();
}

export function nilaiDb(kolomNama, nilai) {
  return tanggal.has(kolomNama) && typeof nilai === 'string' && Number.isFinite(Date.parse(nilai)) ? new Date(nilai) : nilai;
}

function bersihkan(data = {}) {
  return Object.fromEntries(Object.entries(data).filter(([k, v]) => /^[a-z][a-z0-9_]*$/.test(k) && k !== 'id' && v !== undefined).map(([k, v]) => [k, nilaiDb(k, v)]));
}

function normalisasi(row) {
  if (!row) return null;
  const { extra = {}, ...data } = row;
  for (const [key, value] of Object.entries(data)) if (numerik.has(key) && value !== null) data[key] = Number(value);
  return { ...extra, ...data };
}

function ekspresiKolom(tabel, field) {
  if (field === '_id') field = 'id';
  if (!/^[a-z][a-z0-9_]*$/.test(field)) throw Object.assign(new Error('Kolom tidak valid.'), { code: 400 });
  if (field === 'id' || ['created_at', 'updated_at'].includes(field) || kolom[tabel].includes(field)) return `"${field}"`;
  return `("extra" ->> '${field}')`;
}

function kondisi(tabel, filter = {}, values = []) {
  const parts = [];
  for (const [field, value] of Object.entries(filter)) {
    if (field === '$and' || field === '$or') {
      if (!Array.isArray(value)) throw new Error('Filter tidak valid.');
      const children = value.map((part) => `(${kondisi(tabel, part, values) || 'TRUE'})`);
      parts.push(`(${children.length ? children.join(field === '$and' ? ' AND ' : ' OR ') : (field === '$and' ? 'TRUE' : 'FALSE')})`);
      continue;
    }
    const col = ekspresiKolom(tabel, field);
    const ops = value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) ? value : { $eq: value };
    for (const [op, raw] of Object.entries(ops)) {
      if (op === '$in') {
        if (!Array.isArray(raw) || !raw.length) { parts.push('FALSE'); continue; }
        const marks = raw.map((v) => { values.push(nilaiDb(field, v)); return `$${values.length}`; });
        parts.push(`${col} = ANY(ARRAY[${marks.join(', ')}])`);
        continue;
      }
      const sqlOp = ({ $eq: '=', $gt: '>', $gte: '>=', $lt: '<', $lte: '<=' })[op];
      if (!sqlOp) throw new Error(`Operator filter tidak didukung: ${op}`);
      if (raw === null && op === '$eq') parts.push(`${col} IS NULL`);
      else { values.push(nilaiDb(field, raw)); parts.push(`${col} ${sqlOp} $${values.length}`); }
    }
  }
  return parts.join(' AND ');
}

function dataKolom(tabel, data) {
  const fields = bersihkan(data);
  const known = {};
  const extra = {};
  for (const [key, value] of Object.entries(fields)) {
    if (kolom[tabel].includes(key) || ['created_at', 'updated_at'].includes(key)) known[key] = value;
    else extra[key] = value;
  }
  if (Object.keys(extra).length) known.extra = extra;
  return known;
}

function tambahParam(values, field, value) {
  if (value === null) { values.push(null); return `$${values.length}`; }
  values.push(jsonKolom.has(field) || field === 'extra' ? JSON.stringify(value) : value);
  return `$${values.length}${jsonKolom.has(field) || field === 'extra' ? '::jsonb' : ''}`;
}

export async function cariSatu(tabel, filter = {}) {
  const table = namaTabel(tabel), values = [];
  const where = kondisi(tabel, filter, values);
  const result = await query(`SELECT * FROM ${table}${where ? ` WHERE ${where}` : ''} LIMIT 1`, values);
  return normalisasi(result.rows[0]);
}

export async function cariBanyak(tabel, filter = {}, { sort, limit = 100, skip = 0 } = {}) {
  if (limit === 0) return [];
  const table = namaTabel(tabel), values = [];
  const where = kondisi(tabel, filter, values);
  let order = '';
  if (sort) {
    const items = Object.entries(sort).map(([field, dir]) => `${ekspresiKolom(tabel, field)} ${dir < 0 ? 'DESC' : 'ASC'}`);
    if (items.length) order = ` ORDER BY ${items.join(', ')}`;
  }
  values.push(limit, skip);
  const result = await query(`SELECT * FROM ${table}${where ? ` WHERE ${where}` : ''}${order} LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  return result.rows.map(normalisasi);
}

export async function tulis(tabel, id, data) {
  const table = namaTabel(tabel), fields = { id, created_at: new Date(), updated_at: new Date(), ...dataKolom(tabel, data) };
  const values = [], columns = Object.keys(fields);
  const marks = columns.map((key) => tambahParam(values, key, fields[key]));
  try {
    const result = await query(`INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${marks.join(', ')}) RETURNING *`, values);
    return normalisasi(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') throw Object.assign(new Error('Data sudah ada.'), { code: 409 });
    throw error;
  }
}

function idDariFilter(filter) {
  const value = filter?._id ?? filter?.id;
  return typeof value === 'string' ? value : null;
}

export async function ubahData(tabel, filter, data, { upsert = false, inc, insertOnly = false } = {}) {
  const table = namaTabel(tabel), fields = dataKolom(tabel, data);
  if (!upsert && !inc && !Object.keys(fields).length) return null;
  const values = [];
  if (upsert) {
    const id = idDariFilter(filter);
    if (!id) throw new Error('Upsert memerlukan filter id yang pasti.');
    const insert = { id, created_at: new Date(), updated_at: new Date(), ...fields };
    const columns = Object.keys(insert);
    const insertValues = [];
    const marks = columns.map((key) => tambahParam(insertValues, key, insert[key]));
    const updateParts = [];
    if (!insertOnly) {
      for (const [key, value] of Object.entries(fields)) {
        if (key === 'extra') updateParts.push(`"extra" = COALESCE("extra", '{}'::jsonb) || EXCLUDED."extra"`);
        else updateParts.push(`"${key}" = EXCLUDED."${key}"`);
      }
      updateParts.push('"updated_at" = NOW()');
    }
    const conflict = insertOnly || !updateParts.length ? 'DO NOTHING' : `DO UPDATE SET ${updateParts.join(', ')}`;
    const result = await query(`INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${marks.join(', ')}) ON CONFLICT (id) ${conflict} RETURNING id`, insertValues);
    return { matchedCount: result.rowCount || 0, modifiedCount: result.rowCount || 0, ...(result.rowCount ? { upsertedId: id } : {}) };
  }
  const where = kondisi(tabel, filter, values);
  const sets = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'extra') sets.push(`"extra" = COALESCE("extra", '{}'::jsonb) || ${tambahParam(values, key, value)}`);
    else sets.push(`"${key}" = ${tambahParam(values, key, value)}`);
  }
  for (const [key, value] of Object.entries(inc || {})) {
    const col = ekspresiKolom(tabel, key);
    values.push(value);
    sets.push(`${col} = ${col} + $${values.length}`);
  }
  if (Object.keys(fields).length || Object.keys(inc || {}).length) sets.push('"updated_at" = NOW()');
  const result = await query(`UPDATE ${table} SET ${sets.join(', ')}${where ? ` WHERE ${where}` : ''} RETURNING id`, values);
  return { matchedCount: result.rowCount, modifiedCount: result.rowCount };
}

export async function hapusData(tabel, filter, banyak = false) {
  const table = namaTabel(tabel), values = [];
  const where = kondisi(tabel, filter, values);
  const sql = banyak
    ? `DELETE FROM ${table}${where ? ` WHERE ${where}` : ''} RETURNING id`
    : `DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table}${where ? ` WHERE ${where}` : ''} LIMIT 1) RETURNING id`;
  const result = await query(sql, values);
  return { deletedCount: result.rowCount };
}

export async function pastikanPembeli({ $id, name, email }) {
  const options = { upsert: true, insertOnly: true };
  await ubahData('pengguna', { _id: $id }, { nama: name || 'Pengguna', email, no_telepon: '', status_akun: 'AKTIF', kanal: 'EMAIL', kontak_terverifikasi: true }, options);
  await ubahData('pembeli', { _id: $id }, { alamat: '' }, options);
  await ubahData('keranjang', { _id: $id }, { id_pembeli: $id, total_harga: 0 }, options);
}
