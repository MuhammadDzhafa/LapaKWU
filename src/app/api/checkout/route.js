import { svc, siapa, err, getRow, rows, put, upd, del, dec, inc, notif, baca, ID, Query } from '@/lib/server';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const u = await siapa(req);
  if (!u) return err('Belum masuk.', 401);
  const b = await req.json();
  const { db } = svc();

  const pg = await getRow(db, 'pengguna', u.$id).catch(() => null);
  if (!pg || pg.status_akun !== 'AKTIF') return err('Akun belum aktif. Verifikasi akunmu dulu.', 403);
  let pb = await getRow(db, 'pembeli', u.$id).catch(() => null);
  if (!pb) {
    const mt = await getRow(db, 'mitra', u.$id).catch(() => null);
    const ad = await getRow(db, 'admin', u.$id).catch(() => null);
    if (!mt && !ad) {
      await put(db, 'pembeli', u.$id, { alamat: '' }, baca(u.$id)).catch(() => {});
      pb = { $id: u.$id, alamat: '' };
    }
  }
  if (!pb) return err('Hanya akun pembeli yang bisa checkout.', 403);

  if (!['QRIS', 'BAYAR_DI_TEMPAT'].includes(b.metode)) return err('Pilih metode pembayaran.');
  if (b.metode === 'QRIS' && !b.id_bukti) return err('Harap unggah bukti pembayaran.');

  // Semua pesanan = ambil di lapak mitra (tidak ada pengiriman)

  // Sumber item: beli langsung (satu produk) atau isi keranjang
  const langsung = b.langsung?.id ? { id_produk: String(b.langsung.id), jumlah: Math.max(1, Math.floor(+b.langsung.jumlah || 1)) } : null;
  const cart = langsung ? [] : await rows(db, 'item_keranjang', [Query.equal('id_keranjang', u.$id)]);
  const items = langsung ? [langsung] : cart;
  if (!items.length) return err('Keranjang kosong.');
  const ps = await rows(db, 'produk', [Query.equal('$id', items.map((i) => i.id_produk))]);
  const pm = Object.fromEntries(ps.map((p) => [p.$id, p]));
  for (const i of items) if (!pm[i.id_produk]) return err('Ada produk yang sudah dihapus mitra. Perbarui keranjangmu.');

  // Validasi produk aktif untuk beli langsung (stok > 0)
  if (langsung) {
    const produkLangsung = pm[langsung.id_produk];
    if (!produkLangsung || produkLangsung.stok <= 0) return err('Produk tidak tersedia atau stok habis.');
  }

  // Double-check: baca ulang stok terkini dari DB sebelum decrement
  for (const i of items) {
    const terkini = await getRow(db, 'produk', i.id_produk).catch(() => null);
    if (!terkini || terkini.stok < i.jumlah) return err(`Stok ${pm[i.id_produk]?.nama || i.id_produk} tidak cukup.`);
  }

  // 1) Kunci stok secara atomik. Operasi ditolak server jika stok akan di bawah nol.
  const terkunci = [];
  const batalkan = async () => { for (const t of terkunci) await inc(db, 'produk', t.id_produk, 'stok', t.jumlah).catch(() => {}); };
  for (const i of items) {
    try { await dec(db, 'produk', i.id_produk, 'stok', i.jumlah); terkunci.push(i); }
    catch { await batalkan(); return err(`Stok ${pm[i.id_produk].nama} tidak cukup. Kurangi jumlahnya atau coba lagi nanti.`); }
  }

  try {
    const per = {}; // satu pesanan per mitra (ERD: pesanan punya satu id_mitra)
    for (const i of items) (per[pm[i.id_produk].id_mitra] ??= []).push(i);
    const now = new Date().toISOString();
    for (const [mid, its] of Object.entries(per)) {
      const mt = await getRow(db, 'mitra', mid);
      const total = its.reduce((a, i) => a + i.jumlah * pm[i.id_produk].harga, 0);
      const pid = ID.unique();
      const izin = baca(u.$id, mid);
      await put(db, 'pesanan', pid, {
        id_pembeli: u.$id, id_mitra: mid, tanggal_pesanan: now,
        jenis_pemesanan: 'OFFLINE', total_harga: total,
        status_pesanan: 'MENUNGGU_KONFIRMASI',
        lokasi_pengambilan: mt.alamat_usaha,
      }, izin);
      for (const i of its) {
        const p = pm[i.id_produk];
        await put(db, 'detail_pesanan', ID.unique(), { id_pesanan: pid, id_produk: p.$id, jumlah: i.jumlah, harga_satuan: p.harga, subtotal: i.jumlah * p.harga }, izin);
      }
      // Pembayaran membutuhkan konfirmasi dari mitra (bukti transfer online atau bayar di tenant)
      await put(db, 'pembayaran', ID.unique(), {
        id_pesanan: pid,
        metode: b.metode,
        jumlah: total,
        status_pembayaran: 'MENUNGGU',
        ...(b.id_bukti ? { id_bukti: String(b.id_bukti).slice(0, 36) } : {}),
      }, izin);
      const ringkas = its.map((i) => `${pm[i.id_produk].nama} x${i.jumlah}`).join(', ');
      if (b.metode === 'BAYAR_DI_TEMPAT') {
        await notif(db, u.$id, 'Pesanan dibuat (Bayar di Lapak)', `Pesanan ke ${mt.nama_usaha} berhasil dibuat. Silakan bayar langsung di lapak dalam waktu 30 menit.`);
        await notif(db, mid, 'Ada pesanan baru (Bayar di Lapak)', `${ringkas}. Total Rp ${total.toLocaleString('id-ID')}. Pembeli akan datang bayar langsung di lapak dalam 30 menit. Buka LapaKWU › Lapak saya untuk konfirmasi.`, true);
      } else {
        await notif(db, u.$id, 'Pesanan dibuat', `Pesanan ke ${mt.nama_usaha} berhasil dibuat. Bukti pembayaran telah diunggah, menunggu konfirmasi mitra.`);
        await notif(db, mid, 'Ada pesanan baru (QRIS)', `${ringkas}. Total Rp ${total.toLocaleString('id-ID')}. Pembeli telah mengunggah bukti pembayaran QRIS. Buka LapaKWU › Lapak saya untuk melihat bukti dan konfirmasi.`, true);
      }
    }
    for (const c of cart) await del(db, 'item_keranjang', c.$id);
    if (cart.length) await upd(db, 'keranjang', u.$id, { total_harga: 0 });
    return Response.json({ ok: true, jumlah: Object.keys(per).length });
  } catch (e) {
    console.error('[checkout] gagal:', e?.message || e);
    await batalkan();
    return err('Pesanan gagal dibuat, stok dikembalikan. Coba lagi.', 500);
  }
}
