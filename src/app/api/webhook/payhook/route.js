import { svc, rows, getRow, upd, notif, Query } from '@/lib/server';

export const dynamic = 'force-dynamic';

// Fungsi untuk mengekstrak nominal uang dari notifikasi DANA / E-Wallet
function ekstrakNominal(teks) {
  if (!teks) return null;
  // Contoh teks notifikasi DANA:
  // "Kamu menerima pembayaran sebesar Rp 25.000 dari..."
  // "Berhasil menerima Rp. 30.000 dari..."
  // "Pembayaran QRIS Rp25.500 diterima"
  const polaRp = /Rp\.?\s*([\d\.]+)/i;
  const match = teks.match(polaRp);
  if (match && match[1]) {
    const angka = parseInt(match[1].replace(/\./g, ''), 10);
    if (!isNaN(angka) && angka > 0) return angka;
  }

  // Fallback: cari angka minimal 4 digit (misal: 10000)
  const polaAngka = /(?:sebesar|masuk|terima)\s*(\d[\d\.\,]+)/i;
  const matchAngka = teks.match(polaAngka);
  if (matchAngka && matchAngka[1]) {
    const angka = parseInt(matchAngka[1].replace(/[\.\,]/g, ''), 10);
    if (!isNaN(angka) && angka > 0) return angka;
  }

  return null;
}

export async function POST(req) {
  try {
    // 1. Verifikasi secret key (opsional, jika dikonfigurasi di PayHook Header x-payhook-secret)
    const secret = req.headers.get('x-payhook-secret');
    const secretEnv = process.env.PAYHOOK_SECRET;
    if (secretEnv && secret !== secretEnv) {
      console.warn('[PayHook Webhook] Unauthorized secret key');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    console.log('[PayHook DANA Webhook] Payload diterima:', JSON.stringify(payload));

    // Gabungkan kemungkinan field pesan dari berbagai aplikasi forwarder Android
    const teksNotifikasi = [
      payload.title,
      payload.message,
      payload.text,
      payload.content,
      payload.notification,
      payload.body,
    ].filter(Boolean).join(' ');

    if (!teksNotifikasi) {
      return Response.json({ ok: false, error: 'Pesan notifikasi kosong.' }, { status: 400 });
    }

    // 2. Ekstrak nominal uang masuk
    const nominal = ekstrakNominal(teksNotifikasi);
    if (!nominal) {
      console.warn('[PayHook Webhook] Nominal uang tidak terdeteksi pada teks:', teksNotifikasi);
      return Response.json({ ok: false, pesan: 'Nominal tidak terdeteksi pada notifikasi.' });
    }

    console.log(`[PayHook Webhook] Terdeteksi transfer masuk DANA: Rp ${nominal.toLocaleString('id-ID')}`);

    const { db } = svc();

    // 3. Cari data pembayaran QRIS berstatus MENUNGGU dengan nominal yang cocok
    const listBayar = await rows(db, 'pembayaran', [
      Query.equal('metode', 'QRIS'),
      Query.equal('status_pembayaran', 'MENUNGGU'),
      Query.equal('jumlah', nominal),
      Query.orderDesc('$createdAt'),
      Query.limit(1),
    ]);

    if (!listBayar.length) {
      console.warn(`[PayHook Webhook] Tidak ditemukan pembayaran menunggu sebesar Rp ${nominal}`);
      return Response.json({
        ok: true,
        terproses: false,
        pesan: `Tidak ada transaksi yang cocok untuk nominal Rp ${nominal}. Disimpan untuk verifikasi manual admin.`,
      });
    }

    const bayar = listBayar[0];
    const pesananId = bayar.id_pesanan;
    const now = new Date().toISOString();

    // 4. Update status pembayaran menjadi BERHASIL (Lunas)
    await upd(db, 'pembayaran', bayar.$id, {
      status_pembayaran: 'BERHASIL',
      waktu_bayar: now,
    });

    // 5. Update status pesanan menjadi DIPROSES
    const ps = await getRow(db, 'pesanan', pesananId).catch(() => null);
    if (ps && ps.status_pesanan === 'MENUNGGU_KONFIRMASI') {
      await upd(db, 'pesanan', pesananId, { status_pesanan: 'DIPROSES' });
    }

    const noPesanan = pesananId.slice(-6);

    // 6. Notifikasi otomatis ke MITRA: pembayaran lunas, siapkan pesanan!
    if (ps?.id_mitra) {
      await notif(
        db,
        ps.id_mitra,
        'Pembayaran QRIS DANA Terverifikasi!',
        `Pesanan #${noPesanan} sebesar Rp ${nominal.toLocaleString('id-ID')} telah dibayar via QRIS DANA dan otomatis lunas. Silakan siapkan pesanan pembeli!`,
        true // Kirim WhatsApp/Email
      );
    }

    // 7. Notifikasi otomatis ke PEMBELI: invoice terbit
    if (ps?.id_pembeli) {
      await notif(
        db,
        ps.id_pembeli,
        'Pembayaran Berhasil & Invoice Terbit!',
        `Pembayaran pesanan #${noPesanan} sebesar Rp ${nominal.toLocaleString('id-ID')} telah berhasil diterima. Invoice resmi sudah terbit di menu Riwayat Pesanan.`,
        true // Kirim WhatsApp/Email
      );
    }

    console.log(`[PayHook Webhook] Berhasil memverifikasi pesanan #${noPesanan}`);

    return Response.json({
      ok: true,
      terproses: true,
      pesananId,
      nominal,
      pesan: 'Pembayaran berhasil diverifikasi otomatis oleh PayHook.',
    });
  } catch (err) {
    console.error('[/api/webhook/payhook] Error:', err.message || err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
