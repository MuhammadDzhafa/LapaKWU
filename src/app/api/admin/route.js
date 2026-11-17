import { svc, siapa, err, getRow, rows, put, upd, del, notif, baca, milik, ID, Query } from '@/lib/server';
export const dynamic = 'force-dynamic';

async function setPeran(db, users, id, peran, info = {}) {
  const ada = (tb) => getRow(db, tb, id).catch(() => null);
  for (const tb of ['pembeli', 'mitra', 'admin']) if (tb !== peran && (await ada(tb))) await del(db, tb, id);
  if (!(await ada(peran))) {
    if (peran === 'pembeli') await put(db, 'pembeli', id, { alamat: '' }, baca(id));
    if (peran === 'mitra') await put(db, 'mitra', id, { nama_usaha: info.nama_usaha || info.nama || 'Lapak Baru', alamat_usaha: info.alamat || '-' }, baca(id));
    if (peran === 'admin') await put(db, 'admin', id, { level_akses: 'ADMIN' }, baca(id));
  }
  if (peran === 'pembeli' && !(await getRow(db, 'keranjang', id).catch(() => null))) await put(db, 'keranjang', id, { id_pembeli: id, total_harga: 0 }, milik(id));
  if (users) {
    try {
      const t = await users.get({ userId: id }).catch(() => null);
      if (t) {
        const labels = t.labels.filter((l) => !['mitra', 'admin'].includes(l));
        if (peran !== 'pembeli') labels.push(peran);
        await users.updateLabels({ userId: id, labels });
      }
    } catch (e) { console.warn('[setPeran] updateLabels skipped:', e.message); }
  }
}

