import { BATAS_BAYAR_TENANT_MS, tenggatBayarTenant } from '@/lib/pembayaran-tenant';
import { cariBanyak, denganTransaksi, kunciPesanan, ubahData } from '@/lib/db';
import { svc, siapa, err, getRow, rows, upd, inc, notif, Query } from '@/lib/server';
export const dynamic = 'force-dynamic';

// aksi -> [status asal, status baru, jenis yang diizinkan]
const ALUR = {
  terima: [['MENUNGGU_KONFIRMASI'], 'DIPROSES'],
  tolak: [['MENUNGGU_KONFIRMASI', 'DIPROSES'], 'DIBATALKAN'],
  batal: [['MENUNGGU_KONFIRMASI', 'DIPROSES'], 'DIBATALKAN'], // oleh pembeli
  kirim: [['DIPROSES'], 'DIKIRIM', 'ONLINE'],
  siap: [['DIPROSES'], 'SIAP_DIAMBIL', 'OFFLINE'],
  selesai: [['DIKIRIM', 'SIAP_DIAMBIL'], 'SELESAI'],
  konfirmasi_bayar: [['MENUNGGU_KONFIRMASI', 'DIPROSES'], 'SELESAI'],
  batal_kedaluwarsa: [['MENUNGGU_KONFIRMASI', 'DIPROSES'], 'DIBATALKAN'], // pembatalan otomatis >1 jam offline
};

// Pembersihan pesanan offline yang sudah lewat 1 jam
async function bersihkanKedaluwarsa(db) {
  try {
    const sekarang = Date.now();
    const batas = new Date(sekarang - BATAS_BAYAR_TENANT_MS);
    const pembayaran = await cariBanyak('pembayaran', {
      metode: 'BAYAR_DI_TEMPAT', status_pembayaran: 'MENUNGGU', created_at: { $lte: batas },
    }, { limit: 25, sort: { created_at: 1 } });
    for (const calon of pembayaran) {
      await denganTransaksi(async () => {
        if (!await kunciPesanan(calon.id_pesanan)) return;
        const by = await getRow(db, 'pembayaran', calon.id);
        const ps = await getRow(db, 'pesanan', by.id_pesanan);
        if (by.status_pembayaran !== 'MENUNGGU' || !['MENUNGGU_KONFIRMASI', 'DIPROSES'].includes(ps.status_pesanan) || tenggatBayarTenant(ps) > sekarang) return;
        for (const d of await rows(db, 'detail_pesanan', [Query.equal('id_pesanan', ps.$id)])) {
          await inc(db, 'produk', d.id_produk, 'stok', d.jumlah);
        }
        await upd(db, 'pembayaran', by.$id, { status_pembayaran: 'GAGAL' });
        await upd(db, 'pesanan', ps.$id, {
          status_pesanan: 'DIBATALKAN',
          alasan_pembatalan: 'Pesanan dibatalkan otomatis karena melebihi batas waktu pembayaran 1 jam di tenant.',
        });
        await notif(db, ps.id_pembeli, 'Pesanan dibatalkan otomatis', 'Batas pembayaran di lapak telah lewat.', true);
        await notif(db, ps.id_mitra, 'Pesanan dibatalkan otomatis', 'Batas pembayaran di lapak telah lewat. Stok dikembalikan.', true);
      });
    }
  } catch (e) {
    console.error('[bersihkanKedaluwarsa] err:', e.message);
  }
}

async function catatRekap(db, p, by) {
  const rid = `${p.id_mitra}_${new Date().toISOString().slice(0, 7)}`;
  await ubahData('rekap_penjualan', { _id: rid }, {
    id_mitra: p.id_mitra, periode: rid.slice(-7), total_penjualan: 0, jumlah_transaksi: 0,
    total_komisi: 0, total_digital: 0, total_offline: 0, jumlah_offline: 0, status_pencairan: 'BELUM',
  }, { upsert: true, insertOnly: true });
  const digital = by && by.metode !== 'BAYAR_DI_TEMPAT' ? p.total_harga : 0;
  for (const [k, v] of [['total_penjualan', p.total_harga], ['jumlah_transaksi', 1], ['total_digital', digital]]) if (v) await inc(db, 'rekap_penjualan', rid, k, v);
}

