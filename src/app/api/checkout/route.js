import { siapa, err, getRow, rows, put, upd, del, dec, notif, ID, Query } from '@/lib/server';
import { cariSatu, denganTransaksi, kunciProduk, queryDatabase } from '@/lib/db';
import { FORMAT_ID_BUKTI, MAKS_BUKTI_PEMBAYARAN, PESAN_UKURAN_BUKTI } from '@/lib/bukti-pembayaran';
import { bacaBukti, periksaBukti } from '@/lib/ocr-bukti';
import { unduhFile } from '@/lib/backblaze';

import { addOnValid, hargaSatuanProduk, namaDenganAddOn } from '@/lib/add-on';

import { formatJadwalAmbil, MULAI_PRE_ORDER, waktuPreOrder } from '@/lib/waktu';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const u = await siapa(req);
    if (!u) return err('Belum masuk.', 401);
    const b = await req.json();
    if (typeof b.request_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.request_id)) return err('ID checkout tidak valid. Muat ulang halaman dan coba lagi.');
    if (!['QRIS', 'BAYAR_DI_TEMPAT'].includes(b.metode)) return err('Pilih metode pembayaran.');
    const antar = b.pengantaran === 'ANTAR';
    const alamat = typeof b.alamat === 'string' ? b.alamat.trim() : '';
    const catatan = typeof b.catatan === 'string' ? b.catatan.trim() : '';
    if (antar && (b.metode !== 'QRIS' || !alamat || alamat.length > 500)) {
      return err('Pengantaran memerlukan pembayaran QRIS dan alamat hingga 500 karakter.');
    }
    if (catatan.length > 500) return err('Catatan maksimal 500 karakter.');
    const pg = await cariSatu('pengguna', { _id: u.$id });
    if (pg?.status_akun !== 'AKTIF') return err('Akun belum aktif. Verifikasi akunmu dulu.', 403);

    let upload = null;
    let teksBukti = null;
    const isQris = b.metode === 'QRIS';
    const buktiViaAdmin = isQris && b.bukti_via_admin === true;
    if (isQris) {
      const { rows: [tersimpan] } = await queryDatabase('SELECT id_pembeli, response FROM checkout_request WHERE id = $1', [b.request_id]);
      if (tersimpan?.id_pembeli === u.$id && tersimpan.response) return Response.json({ ok: true, ...tersimpan.response });
      if (tersimpan && tersimpan.id_pembeli !== u.$id) return err('ID checkout sudah digunakan.', 409);
    }
    if (isQris && !buktiViaAdmin) {
      if (typeof b.id_bukti !== 'string' || !FORMAT_ID_BUKTI.test(b.id_bukti)) {
        return err('Harap unggah bukti pembayaran dalam format JPG, PNG, atau WebP.');
      }
      upload = await cariSatu('unggahan_bukti', { _id: b.id_bukti, id_pembeli: u.$id });
      const buffer = upload && await unduhFile(upload.id).catch(() => null);
      if (!buffer) return err('Bukti pembayaran tidak ditemukan. Unggah kembali.');
      if (buffer.length > MAKS_BUKTI_PEMBAYARAN) return err(PESAN_UKURAN_BUKTI);
      if (buffer.length !== upload.ukuran) return err('File bukti pembayaran berubah. Unggah kembali.');
      teksBukti = await bacaBukti(buffer, upload.id);
      if (teksBukti === null) return err('Bukti pembayaran belum dapat diperiksa. Coba lagi sebentar.', 503);
    }

    const langsung = b.langsung?.id ? { id_produk: b.langsung.id, jumlah: Number(b.langsung.jumlah ?? 1), add_on: b.langsung.add_on } : null;
    if (langsung && (typeof langsung.id_produk !== 'string' || !Number.isSafeInteger(langsung.jumlah) || langsung.jumlah < 1)) {
      return err('Produk atau jumlah tidak valid.');
    }

    const hasil = await denganTransaksi(async () => {
      await queryDatabase('SELECT pg_advisory_xact_lock(hashtext($1))', [b.request_id]);
      const { rows: [pernah] } = await queryDatabase('SELECT id_pembeli, response FROM checkout_request WHERE id = $1 FOR UPDATE', [b.request_id]);
      if (pernah) {
        if (pernah.id_pembeli !== u.$id) return { error: 'ID checkout sudah digunakan.', status: 409 };
        if (pernah.response) return { ...pernah.response, idempotent: true };
      }
      const now = new Date();
      const adaJadwal = b.tanggal_ambil !== undefined && b.tanggal_ambil !== '';
      const waktuAmbil = adaJadwal ? waktuPreOrder(b.tanggal_ambil, now) : null;
      if (adaJadwal && (antar || !waktuAmbil)) return { error: 'Pre-order hanya tersedia untuk ambil di lapak pada ' + formatJadwalAmbil(MULAI_PRE_ORDER) + '. Checkout harus selesai sebelum jadwal tutup.' };
      const cart = langsung ? [] : await rows(null, 'item_keranjang', [Query.equal('id_keranjang', u.$id)]);
      const items = langsung ? [langsung] : cart;
      if (!items.length) return { error: 'Keranjang kosong.' };
      for (const id of [...new Set(items.map((item) => item.id_produk))].sort()) await kunciProduk(id);
      const produk = await rows(null, 'produk', [Query.equal('$id', items.map((i) => i.id_produk)), Query.equal('diarsipkan', false), Query.limit(500)]);
      const katalog = new Map(produk.map((p) => [p.$id, p]));
      const perMitra = new Map();
      const jumlahPerProduk = new Map();
      for (const item of items) {
        const p = katalog.get(item.id_produk);
        if (!p) return { error: 'Ada produk yang sudah dihapus mitra. Perbarui keranjangmu.' };
        if (!Number.isSafeInteger(item.jumlah) || item.jumlah < 1) return { error: 'Jumlah item tidak valid.' };
        if (!addOnValid(p, item.add_on)) return { error: 'Pilihan add-on ' + p.nama + ' berubah. Pilih ulang dari halaman produk.', status: 409 };
        const jumlah = (jumlahPerProduk.get(p.$id) || 0) + item.jumlah;
        if (p.stok < jumlah) return { error: 'Stok ' + p.nama + ' tidak cukup.' };
        jumlahPerProduk.set(p.$id, jumlah);
        const grup = perMitra.get(p.id_mitra) || [];
        const hargaSen = Math.round(hargaSatuanProduk(p, item.add_on) * 100);
        grup.push({ item, produk: p, hargaSen });
        perMitra.set(p.id_mitra, grup);
      }

      const mitra = new Map();
      const totalPerMitra = new Map();
      for (const [id, grup] of perMitra) {
        const mt = await getRow(null, 'mitra', id);
        if (antar && mt.antar_aktif !== true) return { error: mt.nama_usaha + ' sedang tidak menerima pengantaran.', status: 409 };
        mitra.set(id, mt);
        const subtotal = grup.reduce((sum, { item, hargaSen }) => sum + item.jumlah * hargaSen, 0);
        totalPerMitra.set(id, subtotal + (antar ? mt.ongkir * 100 : 0));
      }
      const totalSen = [...totalPerMitra.values()].reduce((sum, nilai) => sum + nilai, 0);
      if ((antar || b.total_diharapkan !== undefined) && totalSen !== b.total_diharapkan) {
        return { error: 'Harga atau ongkir berubah. Muat ulang checkout sebelum membayar.', status: 409 };
      }
      const totalCheckout = totalSen / 100;
      const verifikasi = upload ? periksaBukti(teksBukti, totalCheckout) : null;
      if (verifikasi?.status === 'DITOLAK') return { error: verifikasi.temuan.join(' '), status: 422 };
      const statusOcr = verifikasi?.status;
      if (upload) {
        if (await cariSatu('bukti_checkout', { _id: upload.sha256 })) {
          return { error: 'Bukti pembayaran ini sudah digunakan.', status: 409 };
        }

      }
      const { rows: [claim] } = await queryDatabase(
        'INSERT INTO checkout_request (id, id_pembeli) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id',
        [b.request_id, u.$id]
      );
      if (!claim) {
        const { rows: [existing] } = await queryDatabase('SELECT id_pembeli, response FROM checkout_request WHERE id = $1 FOR UPDATE', [b.request_id]);
        if (existing?.id_pembeli === u.$id && existing.response) return { ...existing.response, idempotent: true };
        return { error: 'Checkout sedang diproses. Tunggu sebentar lalu muat ulang pesanan.', status: 409 };
      }
      if (upload) await put(null, 'bukti_checkout', upload.sha256, {
        id_pembeli: u.$id, id_bukti: upload.id, total: totalCheckout,
        status_ocr: statusOcr, referensi: verifikasi.referensi,
        status_pembayaran: 'MENUNGGU',
      });
      for (const [id, jumlah] of jumlahPerProduk) await dec(null, 'produk', id, 'stok', jumlah);

      for (const [mid, grup] of perMitra) {
        const mt = mitra.get(mid);
        const total = totalPerMitra.get(mid) / 100;
        const pid = ID.unique();
        await put(null, 'pesanan', pid, {
          id_pembeli: u.$id, id_mitra: mid, tanggal_pesanan: now,
          jenis_pemesanan: antar ? 'ONLINE' : 'OFFLINE', total_harga: total,
          status_pesanan: 'MENUNGGU_KONFIRMASI', catatan_pembeli: catatan,
          ...(antar ? { alamat_pengiriman: alamat, ongkir: mt.ongkir } : {}),
          ...(waktuAmbil ? { waktu_pengambilan: waktuAmbil } : {}),
        });
        for (const { item, produk, hargaSen } of grup) {
          await put(null, 'detail_pesanan', ID.unique(), {
            id_pesanan: pid, id_produk: produk.$id, nama_produk: produk.nama, jumlah: item.jumlah,
            harga_satuan: hargaSen / 100, subtotal: item.jumlah * hargaSen / 100, add_on: item.add_on || '', catatan_item: item.catatan_item || '',
          });
        }
        await put(null, 'pembayaran', ID.unique(), {
          id_pesanan: pid, metode: b.metode, jumlah: total,
          status_pembayaran: 'MENUNGGU',
          ...(buktiViaAdmin ? { bukti_via_admin: true, total_checkout_manual: totalCheckout } : {}),
          ...(upload ? { id_bukti: upload.id, id_bukti_checkout: upload.sha256, status_ocr: statusOcr, catatan_ocr: verifikasi.temuan, hasil_ocr: verifikasi.data } : {}),
        });
        const ringkas = grup.map(({ item, produk }) => namaDenganAddOn(produk.nama, item.add_on) + ' x' + item.jumlah).join(', ');
        const label = isQris ? 'QRIS' : 'Bayar di Lapak';
        const judul = 'Ada pesanan baru (' + label + ')';
        const jadwal = waktuAmbil ? ' Pre-order untuk ambil di lapak pada ' + formatJadwalAmbil(waktuAmbil) + '.' : '';
        const infoBayar = isQris ? 'Pembayaran menunggu verifikasi.' : waktuAmbil ? 'Pembeli akan bayar di lapak saat mengambil pesanan.' : 'Pembeli akan bayar di lapak dalam 1 jam.';
        const pesan = ringkas + '. Total Rp ' + total.toLocaleString('id-ID') + '.' + jadwal + (antar ? ' Pesanan antar.' : '') + ' ' + infoBayar;
        await notif(null, u.$id, 'Pesanan dibuat (' + label + ')', 'Pesanan ke ' + mt.nama_usaha + (isQris
          ? ' berhasil dibuat dan menunggu verifikasi admin.'
          : waktuAmbil ? ' berhasil dibuat. Silakan bayar di lapak saat mengambil pesanan.' : ' berhasil dibuat. Silakan bayar langsung di lapak dalam 1 jam.') + jadwal);
        await notif(null, mid, judul, pesan, !isQris);
      }
      for (const item of cart) await del(null, 'item_keranjang', item.$id);
      if (cart.length) await upd(null, 'keranjang', u.$id, { total_harga: 0 });

      const response = { jumlah: perMitra.size, itemTerpesan: cart.map((item) => item.$id), statusOcr };
      await queryDatabase('UPDATE checkout_request SET response = $1::jsonb WHERE id = $2', [JSON.stringify(response), b.request_id]);
      return response;
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
