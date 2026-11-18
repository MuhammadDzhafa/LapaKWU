import { denganTransaksi } from '@/lib/db';
import { siapa, err, getRow, rows, put, upd, del, inc, notif, Query } from '@/lib/server';
import { buatAkun, cariAkunByEmail, hapusAkun, ubahPassword } from '@/lib/auth';
import { nanoid } from 'nanoid';
export const dynamic = 'force-dynamic';

async function setPeran(id, peran, info = {}) {
  const ada = (tb) => getRow(null, tb, id).catch(() => null);
  for (const tb of ['pembeli', 'mitra', 'admin']) if (tb !== peran && (await ada(tb))) await del(null, tb, id);
  if (!(await ada(peran))) {
    if (peran === 'pembeli') await put(null, 'pembeli', id, { alamat: '' }, []);
    if (peran === 'mitra') await put(null, 'mitra', id, { nama_usaha: info.nama_usaha || info.nama || 'Lapak Baru', alamat_usaha: info.alamat || '-' }, []);
    if (peran === 'admin') await put(null, 'admin', id, { level_akses: 'ADMIN' }, []);
  }
  if (peran === 'pembeli' && !(await getRow(null, 'keranjang', id).catch(() => null)))
    await put(null, 'keranjang', id, { id_pembeli: id, total_harga: 0 }, []);
}

