import { cariBanyak, cariSatu, denganTransaksi, kunciPesanan, queryDatabase, ubahData } from '@/lib/db';
import { siapa, err, getRow, rows, put, upd, del, inc, notif, Query } from '@/lib/server';
import { buatAkun, cariAkunByEmail, hapusAkun } from '@/lib/auth';
import { nanoid } from 'nanoid';
import { JUMLAH_TENANT, nomorTenantValid } from '@/lib/tenant';
import { arsipProduk } from '@/lib/arsip-produk';
export const dynamic = 'force-dynamic';

async function setPeran(id, peran, info = {}) {
  const ada = (tb) => getRow(null, tb, id).catch(() => null);
  for (const tb of ['pembeli', 'mitra', 'admin']) if (tb !== peran && (await ada(tb))) await del(null, tb, id);
  if (!(await ada(peran))) {
    if (peran === 'pembeli') await put(null, 'pembeli', id, {}, []);
    if (peran === 'mitra') await put(null, 'mitra', id, { nama_usaha: info.nama_usaha || info.nama || 'Lapak Baru' }, []);
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

  if (aksi === 'daftar_pencairan') {
    const pencairan = await cariBanyak('pencairan_dompet', { status: 'DIAJUKAN' }, { sort: { created_at: 1 }, limit: 50 });
    return Response.json({ pencairan });
  }

  if (aksi === 'muat') {
    const offset = Number.isSafeInteger(b.offset) && b.offset >= 0 ? Math.min(b.offset, 1_000_000) : 0;
    const halaman = (tabel) => [Query.limit(500), Query.offset(offset)];
    const [uRows, mRows, prRows, adRows, pbRows, rfRows] = await Promise.all([
      rows(null, 'pengguna', halaman('pengguna')),
      rows(null, 'mitra', halaman('mitra')),
      rows(null, 'produk', [Query.orderAsc('diarsipkan'), ...halaman('produk')]),
      rows(null, 'admin', halaman('admin')),
      rows(null, 'pembeli', halaman('pembeli')),
      rows(null, 'pembayaran', [Query.equal('status_pembayaran', ['MENUNGGU', 'REFUND_DIAJUKAN']), ...halaman('pembayaran')]),
    ]);

    const { rows: peranPengguna } = await queryDatabase(
      `SELECT p.id, CASE WHEN m.id IS NOT NULL THEN 'mitra'
                         WHEN a.id IS NOT NULL THEN 'admin'
                         ELSE 'pembeli' END AS peran
       FROM pengguna p LEFT JOIN mitra m ON m.id = p.id LEFT JOIN admin a ON a.id = p.id
       WHERE p.id = ANY($1::text[])`,
      [uRows.map((row) => row.$id)]
    );
    const peran = Object.fromEntries(peranPengguna.map(({ id, peran }) => [id, peran]));

    const rf = rfRows.filter((x) => x.status_pembayaran === 'REFUND_DIAJUKAN');
    const qrisPending = rfRows.filter((x) => x.metode === 'QRIS' && x.status_pembayaran === 'MENUNGGU');
    const idsBukti = [...new Set(qrisPending.map((by) => by.id_bukti_checkout).filter(Boolean))];
    const [qrisOrders, buktiCheckout] = await Promise.all([
      qrisPending.length ? rows(null, 'pesanan', [Query.equal('id', qrisPending.map((q) => q.id_pesanan)), Query.limit(500)]) : [],
      idsBukti.length ? cariBanyak('bukti_checkout', { _id: { $in: idsBukti } }, { limit: 5000 }) : [],
    ]);
    const pesananPerId = new Map(qrisOrders.map((pesanan) => [pesanan.$id, pesanan]));
    const buktiPerId = new Map(buktiCheckout.map((bukti) => [bukti.id, bukti]));
    const qris = qrisPending.map((by) => ({
      ...by,
      pesanan: pesananPerId.get(by.id_pesanan) || null,
      dana_terdeteksi: Boolean(buktiPerId.get(by.id_bukti_checkout)?.waktu_dana_masuk),
    }));

    return Response.json({ u: uRows, m: mRows, pr: prRows, ad: adRows, pb: pbRows, peran, rf, qris,
      hasMore: [uRows, mRows, prRows, adRows, pbRows, rfRows].some((page) => page.length === 500), offset });
  }

  if (aksi === 'hapus_produk') {
    if (typeof id !== 'string' || !await arsipProduk(id)) return err('Produk tidak ditemukan.', 404);
    return Response.json({ ok: true });
  }

  if (aksi === 'atur_tenant') {
    const { nomor_tenant } = b;
    if (nomor_tenant !== null && !nomorTenantValid(nomor_tenant)) return err(`Nomor tenant harus antara 1 dan ${JUMLAH_TENANT}.`);
    const mitra = await getRow(null, 'mitra', id).catch((error) => {
      if (error.code === 404) return null;
      throw error;
    });
    if (!mitra) return err('Mitra tidak ditemukan.', 404);
    await upd(null, 'mitra', mitra.$id, { nomor_tenant });
    return Response.json({ ok: true });
  }

  return await denganTransaksi(async () => {
    async function pembayaranTerkunci() {
      if (typeof id !== 'string') return null;
      const awal = await cariSatu('pembayaran', { _id: id });
      if (!awal || !await kunciPesanan(awal.id_pesanan)) return null;
      return getRow(null, 'pembayaran', id);
    }
    if (aksi === 'verifikasi_qris') {
      const by = await pembayaranTerkunci();
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
      const by = await pembayaranTerkunci();
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

    if (aksi === 'konfirmasi_pencairan') {
      if (b.sudah_dibayar !== true) return err('Lakukan pembayaran manual terlebih dahulu, lalu konfirmasikan.', 400);
      if (typeof id !== 'string') return err('ID pencairan tidak valid.');
      const pengajuan = await cariSatu('pencairan_dompet', { _id: id });
      if (!pengajuan) return err('Pengajuan tidak ditemukan.', 404);
      if (pengajuan.status === 'DICAIRKAN') return Response.json({ ok: true });
      if (pengajuan.status !== 'DIAJUKAN') return err('Pencairan tidak dalam status diajukan.', 409);
      const perubahan = await ubahData('pencairan_dompet', { _id: id, status: 'DIAJUKAN' }, {
        status: 'DICAIRKAN', tanggal_cair: new Date(), id_admin: u.$id,
      });
      if (!perubahan.matchedCount) return Response.json({ ok: true });
      await notif(null, pengajuan.id_mitra, 'Saldo sudah dicairkan',
        'Admin telah mencatat pencairan manual melalui QRIS sebesar Rp' + pengajuan.nominal.toLocaleString('id-ID') + '.');
      return Response.json({ ok: true });
    }

    if (aksi === 'refund') {
      if (b.sudah_ditransfer !== true) return err('Lakukan refund manual terlebih dahulu, lalu konfirmasikan.', 400);
      const by = await pembayaranTerkunci();
      if (!by || by.status_pembayaran !== 'REFUND_DIAJUKAN') return err('Pembayaran tidak dalam status refund.');
      const ps = await getRow(null, 'pesanan', by.id_pesanan);
      await upd(null, 'pembayaran', id, { status_pembayaran: 'DIKEMBALIKAN' });
      await notif(null, ps.id_pembeli, 'Refund dicatat admin', `Admin telah mencatat refund manual pesanan ${ps.$id.slice(-6)} sebesar Rp ${by.jumlah.toLocaleString('id-ID')}.`, true);
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
      const hasilHapus = await hapusAkun(id);
      return Response.json({ ok: true, ...hasilHapus });
    } else return err('Aksi tidak dikenal.');

    return Response.json({ ok: true });
  });
  } catch (e) {
    if (e.code === 409) return err(e.message, 409);
    console.error('[/api/admin] unhandled error:', e?.message || e);
    return err('Terjadi kesalahan server. Coba lagi.', 500);
  }
}
