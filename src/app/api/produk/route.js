import { svc, siapa, err, getRow, put, upd, del, ID, Permission, Role } from '@/lib/server';
export const dynamic = 'force-dynamic';

// Kelola produk mitra: tambah, ubah, hapus.
// Semua operasi dijalankan server-side dengan API key sehingga tidak terkena
// batasan permission tabel (label:mitra) yang tidak bisa diset dari klien.

export async function POST(req) {
  try {
  const u = await siapa(req);
  if (!u) return err('Belum masuk.', 401);

  const b = await req.json();
  const { db } = svc();

  // Pastikan akun aktif dan merupakan mitra
  const pg = await getRow(db, 'pengguna', u.$id).catch(() => null);
  if (!pg || pg.status_akun !== 'AKTIF') return err('Akun mitra belum aktif.', 403);
  if (!(await getRow(db, 'mitra', u.$id).catch(() => null))) return err('Hanya mitra yang bisa mengelola produk.', 403);

  // ── Tambah produk ──────────────────────────────────────────────────
  if (b.aksi === 'tambah') {
    const { nama, harga, kategori, deskripsi, stok, id_gambar } = b;
    if (!nama || harga == null || !kategori || stok == null) return err('Data produk tidak lengkap.');
    const data = { id_mitra: u.$id, nama, harga: +harga, kategori, deskripsi: deskripsi || '', stok: +stok };
    if (id_gambar) data.id_gambar = id_gambar;
    const row = await put(db, 'produk', ID.unique(), data, [
      Permission.read(Role.any()),
      Permission.update(Role.user(u.$id)),
      Permission.delete(Role.user(u.$id)),
    ]);
    return Response.json({ ok: true, id: row.$id });
  }

  // ── Ubah harga / stok / nama / deskripsi ──────────────────────────
  if (b.aksi === 'ubah') {
    const p = await getRow(db, 'produk', String(b.id || '')).catch(() => null);
    if (!p || p.id_mitra !== u.$id) return err('Produk tidak ditemukan.', 404);
    const data = {};
    if (b.nama != null) data.nama = b.nama;
    if (b.harga != null) data.harga = +b.harga;
    if (b.stok != null) data.stok = +b.stok;
    if (b.deskripsi != null) data.deskripsi = b.deskripsi;
    if (b.kategori != null) data.kategori = b.kategori;
    if (b.id_gambar != null) data.id_gambar = b.id_gambar;
    await upd(db, 'produk', p.$id, data);
    return Response.json({ ok: true });
  }

  // ── Hapus produk ──────────────────────────────────────────────────
  if (b.aksi === 'hapus') {
    const p = await getRow(db, 'produk', String(b.id || '')).catch(() => null);
    if (!p || p.id_mitra !== u.$id) return err('Produk tidak ditemukan.', 404);
    await del(db, 'produk', p.$id);
    return Response.json({ ok: true });
  }

  return err('Aksi tidak dikenal.');
  } catch (e) {
    console.error('[/api/produk] unhandled error:', e?.message || e);
    return err('Terjadi kesalahan server. Coba lagi.', 500);
  }
}