export async function POST(req) {
  try {
  const u = await siapa(req);
  if (!u) return err('Belum masuk.', 401);
  const mtRow = await getRow(null, 'mitra', u.$id).catch(() => null);
  if (mtRow) return err('Akses ditolak. Akun mitra tidak memiliki hak akses admin.', 403);
  const adRow = await getRow(null, 'admin', u.$id).catch(() => null);
  if (!adRow) return err('Khusus admin.', 403);
  const b = await req.json();
  const { aksi, id, catatan } = b;
  const PERAN = ['pembeli', 'mitra', 'admin'];

  if (aksi === 'muat') {
    const [uRows, mRows, prRows, adRows, pbRows, rfRows] = await Promise.all([
      rows(null, 'pengguna', []),
      rows(null, 'mitra', []),
      rows(null, 'produk', []),
      rows(null, 'admin', []),
      rows(null, 'pembeli', []),
      rows(null, 'pembayaran', []),
    ]);

    const idsPeran = [...new Set([...mRows, ...pbRows].map((row) => row.$id))];
    const penggunaPeran = await rows(null, 'pengguna', [Query.equal('$id', idsPeran), Query.limit(idsPeran.length)]);
    const validUserIds = new Set(penggunaPeran.map((row) => row.$id));
    const validMitras = mRows.filter((row) => validUserIds.has(row.$id));
    const validPembeli = pbRows.filter((row) => validUserIds.has(row.$id));

    const rf = rfRows.filter((x) => x.status_pembayaran === 'REFUND_DIAJUKAN');
    const qrisPending = rfRows.filter((x) => x.metode === 'QRIS' && x.status_pembayaran === 'MENUNGGU');
    const qrisOrders = qrisPending.length ? await rows(null, 'pesanan', [Query.equal('id', qrisPending.map((q) => q.id_pesanan))]) : [];
    const qris = qrisPending.map((by) => ({ ...by, pesanan: qrisOrders.find((p) => p.$id === by.id_pesanan) || null }));

    return Response.json({ u: uRows, m: validMitras, pr: prRows, ad: adRows, pb: validPembeli, rf, qris });
  }

  return await denganTransaksi(async () => {
    if (aksi === 'verifikasi_qris') {
      const by = await getRow(null, 'pembayaran', id).catch(() => null);
      if (by?.metode !== 'QRIS' || by.status_pembayaran !== 'MENUNGGU') return err('Pembayaran QRIS tidak dalam status menunggu.');
      const ps = await getRow(null, 'pesanan', by.id_pesanan).catch(() => null);
      if (!ps || ps.status_pesanan === 'DIBATALKAN') return err('Pesanan sudah dibatalkan atau tidak ditemukan.', 409);
      const now = new Date().toISOString();
      await upd(null, 'pembayaran', id, { status_pembayaran: 'BERHASIL', waktu_bayar: now });
      if (ps.status_pesanan === 'MENUNGGU_KONFIRMASI') await upd(null, 'pesanan', ps.$id, { status_pesanan: 'DIPROSES' });
      const noPesanan = by.id_pesanan.slice(-6);
      if (ps?.id_mitra) await notif(null, ps.id_mitra, 'Pembayaran QRIS Diverifikasi Admin!', `Pesanan #${noPesanan} sebesar Rp ${by.jumlah.toLocaleString('id-ID')} telah diverifikasi lunas oleh Admin. Silakan siapkan pesanan pembeli!`, true);
      if (ps?.id_pembeli) await notif(null, ps.id_pembeli, 'Pembayaran QRIS Diterima & Invoice Terbit!', `Pembayaran pesanan #${noPesanan} telah diverifikasi. Invoice resmi sudah terbit di menu Riwayat Pesanan.`, true);
      return Response.json({ ok: true });
    }

    if (aksi === 'tolak_qris') {
      const by = await getRow(null, 'pembayaran', id).catch(() => null);
      if (by?.metode !== 'QRIS' || by.status_pembayaran !== 'MENUNGGU') return err('Pembayaran QRIS tidak dalam status menunggu.');
      const ps = await getRow(null, 'pesanan', by.id_pesanan).catch(() => null);
      if (!ps || ps.status_pesanan === 'DIBATALKAN') return err('Pesanan sudah dibatalkan atau tidak ditemukan.', 409);
      await upd(null, 'pembayaran', id, { status_pembayaran: 'GAGAL' });
      await upd(null, 'pesanan', ps.$id, { status_pesanan: 'DIBATALKAN', alasan_pembatalan: catatan || 'Pembayaran ditolak admin (bukti/saldo tidak masuk).' });
      const details = await rows(null, 'detail_pesanan', [Query.equal('id_pesanan', ps.$id)]);
      for (const d of details) await inc(null, 'produk', d.id_produk, 'stok', d.jumlah);
      await notif(null, ps.id_pembeli, 'Pembayaran QRIS Ditolak', `Pembayaran pesanan #${ps.$id.slice(-6)} ditolak admin: ${catatan || 'Bukti transfer tidak valid'}. Stok telah dikembalikan.`, true);
      return Response.json({ ok: true });
    }

    if (aksi === 'cair') {
      const r = await getRow(null, 'rekap_penjualan', id).catch(() => null);
      if (!r || r.status_pencairan !== 'DIAJUKAN') return err('Rekap tidak dalam status diajukan.');
      await upd(null, 'rekap_penjualan', id, { status_pencairan: 'DICAIRKAN', tanggal_cair: new Date().toISOString(), catatan_cair: String(catatan || '').slice(0, 255) });
      await notif(null, r.id_mitra, 'Saldo sudah dicairkan', `Pencairan periode ${r.periode} sebesar Rp ${(r.total_digital - r.total_komisi).toLocaleString('id-ID')} sudah ditransfer ke rekeningmu.`, true);
      return Response.json({ ok: true });
    }

    if (aksi === 'refund') {
      const by = await getRow(null, 'pembayaran', id).catch(() => null);
      if (!by || by.status_pembayaran !== 'REFUND_DIAJUKAN') return err('Pembayaran tidak dalam status refund.');
      const ps = await getRow(null, 'pesanan', by.id_pesanan);
      await upd(null, 'pembayaran', id, { status_pembayaran: 'DIKEMBALIKAN' });
      await notif(null, ps.id_pembeli, 'Dana dikembalikan', `Dana pesanan ${ps.$id.slice(-6)} sebesar Rp ${by.jumlah.toLocaleString('id-ID')} sudah dikembalikan.`, true);
      return Response.json({ ok: true });
    }

    if (aksi === 'tambah') {
      const { nama, email, password, peran, nama_usaha } = b;
      if (!String(nama || '').trim() || !email || String(password || '').length < 8) return err('Isi nama, email, dan kata sandi minimal 8 karakter.');
      if (!PERAN.includes(peran)) return err('Pilih peran.');
      if (peran === 'mitra' && !String(nama_usaha || '').trim()) return err('Isi nama usaha untuk mitra.');

      const ada = await cariAkunByEmail(email.trim().toLowerCase());
      if (ada) return err('Email sudah terdaftar.');
      const uid = nanoid();
      await buatAkun({ id: uid, email: email.trim().toLowerCase(), password, nama: String(nama).trim() });
      await put(null, 'pengguna', uid, { nama: String(nama).trim(), email: email.trim().toLowerCase(), no_telepon: '', status_akun: 'AKTIF', kanal: 'EMAIL', kontak_terverifikasi: true }, []);
      await setPeran(uid, peran, { nama_usaha, nama });
      return Response.json({ ok: true });
    }

    // Cek user ada di DB kita
    const pgTarget = await getRow(null, 'pengguna', id).catch(() => null);
    if (!pgTarget) {
      for (const tb of ['pembeli', 'mitra', 'admin', 'kode_verifikasi', 'pengguna', 'keranjang']) await del(null, tb, id).catch(() => {});
      return err('Akun tidak ditemukan di database.', 404);
    }
    const status = (s) => upd(null, 'pengguna', id, { status_akun: s });

    if (aksi === 'setuju_mitra') {
      await upd(null, 'pengguna', id, { status_akun: 'AKTIF', kontak_terverifikasi: true });
      await upd(null, 'mitra', id, { id_admin_verifikator: u.$id, catatan_verifikasi: '' });
      await notif(null, id, 'Akun mitra aktif', 'Datamu sudah diverifikasi. Kamu bisa mulai menambah produk di menu Lapak saya.', true);
    } else if (aksi === 'tolak_mitra') {
      await status('DITOLAK');
      await upd(null, 'mitra', id, { id_admin_verifikator: u.$id, catatan_verifikasi: String(catatan || 'Data perlu diperbaiki').slice(0, 500) });
      await notif(null, id, 'Data mitra perlu perbaikan', String(catatan || 'Data perlu diperbaiki'), true);
    } else if (aksi === 'ubah_peran') {
      if (id === u.$id) return err('Tidak bisa mengubah peran akunmu sendiri.');
      if (!PERAN.includes(b.peran)) return err('Peran tidak valid.');
      await setPeran(id, b.peran);
      if (b.peran !== 'pembeli') await status('AKTIF');
    } else if (aksi === 'blokir') {
      if (id === u.$id) return err('Tidak bisa memblokir akunmu sendiri.');
      await status('DIBLOKIR');
    } else if (aksi === 'aktifkan') {
      await status('AKTIF');
    } else if (aksi === 'hapus' || aksi === 'hapus_mitra') {
      if (id === u.$id) return err('Tidak bisa menghapus akunmu sendiri.');
      await hapusAkun(id);
    } else return err('Aksi tidak dikenal.');

    return Response.json({ ok: true });
  });
  } catch (e) {
    if (e.code === 409) return err(e.message, 409);
    console.error('[/api/admin] unhandled error:', e?.message || e);
    return err('Terjadi kesalahan server. Coba lagi.', 500);
  }
}
