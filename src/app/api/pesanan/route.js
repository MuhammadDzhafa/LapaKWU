import { svc, siapa, err, getRow, rows, put, upd, inc, notif, ID, Query, Permission, Role } from '@/lib/server';
export const dynamic = 'force-dynamic';

// aksi -> [status asal, status baru, jenis yang diizinkan]
const ALUR = {
  terima: [['MENUNGGU_KONFIRMASI'], 'DIPROSES'],
  tolak: [['MENUNGGU_KONFIRMASI', 'DIPROSES'], 'DIBATALKAN'],
  batal: [['MENUNGGU_KONFIRMASI', 'DIPROSES'], 'DIBATALKAN'], // oleh pembeli
  kirim: [['DIPROSES'], 'DIKIRIM', 'ONLINE'],
  siap: [['DIPROSES'], 'SIAP_DIAMBIL', 'OFFLINE'],
  selesai: [['DIKIRIM', 'SIAP_DIAMBIL'], 'SELESAI'],
  konfirmasi_bayar: [['MENUNGGU_KONFIRMASI', 'DIPROSES', 'SIAP_DIAMBIL', 'DIKIRIM'], 'DIPROSES'], // mitra konfirmasi bayar online / offline
  batal_kedaluwarsa: [['MENUNGGU_KONFIRMASI', 'DIPROSES'], 'DIBATALKAN'], // pembatalan otomatis >30 menit offline
};

// Pembersihan pesanan offline yang sudah lewat 30 menit
async function bersihkanKedaluwarsa(db) {
  try {
    const batas = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const kadaluarsa = await rows(db, 'pesanan', [
      Query.equal('status_pesanan', ['MENUNGGU_KONFIRMASI', 'DIPROSES']),
      Query.lessThan('tanggal_pesanan', batas),
      Query.limit(25),
    ]);
    for (const ps of kadaluarsa) {
      const by = (await rows(db, 'pembayaran', [Query.equal('id_pesanan', ps.$id)]))[0];
      if (by && (by.metode === 'BAYAR_DI_TEMPAT' || ps.jenis_pemesanan === 'OFFLINE') && by.status_pembayaran === 'MENUNGGU') {
        for (const d of await rows(db, 'detail_pesanan', [Query.equal('id_pesanan', ps.$id)])) {
          await inc(db, 'produk', d.id_produk, 'stok', d.jumlah).catch(() => {});
        }
        await upd(db, 'pembayaran', by.$id, { status_pembayaran: 'GAGAL' });
        await upd(db, 'pesanan', ps.$id, {
          status_pesanan: 'DIBATALKAN',
          alasan_pembatalan: 'Pesanan dibatalkan otomatis karena melebihi batas waktu pembayaran 30 menit di tenant.',
        });
        await notif(db, ps.id_pembeli, 'Pesanan dibatalkan otomatis', `Pesanan ${ps.$id.slice(-6)} dibatalkan karena tidak dibayar di tenant dalam 30 menit.`, true);
        await notif(db, ps.id_mitra, 'Pesanan dibatalkan otomatis', `Pesanan ${ps.$id.slice(-6)} dibatalkan karena melewati 30 menit. Stok sudah dikembalikan.`, true);
      }
    }
  } catch (e) {
    console.error('[bersihkanKedaluwarsa] err:', e.message);
  }
}

