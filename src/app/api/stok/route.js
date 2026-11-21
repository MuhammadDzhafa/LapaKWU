import { denganTransaksi, kunciProduk, ubahData } from '@/lib/db';
import { svc, siapa, err, getRow, rows, put, upd, del, dec, inc, ID, Query } from '@/lib/server';
import { periodeJakarta } from '@/lib/waktu';
import { hitungKomisi } from '@/lib/komisi';
export const dynamic = 'force-dynamic';

// Stok dan penjualan langsung di lapak (offline), dikelola mitra:
//   tambah  : stok +jumlah (barang masuk, atau salah pencet "-")
//   jual    : stok -jumlah, dicatat ke penjualan_offline, masuk rekap bulan berjalan
//   koreksi : turunkan jumlah terjual offline bulan ini jadi `jumlah` (hanya boleh turun);
//             catatan terbaru dihapus, stok dikembalikan, rekap berkurang otomatis
const periodeIni = () => periodeJakarta();

async function rekapId(db, mid, periode) {
  const rid = `${mid}_${periode}`;
  await ubahData('rekap_penjualan', { _id: rid }, {
    id_mitra: mid, periode, total_penjualan: 0, jumlah_transaksi: 0, total_komisi: 0,
    total_digital: 0, total_offline: 0, jumlah_offline: 0, status_pencairan: 'BELUM',
  }, { upsert: true, insertOnly: true });
  return rid;
}
async function ubahRekap(db, rid, uang, jml) {
  for (const [k, v] of [['total_penjualan', uang], ['total_offline', uang], ['jumlah_transaksi', jml], ['jumlah_offline', jml], ['total_komisi', hitungKomisi(uang)]]) if (v) await inc(db, 'rekap_penjualan', rid, k, v);
}

export async function POST(req) {
  try {
  const u = await siapa(req);
  if (!u) return err('Belum masuk.', 401);
  const b = await req.json();
  const { db } = svc();
  const pg = await getRow(db, 'pengguna', u.$id).catch(() => null);
  if (!pg || pg.status_akun !== 'AKTIF') return err('Akun mitra belum aktif.', 403);
  if (!(await getRow(db, 'mitra', u.$id).catch(() => null))) return err('Hanya mitra yang bisa mengelola stok.', 403);

  return await denganTransaksi(async () => {
    let p = await getRow(db, 'produk', String(b.id || '')).catch(() => null);
    if (!p || p.id_mitra !== u.$id) return err('Produk tidak ditemukan.', 404);
    if (!await kunciProduk(p.$id)) return err('Produk tidak ditemukan.', 404);
    const produkTerkunci = await getRow(db, 'produk', p.$id).catch(() => null);
    if (!produkTerkunci || produkTerkunci.diarsipkan || produkTerkunci.id_mitra !== u.$id) return err('Produk tidak ditemukan.', 404);
    p = produkTerkunci;
    const jml = Math.floor(+b.jumlah);
    const periode = periodeIni();

    if (b.aksi === 'tambah') {
      if (!Number.isSafeInteger(jml) || jml < 1) return err('Jumlah tidak valid.');
      await inc(db, 'produk', p.$id, 'stok', jml);
      return Response.json({ ok: true });
    }

    if (b.aksi === 'jual') {
      if (!Number.isSafeInteger(jml) || jml < 1) return err('Jumlah tidak valid.');
      if (p.stok < jml) return err('Stok ' + p.nama + ' tidak cukup.');
      await dec(db, 'produk', p.$id, 'stok', jml);
      await put(db, 'penjualan_offline', ID.unique(), { id_mitra: u.$id, id_produk: p.$id, nama_produk: p.nama, jumlah: jml, harga_satuan: p.harga, subtotal: jml * p.harga, waktu: new Date(), periode });
      await ubahRekap(db, await rekapId(db, u.$id, periode), jml * p.harga, jml);
      return Response.json({ ok: true });
    }

    if (b.aksi === 'koreksi') {
      const baru = Math.floor(+b.baru);
      const log = await rows(db, 'penjualan_offline', [Query.equal('id_mitra', u.$id), Query.equal('id_produk', p.$id), Query.equal('periode', periode), Query.orderDesc('waktu'), Query.limit(500)]);
      if (log.length === 500) return err('Koreksi dibatasi pada 500 catatan terakhir. Hubungi admin untuk koreksi periode dengan lebih banyak catatan.');
      const sekarang = log.reduce((a, l) => a + l.jumlah, 0);
      if (!(baru >= 0) || baru > sekarang) return err(`Isi angka 0 sampai ${sekarang}. Menambah penjualan lewat tombol −.`);
      let sisa = sekarang - baru, uang = 0, kembali = 0;
      for (const l of log) { // hapus dari catatan terbaru; catatan terakhir dipotong kalau jumlahnya lebih besar dari sisa
        if (sisa <= 0) break;
        if (l.jumlah <= sisa) { await del(db, 'penjualan_offline', l.$id); sisa -= l.jumlah; uang += l.subtotal; kembali += l.jumlah; }
        else { await upd(db, 'penjualan_offline', l.$id, { jumlah: l.jumlah - sisa, subtotal: (l.jumlah - sisa) * l.harga_satuan }); uang += sisa * l.harga_satuan; kembali += sisa; sisa = 0; }
      }
      if (kembali) {
        await inc(db, 'produk', p.$id, 'stok', kembali);
        await ubahRekap(db, await rekapId(db, u.$id, periode), -uang, -kembali);
      }
      return Response.json({ ok: true, dikembalikan: kembali });
    }
    return err('Aksi tidak dikenal.');
  });
  } catch (e) {
    if (e.code === 'STOK_TIDAK_CUKUP') return err('Stok tidak cukup.', 409);
    console.error('[/api/stok] unhandled error:', e?.message || e);
    return err('Terjadi kesalahan server. Coba lagi.', 500);
  }
}