export async function POST(req) {
  try {
  const u = await siapa(req);
  if (!u) return err('Belum masuk.', 401);
  const { id, aksi, alasan } = await req.json();
  const { db } = svc();

  // Jalankan pembersihan pesanan kedaluwarsa secara berkala
  if (aksi !== 'batal_kedaluwarsa') await bersihkanKedaluwarsa(db);

  return await denganTransaksi(async () => {
    if (!await kunciPesanan(id)) return err('Pesanan tidak ditemukan.', 404);
    const p = await getRow(db, 'pesanan', id);
    const boleh = aksi === 'batal' ? p.id_pembeli === u.$id : (aksi === 'batal_kedaluwarsa' ? (p.id_pembeli === u.$id || p.id_mitra === u.$id) : p.id_mitra === u.$id);
    if (!boleh) return err('Kamu tidak berhak mengubah pesanan ini.', 403);
    const a = ALUR[aksi];
    if (!a) return err('Aksi tidak dikenal.');
    const by = (await rows(db, 'pembayaran', [Query.equal('id_pesanan', id)]))[0];
    const bayarDiTenant = by?.metode === 'BAYAR_DI_TEMPAT';
    if (p.id_mitra === u.$id && by?.metode === 'QRIS' && by.status_pembayaran === 'MENUNGGU') {
      return err('Pembayaran QRIS menunggu verifikasi admin.', 403);
    }
    const selesaiTenantLama = aksi === 'selesai' && bayarDiTenant && ['MENUNGGU_KONFIRMASI', 'DIPROSES'].includes(p.status_pesanan);
    if (aksi === 'batal_kedaluwarsa' && bayarDiTenant && (by.status_pembayaran === 'BERHASIL' || p.status_pesanan === 'DIBATALKAN')) {
      return Response.json({ ok: true, status: p.status_pesanan });
    }
    if ((!a[0].includes(p.status_pesanan) && !selesaiTenantLama) || (a[2] && a[2] !== p.jenis_pemesanan)) return err(`Pesanan berstatus ${p.status_pesanan}, aksi ini tidak bisa dilakukan.`);

    // Aksi pembatalan karena pembayaran offline >1 jam
    if (aksi === 'batal_kedaluwarsa') {
      if (by?.metode !== 'BAYAR_DI_TEMPAT') return err('Batas waktu ini hanya berlaku untuk bayar di lapak.');
      if (Date.now() < tenggatBayarTenant(p)) return err('Belum mencapai batas waktu 1 jam.');

      for (const d of await rows(db, 'detail_pesanan', [Query.equal('id_pesanan', id)])) {
        await inc(db, 'produk', d.id_produk, 'stok', d.jumlah);
      }
      if (by) await upd(db, 'pembayaran', by.$id, { status_pembayaran: 'GAGAL' });
      await upd(db, 'pesanan', id, {
        status_pesanan: 'DIBATALKAN',
        alasan_pembatalan: 'Pesanan dibatalkan otomatis karena melebihi batas waktu pembayaran 1 jam di tenant.',
      });
      await notif(db, p.id_pembeli, 'Pesanan dibatalkan', `Pesanan ${id.slice(-6)} dibatalkan karena melebihi 1 jam tanpa konfirmasi bayar di tenant.`, true);
      await notif(db, p.id_mitra, 'Pesanan dibatalkan', `Pesanan ${id.slice(-6)} dibatalkan otomatis karena lewat 1 jam. Stok dikembalikan.`, true);
      return Response.json({ ok: true, dibatalkan: true });
    }

    // Mitra mengonfirmasi pembayaran langsung di tenant.
    if (aksi === 'konfirmasi_bayar') {
      if (p.id_mitra !== u.$id) return err('Hanya mitra yang bisa mengonfirmasi pembayaran.', 403);
      if (!bayarDiTenant) return err('Pembayaran QRIS diverifikasi oleh admin.', 403);
      if (by.status_pembayaran !== 'MENUNGGU') return err('Pembayaran tidak dalam status menunggu.');

      if (Date.now() >= tenggatBayarTenant(p)) {
        return err('Batas waktu pembayaran di tempat (1 jam) telah kedaluwarsa.');
      }

      const now = new Date().toISOString();
      await upd(db, 'pembayaran', by.$id, { status_pembayaran: 'BERHASIL', waktu_bayar: now });
      await upd(db, 'pesanan', id, { status_pesanan: 'SELESAI' });
      await catatRekap(db, p, by);
      await notif(db, p.id_pembeli, 'Pesanan selesai', 'Pembayaran di lapak sudah dikonfirmasi. Terima kasih sudah belanja!', true);
      return Response.json({ ok: true, status: 'SELESAI' });
    }

    const data = { status_pesanan: a[1] };
    const batal = aksi === 'tolak' || aksi === 'batal';
    const olehPembeli = aksi === 'batal';
    if (bayarDiTenant && aksi === 'siap') return err('Selesaikan pesanan langsung setelah pembayaran di lapak.');
    if (by && ['terima', 'kirim', 'siap', 'selesai'].includes(aksi) && by.status_pembayaran !== 'BERHASIL') {
      return err('Konfirmasi pembayaran sebelum memproses pesanan.');
    }
    if (batal) {
      data.alasan_pembatalan = String(alasan || (olehPembeli ? 'Dibatalkan pembeli' : 'Ditolak mitra')).slice(0, 500);
      for (const d of await rows(db, 'detail_pesanan', [Query.equal('id_pesanan', id)])) await inc(db, 'produk', d.id_produk, 'stok', d.jumlah); // kembalikan stok
      if (by?.status_pembayaran === 'BERHASIL') await upd(db, 'pembayaran', by.$id, { status_pembayaran: 'REFUND_DIAJUKAN' });
      else if (by?.status_pembayaran === 'MENUNGGU') await upd(db, 'pembayaran', by.$id, { status_pembayaran: 'GAGAL' });
    }
    await upd(db, 'pesanan', id, data);

    if (aksi === 'selesai') await catatRekap(db, p, by);

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
  });
  } catch (e) {
    console.error('[/api/pesanan] unhandled error:', e?.message || e);
    return err('Terjadi kesalahan server. Coba lagi.', 500);
  }
}
