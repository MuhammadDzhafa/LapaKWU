import { svc, siapa, err, getRow, put, upd, baca, milik } from '@/lib/server';
import { normHp } from '@/lib/kirim';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const u = await siapa(req);
  if (!u) return err('Sesi login tidak dikenali server.', 401);
  const b = await req.json();
  const { db, users } = svc();
  const s = (v, n = 255) => String(v || '').trim().slice(0, n);

  if (b.aksi === 'daftar') {
    if (await getRow(db, 'pengguna', u.$id).catch(() => null)) return Response.json({ ok: true });
    const kanal = b.kanal === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL';
    const hp = normHp(b.no_telepon);
    if (kanal === 'WHATSAPP' && !hp) return err('Isi nomor WhatsApp yang valid, misalnya 0812xxxxxxx.');
    if (b.peran === 'mitra' && !s(b.nama_usaha)) return err('Isi nama usaha.');
    await put(db, 'pengguna', u.$id, { nama: u.name, email: u.email, no_telepon: hp || '', status_akun: 'MENUNGGU_VERIFIKASI', kanal, kontak_terverifikasi: false }, baca(u.$id));
    if (b.peran === 'mitra') await put(db, 'mitra', u.$id, { nama_usaha: s(b.nama_usaha), alamat_usaha: s(b.alamat) }, baca(u.$id));
    else {
      await put(db, 'pembeli', u.$id, { alamat: s(b.alamat) }, baca(u.$id));
      await put(db, 'keranjang', u.$id, { id_pembeli: u.$id, total_harga: 0 }, milik(u.$id));
    }
    return Response.json({ ok: true });
  }

  // Pulihkan profil yang hilang atau tidak terbaca (mis. pendaftaran terputus setelah akun dibuat).
  if (b.aksi === 'pulihkan') {
    const adaAdmin = await getRow(db, 'admin', u.$id).catch(() => null);
    const pg0 = await getRow(db, 'pengguna', u.$id).catch(() => null);
    if (!pg0) {
      await put(db, 'pengguna', u.$id, { nama: u.name || u.email.split('@')[0], email: u.email, no_telepon: '', status_akun: adaAdmin ? 'AKTIF' : 'MENUNGGU_VERIFIKASI', kanal: 'EMAIL', kontak_terverifikasi: !!adaAdmin }, baca(u.$id));
    } else await db.updateRow({ databaseId: 'lapakwu', tableId: 'pengguna', rowId: u.$id, data: {}, permissions: baca(u.$id) }).catch(() => {});
    const mt = await getRow(db, 'mitra', u.$id).catch(() => null);
    const pb = await getRow(db, 'pembeli', u.$id).catch(() => null);
    if (mt) await db.updateRow({ databaseId: 'lapakwu', tableId: 'mitra', rowId: u.$id, data: {}, permissions: baca(u.$id) }).catch(() => {});
    else if (pb) await db.updateRow({ databaseId: 'lapakwu', tableId: 'pembeli', rowId: u.$id, data: {}, permissions: baca(u.$id) }).catch(() => {});
    else if (!adaAdmin) {
      await put(db, 'pembeli', u.$id, { alamat: '' }, baca(u.$id));
      if (!(await getRow(db, 'keranjang', u.$id).catch(() => null))) await put(db, 'keranjang', u.$id, { id_pembeli: u.$id, total_harga: 0 }, milik(u.$id));
    }
    return Response.json({ ok: true });
  }

  let pg = await getRow(db, 'pengguna', u.$id).catch(() => null);
  if (!pg) {
    const mt0 = await getRow(db, 'mitra', u.$id).catch(() => null);
    const pb0 = await getRow(db, 'pembeli', u.$id).catch(() => null);
    if (mt0 || pb0) {
      // Auto-heal profil pengguna jika terputus
      pg = await put(db, 'pengguna', u.$id, {
        nama: u.name || u.email.split('@')[0],
        email: u.email,
        no_telepon: '',
        status_akun: 'AKTIF',
        kanal: 'EMAIL',
        kontak_terverifikasi: true,
      }, baca(u.$id)).catch(() => null);
    }
  }
  if (!pg && ['nama', 'email', 'telepon', 'detail', 'hapus_qris'].includes(b.aksi)) return err('Profil tidak ditemukan.', 404);
  // Verifikasi ulang kontak setelah email/nomor verifikasi diganti
  const perluVerif = async () => {
    const pb = await getRow(db, 'pembeli', u.$id).catch(() => null);
    await upd(db, 'pengguna', u.$id, { kontak_terverifikasi: false, ...(pb ? { status_akun: 'MENUNGGU_VERIFIKASI' } : {}) });
  };

  if (b.aksi === 'nama') {
    const nama = s(b.nama, 100);
    if (!nama) return err('Nama tidak boleh kosong.');
    await users.updateName({ userId: u.$id, name: nama });
    await upd(db, 'pengguna', u.$id, { nama });
    return Response.json({ ok: true });
  }

  if (b.aksi === 'email') { // email akun sudah diganti di Appwrite oleh klien; di sini hanya disinkronkan
    await upd(db, 'pengguna', u.$id, { email: u.email });
    if (pg.kanal === 'EMAIL') { await perluVerif(); return Response.json({ ok: true, verifikasi: true }); }
    return Response.json({ ok: true });
  }

  if (b.aksi === 'telepon') {
    const kosong = !String(b.no_telepon || '').trim();
    const hp = normHp(b.no_telepon);
    if (kosong && pg.kanal === 'WHATSAPP') return err('Nomor WhatsApp wajib diisi karena dipakai untuk verifikasi.');
    if (!kosong && !hp) return err('Nomor telepon tidak valid. Contoh: 0812xxxxxxx.');
    await upd(db, 'pengguna', u.$id, { no_telepon: hp || '' });
    if (pg.kanal === 'WHATSAPP' && hp !== pg.no_telepon) { await perluVerif(); return Response.json({ ok: true, verifikasi: true }); }
    return Response.json({ ok: true });
  }

  if (b.aksi === 'detail') {
    const mt = await getRow(db, 'mitra', u.$id).catch(() => null);
    const pb = await getRow(db, 'pembeli', u.$id).catch(() => null);
    if (mt) {
      const d = {};
      if ('nama_usaha' in b) { if (!s(b.nama_usaha)) return err('Nama usaha tidak boleh kosong.'); d.nama_usaha = s(b.nama_usaha); }
      if ('alamat' in b) d.alamat_usaha = s(b.alamat);
      if ('rekening' in b) d.rekening = s(b.rekening, 100);
      if ('id_qris' in b) {
        if (!b.id_qris && mt.id_qris) {
          const { storage } = svc();
          await storage.deleteFile({ bucketId: 'gambar-produk', fileId: mt.id_qris }).catch(() => {});
        }
        d.id_qris = b.id_qris ? s(b.id_qris, 36) : null;
      }
      await upd(db, 'mitra', u.$id, d);
    } else if (pb && 'alamat' in b) await upd(db, 'pembeli', u.$id, { alamat: s(b.alamat) });
    return Response.json({ ok: true });
  }

  if (b.aksi === 'hapus_qris') {
    const mt = await getRow(db, 'mitra', u.$id).catch(() => null);
    if (!mt) return err('Data mitra tidak ditemukan.', 404);
    if (mt.id_qris) {
      const { storage } = svc();
      await storage.deleteFile({ bucketId: 'gambar-produk', fileId: mt.id_qris }).catch(() => {});
    }
    await upd(db, 'mitra', u.$id, { id_qris: null });
    return Response.json({ ok: true });
  }

  if (b.aksi === 'ubah') {
    const pg = await getRow(db, 'pengguna', u.$id).catch(() => null);
    if (!pg) return err('Profil tidak ditemukan.', 404);
    const nama = s(b.nama, 100);
    if (!nama) return err('Nama tidak boleh kosong.');
    const data = { nama };
    if (pg.kanal !== 'WHATSAPP') { // nomor WA dipakai untuk verifikasi, jadi tidak bisa diganti di sini
      if (b.no_telepon && !normHp(b.no_telepon)) return err('Nomor telepon tidak valid.');
      data.no_telepon = normHp(b.no_telepon) || '';
    }
    await users.updateName({ userId: u.$id, name: nama });
    await upd(db, 'pengguna', u.$id, data);
    if (await getRow(db, 'pembeli', u.$id).catch(() => null)) await upd(db, 'pembeli', u.$id, { alamat: s(b.alamat) });
    if (await getRow(db, 'mitra', u.$id).catch(() => null)) {
      if (!s(b.nama_usaha)) return err('Nama usaha tidak boleh kosong.');
      await upd(db, 'mitra', u.$id, { nama_usaha: s(b.nama_usaha), alamat_usaha: s(b.alamat), rekening: s(b.rekening, 100) });
    }
    return Response.json({ ok: true });
  }
  return err('Aksi tidak dikenal.');
}
