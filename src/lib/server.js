import { kabari } from '@/lib/kirim';
import { Client, Account, TablesDB, Users, Query, ID, Permission, Role } from 'node-appwrite';
export { Query, ID, Permission, Role };

// Patch kompatibilitas undici Node.js untuk node-appwrite
const origPrepare = Client.prototype.prepareRequest;
if (origPrepare) {
  Client.prototype.prepareRequest = function (...args) {
    const res = origPrepare.apply(this, args);
    if (res?.options) {
      delete res.options.dispatcher;
      delete res.options.agent;
    }
    return res;
  };
}

export const DB = 'lapakwu';
const E = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const P = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

export const svc = () => {
  const c = new Client().setEndpoint(E).setProject(P).setKey(process.env.APPWRITE_API_KEY);
  return { db: new TablesDB(c), users: new Users(c) };
};
export const siapa = async (req) => {
  const j = req.headers.get('x-jwt');
  if (!j) return null;
  try { return await new Account(new Client().setEndpoint(E).setProject(P).setJWT(j)).get(); }
  catch (e) { console.error('[siapa] JWT ditolak Appwrite:', e.code, e.type, e.message); return null; }
};
export const err = (m, s = 400) => Response.json({ error: m }, { status: s });
export const baca = (...ids) => ids.map((i) => Permission.read(Role.user(i)));
export const milik = (uid) => [Permission.read(Role.user(uid)), Permission.update(Role.user(uid)), Permission.delete(Role.user(uid))];

export const getRow = (db, t, id) => db.getRow({ databaseId: DB, tableId: t, rowId: id });
export const rows = async (db, t, q = []) => (await db.listRows({ databaseId: DB, tableId: t, queries: [Query.limit(100), ...q] })).rows;
export const put = (db, t, id, data, permissions) => db.createRow({ databaseId: DB, tableId: t, rowId: id, data, permissions });
export const upd = (db, t, id, data) => db.updateRow({ databaseId: DB, tableId: t, rowId: id, data });
export const del = (db, t, id) => db.deleteRow({ databaseId: DB, tableId: t, rowId: id });
export const dec = (db, t, id, column, value) => db.decrementRowColumn({ databaseId: DB, tableId: t, rowId: id, column, value, min: 0 });
export const inc = (db, t, id, column, value) => db.incrementRowColumn({ databaseId: DB, tableId: t, rowId: id, column, value });
// Notifikasi dalam aplikasi; kalau luar=true, dikirim juga ke email/WhatsApp sesuai pilihan pengguna.
export async function notif(db, uid, judul, pesan, luar = false) {
  await put(db, 'notifikasi', ID.unique(), { id_pengguna: uid, judul, pesan, waktu_kirim: new Date().toISOString(), sudah_dibaca: false },
    [Permission.read(Role.user(uid)), Permission.update(Role.user(uid))]);
  if (luar) { const pg = await getRow(db, 'pengguna', uid).catch(() => null); if (pg) await kabari(pg, judul, pesan).catch(() => {}); }
}