export async function POST(req) {
  try {
  const u = await siapa(req);
  if (!u) return err('Belum masuk.', 401);
  const { id, aksi, alasan } = await req.json();
  const { db } = svc();

  // Jalankan pembersihan pesanan kedaluwarsa secara berkala
  bersihkanKedaluwarsa(db).catch(() => {});

  const p = await getRow(db, 'pesanan', id).catch(() => null);
  if (!p) return err('Pesanan tidak ditemukan.', 404);
  const boleh = aksi === 'batal' ? p.id_pembeli === u.$id : (aksi === 'batal_kedaluwarsa' ? (p.id_pembeli === u.$id || p.id_mitra === u.$id) : p.id_mitra === u.$id);
  if (!boleh) return err('Kamu tidak berhak mengubah pesanan ini.', 403);
  const a = ALUR[aksi];
  if (!a) return err('Aksi tidak dikenal.');
  if (!a[0].includes(p.status_pesanan) || (a[2] && a[2] !== p.jenis_pemesanan)) return err(`Pesanan berstatus ${p.status_pesanan}, aksi ini tidak bisa dilakukan.`);

  // Aksi pembatalan karena pembayaran offline >30 menit
  if (aksi === 'batal_kedaluwarsa') {
    const by = (await rows(db, 'pembayaran', [Query.equal('id_pesanan', id)]))[0];
    if (by && by.status_pembayaran === 'BERHASIL') return Response.json({ ok: true, status: 'sudah_bayar' });
    const orderTime = new Date(p.tanggal_pesanan || p.$createdAt).getTime();
    if (Date.now() - orderTime < 30 * 60 * 1000) return err('Belum mencapai batas waktu 30 menit.');
    if (['SELESAI', 'DIBATALKAN'].includes(p.status_pesanan)) return Response.json({ ok: true, status: p.status_pesanan });

    for (const d of await rows(db, 'detail_pesanan', [Query.equal('id_pesanan', id)])) {
      await inc(db, 'produk', d.id_produk, 'stok', d.jumlah).catch(() => {});
    }
    if (by) await upd(db, 'pembayaran', by.$id, { status_pembayaran: 'GAGAL' });
    await upd(db, 'pesanan', id, {
      status_pesanan: 'DIBATALKAN',
      alasan_pembatalan: 'Pesanan dibatalkan otomatis karena melebihi batas waktu pembayaran 30 menit di tenant.',
    });
    await notif(db, p.id_pembeli, 'Pesanan dibatalkan', `Pesanan ${id.slice(-6)} dibatalkan karena melebihi 30 menit tanpa konfirmasi bayar di tenant.`, true);
    await notif(db, p.id_mitra, 'Pesanan dibatalkan', `Pesanan ${id.slice(-6)} dibatalkan otomatis karena lewat 30 menit. Stok dikembalikan.`, true);
    return Response.json({ ok: true, dibatalkan: true });
  }

  // Aksi konfirmasi bayar oleh mitra (baik pembayaran online QRIS dengan bukti maupun bayar di tempat)
  if (aksi === 'konfirmasi_bayar') {
    if (p.id_mitra !== u.$id) return err('Hanya mitra yang bisa mengonfirmasi pembayaran.', 403);
    const by = (await rows(db, 'pembayaran', [Query.equal('id_pesanan', id)]))[0];
    if (!by) return err('Data pembayaran tidak ditemukan.');
    if (by.status_pembayaran === 'BERHASIL') return err('Pembayaran sudah dikonfirmasi.');

    // Cek jika metode offline apakah sudah lewat 30 menit
    const offline = by.metode === 'BAYAR_DI_TEMPAT' || p.jenis_pemesanan === 'OFFLINE';
    if (offline) {
      const orderTime = new Date(p.tanggal_pesanan || p.$createdAt).getTime();
      if (Date.now() - orderTime > 30 * 60 * 1000) {
        return err('Batas waktu pembayaran di tempat (30 menit) telah kedaluwarsa.', 400);
      }
    }

    const now = new Date().toISOString();
    await upd(db, 'pembayaran', by.$id, { status_pembayaran: 'BERHASIL', waktu_bayar: now });
    // Jika pesanan masih MENUNGGU_KONFIRMASI, otomatis naikkan ke DIPROSES
    if (p.status_pesanan === 'MENUNGGU_KONFIRMASI') {
      await upd(db, 'pesanan', id, { status_pesanan: 'DIPROSES' });
    }
    const labelMetode = by.metode === 'BAYAR_DI_TEMPAT' ? 'di tempat (tenant)' : 'online (QRIS)';
    await notif(db, p.id_pembeli, 'Pembayaran dikonfirmasi', `Mitra telah memverifikasi dan mengonfirmasi pembayaranmu ${labelMetode}. Pesanan sedang diproses.`, true);
    return Response.json({ ok: true });
  }

  const data = { status_pesanan: a[1] };
  const batal = aksi === 'tolak' || aksi === 'batal';
  const olehPembeli = aksi === 'batal';
  const by = (await rows(db, 'pembayaran', [Query.equal('id_pesanan', id)]))[0];
  if (batal) {
    data.alasan_pembatalan = String(alasan || (olehPembeli ? 'Dibatalkan pembeli' : 'Ditolak mitra')).slice(0, 500);
    for (const d of await rows(db, 'detail_pesanan', [Query.equal('id_pesanan', id)])) await inc(db, 'produk', d.id_produk, 'stok', d.jumlah).catch(() => {}); // kembalikan stok
    if (by?.status_pembayaran === 'BERHASIL') await upd(db, 'pembayaran', by.$id, { status_pembayaran: 'REFUND_DIAJUKAN' });
  }
  await upd(db, 'pesanan', id, data);

  if (aksi === 'selesai') { // catat rekap penjualan (atomik, aman untuk pesanan bersamaan)
    const rid = `${u.$id}_${new Date().toISOString().slice(0, 7)}`;
    await put(db, 'rekap_penjualan', rid, { id_mitra: u.$id, periode: rid.slice(-7), total_penjualan: 0, jumlah_transaksi: 0, total_komisi: 0, total_digital: 0, status_pencairan: 'BELUM' }, [Permission.read(Role.user(u.$id))]).catch((e) => { if (e.code !== 409) throw e; });
    const digital = by && by.metode !== 'BAYAR_DI_TEMPAT' ? p.total_harga : 0;
    for (const [k, v] of [['total_penjualan', p.total_harga], ['jumlah_transaksi', 1], ['total_digital', digital]]) if (v) await inc(db, 'rekap_penjualan', rid, k, v);
    if (by && by.status_pembayaran !== 'BERHASIL') await upd(db, 'pembayaran', by.$id, { status_pembayaran: 'BERHASIL', waktu_bayar: new Date().toISOString() });
  }

  const refund = batal && by?.status_pembayaran === 'BERHASIL' ? ' Dana akan dikembalikan oleh admin.' : '';
  if (olehPembeli) {
    await notif(db, p.id_mitra, 'Pesanan dibatalkan pembeli', `Pesanan ${id.slice(-6)} dibatalkan pembeli. Stok sudah dikembalikan.`, true);
    if (p.status_pesanan === 'DIPROSES') {
      await notif(db, p.id_mitra, 'Pesanan dibatalkan pembeli saat diproses', `Pesanan ${id.slice(-6)} yang sedang diproses dibatalkan oleh pembeli.`, true);
    }
  } else await notif(db, p.id_pembeli, `Pesanan ${a[1].replace('_', ' ').toLowerCase()}`,
    { terima: 'Pesananmu sedang diproses.', tolak: `Pesanan ditolak mitra: ${data.alasan_pembatalan}.${refund}`, kirim: 'Pesananmu sedang dikirim.', siap: 'Pesananmu siap diambil.', selesai: 'Pesanan selesai. Terima kasih sudah belanja!' }[aksi],
    aksi === 'tolak' || aksi === 'siap');
  return Response.json({ ok: true });
  } catch (e) {
    console.error('[/api/pesanan] unhandled error:', e?.message || e);
    return err('Terjadi kesalahan server. Coba lagi.', 500);
  }
}
