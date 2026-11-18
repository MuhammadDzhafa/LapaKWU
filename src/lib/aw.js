import { Client, Account, TablesDB, Storage, ID, Query, Permission, Role } from 'appwrite';

export const EP = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
export const PID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
export const DB = 'lapakwu';
export const BUCKET = 'gambar-produk';

const client = new Client().setEndpoint(EP).setProject(PID);
export const account = new Account(client);
export const db = new TablesDB(client);
export const storage = new Storage(client);
export { ID, Query, Permission, Role };

export const rp = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
export const tgl = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
export const img = (id) => (id ? `${EP}/storage/buckets/${BUCKET}/files/${id}/view?project=${PID}` : null);
export const milik = (uid) => [Permission.read(Role.user(uid)), Permission.update(Role.user(uid)), Permission.delete(Role.user(uid))];

export const list = async (tableId, queries = []) =>
  (await db.listRows({ databaseId: DB, tableId, queries: [Query.limit(100), ...queries] })).rows;
export const ambil = (tableId, rowId) => db.getRow({ databaseId: DB, tableId, rowId });
export const ubah = (tableId, rowId, data) => db.updateRow({ databaseId: DB, tableId, rowId, data });
export const buat = (tableId, data, permissions) => db.createRow({ databaseId: DB, tableId, rowId: ID.unique(), data, permissions });
export const hapus = (tableId, rowId) => db.deleteRow({ databaseId: DB, tableId, rowId });

export async function hitungKeranjang(uid) {
  const it = await list('item_keranjang', [Query.equal('id_keranjang', uid)]);
  const total = it.reduce((a, i) => a + i.subtotal, 0);
  try {
    await ubah('keranjang', uid, { total_harga: total });
  } catch {
    await db.createRow({ databaseId: DB, tableId: 'keranjang', rowId: uid, data: { id_pembeli: uid, total_harga: total }, permissions: milik(uid) }).catch(() => {});
  }
  return total;
}

export async function tambahKeranjang(uid, p, n = 1) {
  const it = (await list('item_keranjang', [Query.equal('id_keranjang', uid)])).find((i) => i.id_produk === p.$id);
  const jml = Math.min((it?.jumlah || 0) + n, p.stok);
  const data = { jumlah: jml, subtotal: jml * p.harga };
  if (it) await ubah('item_keranjang', it.$id, data);
  else await buat('item_keranjang', { id_keranjang: uid, id_produk: p.$id, ...data }, milik(uid));
  await hitungKeranjang(uid);
  return jml;
}

// Panggil route server (aturan bisnis yang butuh hak lebih tinggi) dengan JWT pengguna.
let jwtCache = { jwt: '', exp: 0 }; // JWT berlaku 15 menit; di-cache supaya tap +/- beruntun tidak kena rate limit createJWT
export async function api(path, body, ulang = true) {
  if (Date.now() > jwtCache.exp) jwtCache = { jwt: (await account.createJWT()).jwt, exp: Date.now() + 10 * 60 * 1000 };
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-jwt': jwtCache.jwt }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) {
    jwtCache.exp = 0; // JWT basi atau milik sesi lama: buat baru lalu coba sekali lagi
    if (ulang) return api(path, body, false);
  }
  if (!r.ok) throw new Error(d.error || 'Permintaan gagal.');
  return d;
}
