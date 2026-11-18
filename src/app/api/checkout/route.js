import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { siapa, err, getRow, rows, put, upd, del, dec, notif, ID, Query } from '@/lib/server';
import { cariSatu, denganTransaksi } from '@/lib/db';
import { FORMAT_ID_BUKTI, MAKS_BUKTI_PEMBAYARAN, PESAN_UKURAN_BUKTI } from '@/lib/bukti-pembayaran';
import { bacaBukti, periksaBukti } from '@/lib/ocr-bukti';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const u = await siapa(req);
    if (!u) return err('Belum masuk.', 401);
    const b = await req.json();
    if (!['QRIS', 'BAYAR_DI_TEMPAT'].includes(b.metode)) return err('Pilih metode pembayaran.');
    const pg = await cariSatu('pengguna', { _id: u.$id });
    if (pg?.status_akun !== 'AKTIF') return err('Akun belum aktif. Verifikasi akunmu dulu.', 403);

    let upload = null;
    let hasilOcr = null;
    if (b.metode === 'QRIS') {
      if (typeof b.id_bukti !== 'string' || !FORMAT_ID_BUKTI.test(b.id_bukti)) {
        return err('Harap unggah bukti pembayaran dalam format JPG, PNG, atau WebP.');
      }
      upload = await cariSatu('unggahan_bukti', { _id: b.id_bukti, id_pembeli: u.$id });
      const path = join(process.cwd(), 'data', 'bukti-pembayaran', b.id_bukti);
      const file = upload && await stat(path).catch(() => null);
      if (!file?.isFile()) return err('Bukti pembayaran tidak ditemukan. Unggah kembali.');
      if (file.size > MAKS_BUKTI_PEMBAYARAN) return err(PESAN_UKURAN_BUKTI);
      if (file.size !== upload.ukuran) return err('File bukti pembayaran berubah. Unggah kembali.');
      hasilOcr = await bacaBukti(path);
    }

    const langsung = b.langsung?.id ? { id_produk: b.langsung.id, jumlah: Number(b.langsung.jumlah ?? 1) } : null;
    if (langsung && (typeof langsung.id_produk !== 'string' || !Number.isSafeInteger(langsung.jumlah) || langsung.jumlah < 1)) {
      return err('Produk atau jumlah tidak valid.');
    }

    const hasil = await denganTransaksi(async () => {
      const cart = langsung ? [] : await rows(null, 'item_keranjang', [Query.equal('id_keranjang', u.$id)]);
      const items = langsung ? [langsung] : cart;
      if (!items.length) return { error: 'Keranjang kosong.' };
      const produk = await rows(null, 'produk', [Query.equal('$id', items.map((i) => i.id_produk))]);
      const katalog = new Map(produk.map((p) => [p.$id, p]));
      const perMitra = new Map();
      for (const item of items) {
        const p = katalog.get(item.id_produk);
        if (!p) return { error: 'Ada produk yang sudah dihapus mitra. Perbarui keranjangmu.' };
        if (!Number.isSafeInteger(item.jumlah) || item.jumlah < 1) return { error: 'Jumlah item tidak valid.' };
        if (p.stok < item.jumlah) return { error: 'Stok ' + p.nama + ' tidak cukup.' };
        const grup = perMitra.get(p.id_mitra) || [];
        grup.push({ item, produk: p });
        perMitra.set(p.id_mitra, grup);
      }

      const now = new Date();
      const totalCheckout = items.reduce((sum, item) => sum + item.jumlah * Math.round(katalog.get(item.id_produk).harga * 100), 0) / 100;
      const verifikasi = upload ? periksaBukti(hasilOcr, totalCheckout, now) : null;
      if (upload) {
        if (await cariSatu('bukti_checkout', { _id: upload.sha256 })) {
          return { error: 'Bukti pembayaran ini sudah digunakan.', status: 409 };
        }
        await put(null, 'bukti_checkout', upload.sha256, {
          id_pembeli: u.$id, id_bukti: upload.id, total: totalCheckout,
          status_ocr: verifikasi.status, referensi: verifikasi.referensi, status_pembayaran: 'MENUNGGU',
        });
      }
      for (const item of items) await dec(null, 'produk', item.id_produk, 'stok', item.jumlah);

      for (const [mid, grup] of perMitra) {
        const mt = await getRow(null, 'mitra', mid);
        const total = grup.reduce((sum, { item, produk }) => sum + item.jumlah * Math.round(produk.harga * 100), 0) / 100;
        const pid = ID.unique();
        await put(null, 'pesanan', pid, {
          id_pembeli: u.$id, id_mitra: mid, tanggal_pesanan: now,
          jenis_pemesanan: 'OFFLINE', total_harga: total, status_pesanan: 'MENUNGGU_KONFIRMASI',
          lokasi_pengambilan: mt.alamat_usaha,
        });
        for (const { item, produk } of grup) {
          await put(null, 'detail_pesanan', ID.unique(), {
            id_pesanan: pid, id_produk: produk.$id, jumlah: item.jumlah,
            harga_satuan: produk.harga, subtotal: item.jumlah * produk.harga,
          });
        }
        await put(null, 'pembayaran', ID.unique(), {
          id_pesanan: pid, metode: b.metode, jumlah: total, status_pembayaran: 'MENUNGGU',
          ...(upload ? { id_bukti: upload.id, id_bukti_checkout: upload.sha256, status_ocr: verifikasi.status, catatan_ocr: verifikasi.temuan } : {}),
          ...(verifikasi?.data ? { hasil_ocr: verifikasi.data } : {}),
        });
        const ringkas = grup.map(({ item, produk }) => produk.nama + ' x' + item.jumlah).join(', ');
        const label = upload ? 'QRIS' : 'Bayar di Lapak';
        const judul = 'Ada pesanan baru (' + label + ')';
        const pesan = ringkas + '. Total Rp ' + total.toLocaleString('id-ID') + (upload
          ? '. Bukti pembayaran sudah diunggah. Periksa di Lapak saya.'
          : '. Pembeli akan datang bayar langsung di lapak dalam 30 menit.');
        await notif(null, u.$id, 'Pesanan dibuat (' + label + ')', 'Pesanan ke ' + mt.nama_usaha + (upload
          ? ' berhasil dibuat dan menunggu konfirmasi pembayaran.'
          : ' berhasil dibuat. Silakan bayar langsung di lapak dalam 30 menit.'));
        await notif(null, mid, judul, pesan, true);
      }
      for (const item of cart) await del(null, 'item_keranjang', item.$id);
      if (cart.length) await upd(null, 'keranjang', u.$id, { total_harga: 0 });

      return { jumlah: perMitra.size, itemTerpesan: cart.map((item) => item.$id), statusOcr: verifikasi?.status };
    });

    if (hasil.error) return err(hasil.error, hasil.status);
    return Response.json({ ok: true, jumlah: hasil.jumlah, itemTerpesan: hasil.itemTerpesan, statusOcr: hasil.statusOcr });
  } catch (e) {
    if (e.code === 409) return err('Bukti pembayaran ini sudah digunakan.', 409);
    if (e.code === 'STOK_TIDAK_CUKUP') return err('Stok tidak cukup. Perbarui keranjangmu.', 409);
    console.error('[checkout] gagal:', e?.message);
    return err('Pesanan gagal dibuat. Coba lagi.', 500);
  }
}