export async function POST(req) {
  const u = await siapa(req);
  if (!u) return err('Belum masuk.', 401);
  const { db, users } = svc();
  const isAdmin = u.labels?.includes('admin') || !!(await getRow(db, 'admin', u.$id).catch(() => null));
  if (!isAdmin) return err('Khusus admin.', 403);
  const b = await req.json();
  const { aksi, id, catatan } = b;
  const PERAN = ['pembeli', 'mitra', 'admin'];

  if (aksi === 'muat') {
    const [uRows, mRows, prRows, adRows, pbRows, rfRows] = await Promise.all([
      rows(db, 'pengguna', []),
      rows(db, 'mitra', []),
      rows(db, 'produk', []),
      rows(db, 'admin', []),
      rows(db, 'pembeli', []),
      rows(db, 'pembayaran', []),
    ]);

    // Sinkronisasi otomatis: bersihkan baris orphan jika user sudah dihapus dari Auth/Pengguna
    const validUserIds = new Set(uRows.map((u) => u.$id));
    const validMitras = [];
    for (const m of mRows) {
      if (validUserIds.has(m.$id)) {
        validMitras.push(m);
      } else {
        await del(db, 'mitra', m.$id).catch(() => {});
      }
    }
    const validPembeli = [];
    for (const p of pbRows) {
      if (validUserIds.has(p.$id)) {
        validPembeli.push(p);
      } else {
        await del(db, 'pembeli', p.$id).catch(() => {});
      }
    }

    const rf = rfRows.filter((x) => x.status_pembayaran === 'REFUND_DIAJUKAN');
    return Response.json({ u: uRows, m: validMitras, pr: prRows, ad: adRows, pb: validPembeli, rf });
  }

  if (aksi === 'cair') { // tandai pencairan komisi/saldo mitra sudah ditransfer
    const r = await getRow(db, 'rekap_penjualan', id).catch(() => null);
    if (!r || r.status_pencairan !== 'DIAJUKAN') return err('Rekap tidak dalam status diajukan.');
    await upd(db, 'rekap_penjualan', id, { status_pencairan: 'DICAIRKAN', tanggal_cair: new Date().toISOString(), catatan_cair: String(catatan || '').slice(0, 255) });
    await notif(db, r.id_mitra, 'Saldo sudah dicairkan', `Pencairan periode ${r.periode} sebesar Rp ${(r.total_digital - r.total_komisi).toLocaleString('id-ID')} sudah ditransfer ke rekeningmu.`, true);
    return Response.json({ ok: true });
  }
  if (aksi === 'refund') { // tandai dana pembeli sudah dikembalikan
    const by = await getRow(db, 'pembayaran', id).catch(() => null);
    if (!by || by.status_pembayaran !== 'REFUND_DIAJUKAN') return err('Pembayaran tidak dalam status refund.');
    const ps = await getRow(db, 'pesanan', by.id_pesanan);
    await upd(db, 'pembayaran', id, { status_pembayaran: 'DIKEMBALIKAN' });
    await notif(db, ps.id_pembeli, 'Dana dikembalikan', `Dana pesanan ${ps.$id.slice(-6)} sebesar Rp ${by.jumlah.toLocaleString('id-ID')} sudah dikembalikan.`, true);
    return Response.json({ ok: true });
  }
  if (aksi === 'tambah') {
    const { nama, email, password, peran, nama_usaha } = b;
    if (!String(nama || '').trim() || !email || String(password || '').length < 8) return err('Isi nama, email, dan kata sandi minimal 8 karakter.');
    if (!PERAN.includes(peran)) return err('Pilih peran.');
    if (peran === 'mitra' && !String(nama_usaha || '').trim()) return err('Isi nama usaha untuk mitra.');

    // Buat akun lewat Appwrite Account endpoint agar tidak terhalang scope users.write pada API Key
    const accRes = await fetch(`${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/account`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Appwrite-Project': process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
      },
      body: JSON.stringify({
        userId: ID.unique(),
        email,
        password,
        name: String(nama).trim(),
      }),
    });
    const nu = await accRes.json();
    if (!accRes.ok) {
      return err(nu.message || 'Gagal membuat akun pengguna.');
    }

    await put(db, 'pengguna', nu.$id, {
      nama: nu.name || String(nama).trim(),
      email,
      no_telepon: '',
      status_akun: 'AKTIF',
      kanal: 'EMAIL',
      kontak_terverifikasi: true,
    }, baca(nu.$id));

    await setPeran(db, users, nu.$id, peran, { nama_usaha, nama });
    return Response.json({ ok: true });
  }

  const t = await users.get({ userId: id }).catch(() => null);
  if (!t) {
    for (const tb of ['pembeli', 'mitra', 'admin', 'kode_verifikasi', 'pengguna', 'keranjang']) await del(db, tb, id).catch(() => {});
    return err('Akun pengguna ini sudah tidak ada di Appwrite Auth. Baris database telah dibersihkan.', 404);
  }
  const status = (s) => upd(db, 'pengguna', id, { status_akun: s });
  const label = (add) => users.updateLabels({ userId: id, labels: [...new Set(t.labels.filter((l) => l !== 'mitra').concat(add ? ['mitra'] : []))] }).catch((e) => console.warn('[admin] updateLabels skipped:', e.message));

  if (aksi === 'setuju_mitra') {
    const pg = await getRow(db, 'pengguna', id);
    await label(true);
    await upd(db, 'pengguna', id, { status_akun: 'AKTIF', kontak_terverifikasi: true });
    await upd(db, 'mitra', id, { id_admin_verifikator: u.$id, catatan_verifikasi: '' });
    await notif(db, id, 'Akun mitra aktif', 'Datamu sudah diverifikasi. Kamu bisa mulai menambah produk di menu Lapak saya.', true);
  } else if (aksi === 'tolak_mitra') {
    await label(false); await status('DITOLAK');
    await upd(db, 'mitra', id, { id_admin_verifikator: u.$id, catatan_verifikasi: String(catatan || 'Data perlu diperbaiki').slice(0, 500) });
    await notif(db, id, 'Data mitra perlu perbaikan', String(catatan || 'Data perlu diperbaiki'), true);
  } else if (aksi === 'ubah_peran') {
    if (id === u.$id) return err('Tidak bisa mengubah peran akunmu sendiri.');
    if (!PERAN.includes(b.peran)) return err('Peran tidak valid.');
    await setPeran(db, users, id, b.peran);
    if (b.peran !== 'pembeli') await status('AKTIF');
  } else if (aksi === 'blokir') {
    if (id === u.$id) return err('Tidak bisa memblokir akunmu sendiri.');
    await users.updateStatus({ userId: id, status: false }).catch(() => {}); await status('DIBLOKIR');
  } else if (aksi === 'aktifkan') {
    await users.updateStatus({ userId: id, status: true }).catch(() => {}); await status('AKTIF');
  } else if (aksi === 'hapus' || aksi === 'hapus_mitra') {
    if (id === u.$id) return err('Tidak bisa menghapus akunmu sendiri.');
    for (const tb of ['pembeli', 'mitra', 'admin', 'kode_verifikasi', 'pengguna', 'keranjang']) await del(db, tb, id).catch(() => {});
    await users.delete({ userId: id }).catch(() => {});
  } else return err('Aksi tidak dikenal.');
  return Response.json({ ok: true });
}
