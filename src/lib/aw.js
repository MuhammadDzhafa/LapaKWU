// src/lib/aw.js — Pengganti Appwrite client SDK (browser-side)
// Semua panggilan ke Appwrite diganti dengan fetch ke API routes Next.js sendiri.

export const EP = ''; // tidak dipakai lagi
export const PID = '';
export const DB = 'lapakwu';
export const BUCKET = 'gambar-produk';

// ── Format helper ──────────────────────────────────────────
export const rp = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
export const tgl = (d) =>
  new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

// URL gambar produk — sekarang file di-serve dari /uploads/<id>
export const img = (id) => (
  typeof id === 'string' && id ? (id.startsWith('bukti-') ? `/api/bukti/${encodeURIComponent(id)}` : `/uploads/${id}`) : null
);

// ── account — pengganti Appwrite Account ──────────────────
export const account = {
  /** Ambil data user yang sedang login dari session cookie */
  async get() {
    const r = await fetch('/api/auth/saya');
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw Object.assign(new Error(data.error || 'Gagal memeriksa sesi.'), { code: r.status });
    }
    return r.json(); // { $id, name, email, ... }
  },

  /** Login email + password */
  async createEmailPasswordSession({ email, password }) {
    const r = await fetch('/api/auth/masuk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(d.error || 'Login gagal.');
      err.code = r.status;
      err.type = d.type;
      err.notFound = !!d.notFound;
      throw err;
    }
    return d;
  },

  /** Daftar akun baru */
  async create({ userId, email, password, name }) {
    const r = await fetch('/api/auth/daftar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, email, password, nama: name }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Pendaftaran gagal.');
    return d;
  },

  /** Logout — hapus cookie sesi */
  async deleteSession({ sessionId: _ }) {
    await fetch('/api/auth/keluar', { method: 'POST' });
  },

  /** Update password dengan password lama */
  async updatePassword({ password, oldPassword }) {
    const r = await fetch('/api/auth/ganti-sandi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sandiLama: oldPassword, sandiBaru: password }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Gagal mengubah kata sandi.');
    return d;
  },

  /** Update email dengan verifikasi password */
  async updateEmail({ email, password }) {
    const r = await fetch('/api/auth/ubah-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ emailBaru: email, password }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Gagal mengubah email.');
    return d;
  },

  /** Buat JWT untuk otorisasi API (tidak diperlukan lagi — sesi pakai cookie) */
  async createJWT() {
    // Stub untuk kompatibilitas: kembalikan string kosong
    // Cookie HttpOnly sudah dikirim otomatis oleh browser
    return { jwt: '' };
  },
};

// ── db helpers (browser → API route) ──────────────────────
export const ambil = async (tabel, id) => {
  const r = await fetch(`/api/db/${tabel}/${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error('Not found');
  return r.json();
};

export const list = async (tabel, queries = []) => {
  const r = await fetch('/api/db/list', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tabel, queries }),
  });
  if (!r.ok) throw new Error('Gagal ambil data.');
  const d = await r.json();
  return d.rows;
};

export const buat = async (tabel, data) => {
  const r = await fetch('/api/db/buat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tabel, data }),
  });
  if (!r.ok) throw new Error('Gagal buat data.');
  return r.json();
};

export const ubah = async (tabel, id, data) => {
  const r = await fetch('/api/db/ubah', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tabel, id, data }),
  });
  if (!r.ok) throw new Error('Gagal ubah data.');
  return r.json();
};

export const hapus = async (tabel, id) => {
  const r = await fetch('/api/db/hapus', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tabel, id }),
  });
  if (!r.ok) throw new Error('Gagal hapus data.');
  return r.json();
};

// ── Keranjang helpers ──────────────────────────────────────
export async function hitungKeranjang(uid) {
  const it = await list('item_keranjang', [{ type: 'eq', col: 'id_keranjang', val: uid }]);
  const total = it.reduce((a, i) => a + (i.subtotal || 0), 0);
  try { await ubah('keranjang', uid, { total_harga: total }); }
  catch { await buat('keranjang', { id: uid, id_pembeli: uid, total_harga: total }); }
  return total;
}

export async function ubahJumlahKeranjang(uid, p, delta = 1) {
  try {
    await buat('keranjang', { id: uid, id_pembeli: uid, total_harga: 0 });
  } catch {}

  const itList = await list('item_keranjang', [{ type: 'eq', col: 'id_keranjang', val: uid }]);
  const it = itList.find((i) => i.id_produk === p.$id);
  const curJml = it?.jumlah || 0;
  const newJml = Math.min(curJml + delta, p.stok || 9999);

  if (newJml <= 0) {
    if (it) await hapus('item_keranjang', it.$id);
    await hitungKeranjang(uid);
    return 0;
  }

  const data = { jumlah: newJml, subtotal: newJml * p.harga };
  if (it) await ubah('item_keranjang', it.$id, data);
  else await buat('item_keranjang', { id_keranjang: uid, id_produk: p.$id, ...data });
  await hitungKeranjang(uid);
  return newJml;
}

export async function tambahKeranjang(uid, p, n = 1) {
  return ubahJumlahKeranjang(uid, p, n);
}

// ── API caller (tidak perlu JWT lagi — cookie dikirim otomatis) ───
export async function api(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Permintaan gagal.');
  return d;
}

// ── Storage helper (upload ke /api/upload) ─────────────────
export const storage = {
  async createFile(arg1, arg2, arg3) {
    // Dukung format object { bucketId, fileId, file } maupun positional (bucketId, fileId, file)
    let file = null;
    if (arg1 && typeof arg1 === 'object' && arg1.file) {
      file = arg1.file;
    } else if (arg3) {
      file = arg3;
    } else if (arg1 instanceof Blob || (typeof File !== 'undefined' && arg1 instanceof File)) {
      file = arg1;
    }

    if (!file) throw new Error('File tidak valid untuk diunggah.');

    const fd = new FormData();
    fd.append('file', file);
    if (arg1?.jenis) fd.append('jenis', arg1.jenis);
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Upload gagal.');
    return d; // { $id: namaFile }
  },
  async deleteFile(arg1, arg2) {
    const fileId = typeof arg1 === 'object' ? arg1.fileId : (arg2 || arg1);
    if (!fileId) return;
    await fetch('/api/upload/hapus', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: fileId }),
    });
  },
};

// ── Misc exports (agar import lama tidak break) ────────────
export const ID = { unique: () => Math.random().toString(36).slice(2) + Date.now().toString(36) };
export const Query = {
  equal: (col, val) => ({ type: 'eq', col, val }),
  limit: (n) => ({ type: 'limit', n }),
  orderDesc: (col) => ({ type: 'orderDesc', col }),
};
export const Permission = { read: () => '', update: () => '', delete: () => '' };
export const Role = { user: (id) => id, any: () => '*', users: () => 'users', label: (l) => l };
export const milik = (_uid) => [];
