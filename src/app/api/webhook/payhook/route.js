import { timingSafeEqual } from 'node:crypto';
import { err, upd, notif } from '@/lib/server';
import { cariBanyak, cariSatu, denganTransaksi, tulis } from '@/lib/db';
import { rupiahDalamSen } from '@/lib/ocr-bukti';

export const dynamic = 'force-dynamic';

function teksPayload(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value && typeof value === 'object' ? Object.values(value).map(teksPayload).join(' ') : '';
}

async function bacaPayload(req) {
  const jenis = req.headers.get('content-type') || '';
  if (jenis.includes('application/json')) return req.json();
  if (jenis.includes('form')) return Object.fromEntries(await req.formData());
  const text = await req.text();
  try { return JSON.parse(text); } catch { return { text }; }
}

function rahasiaCocok(req) {
  const nilai = req.headers.get('x-payhook-secret');
  if (!nilai || !process.env.PAYHOOK_SECRET) return false;
  const expected = Buffer.from(process.env.PAYHOOK_SECRET);
  const actual = Buffer.from(nilai);
  return actual.length === expected.length && timingSafeEqual(expected, actual);
}

export async function POST(req) {
  try {
    const payload = await bacaPayload(req) ?? {};
    const teks = teksPayload(payload);
    const nominalPayload = payload.nominal ?? payload.amount;
    const raw = teks.match(/\b(?:RP|IDR)\.?\s*(\d[\d.,]*)/i)?.[1]
      ?? (['string', 'number'].includes(typeof nominalPayload) ? String(nominalPayload) : undefined)
      ?? teks.match(/(?:diterima|masuk|menerima)\s*[:=]?\s*(\d[\d.,]*)/i)?.[1];
    const nominal = raw ? rupiahDalamSen(raw) / 100 : 0;
    const uji = !teks || payload.test === true || payload.ping === true || payload.action === 'test' || /\b(test|ping|uji coba)\b/i.test(teks);
    if (uji && !nominal) return Response.json({ ok: true, status: 'connected', pesan: 'Webhook LapaKWU berhasil terhubung dengan PayHook!' });
    if (!rahasiaCocok(req)) return err('Unauthorized', 401);
    if (!nominal || (payload.direction !== 'incoming' && !/\b(menerima|diterima|uang masuk|saldo masuk|transfer masuk|pembayaran masuk)\b/i.test(teks))) {
      return Response.json({ ok: true, terproses: false, pesan: 'Notifikasi dana masuk tidak ditemukan.' });
    }

    const ref = payload.referensi ?? payload.reference ?? teks.match(/(?:referensi|reference|ref\.?|id transaksi)\s*[:#]?\s*([A-Z0-9-]{8,64})\b/i)?.[1];
    if (typeof ref !== 'string' || !/^[A-Z0-9-]{8,64}$/i.test(ref)) {
      return Response.json({ ok: true, terproses: false, nominal, pesan: 'Referensi transaksi tidak tersedia. Cocokkan dana masuk secara manual.' });
    }
    const referensi = ref.toUpperCase();
    const hasil = await denganTransaksi(async () => {
      if (await cariSatu('payhook_event', { _id: referensi })) return null;
      const cocok = await cariBanyak('bukti_checkout', {
        referensi, total: nominal, status_ocr: 'COCOK', status_pembayaran: 'MENUNGGU',
        created_at: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      }, { limit: 2 });
      if (cocok.length !== 1) return null;
      const bukti = cocok[0];
      const daftar = await cariBanyak('pembayaran', { id_bukti_checkout: bukti.id, metode: 'QRIS' });
      if (!daftar.length || daftar.some((bayar) => !['MENUNGGU', 'BERHASIL'].includes(bayar.status_pembayaran))) return null;

      const orders = [];
      for (const bayar of daftar) {
        const order = await cariSatu('pesanan', { _id: bayar.id_pesanan });
        if (!order || order.status_pesanan === 'DIBATALKAN') return null;
        orders.push([order, bayar]);
      }
      const now = new Date();
      await tulis('payhook_event', referensi, { id_bukti_checkout: bukti.id });
      await upd(null, 'bukti_checkout', bukti.id, { status_pembayaran: 'BERHASIL', waktu_bayar: now });
      for (const [order, bayar] of orders) {
        if (bayar.status_pembayaran === 'BERHASIL') continue;
        await upd(null, 'pembayaran', bayar.id, { status_pembayaran: 'BERHASIL', waktu_bayar: now });
        if (order.status_pesanan === 'MENUNGGU_KONFIRMASI') {
          await upd(null, 'pesanan', order.id, { status_pesanan: 'DIPROSES' });
        }
        const judul = 'Pembayaran QRIS terverifikasi';
        const pesan = 'Dana untuk pesanan #' + order.id.slice(-6) + ' telah diterima. Invoice tersedia di Riwayat Pesanan.';
        for (const uid of [order.id_pembeli, order.id_mitra]) {
          await notif(null, uid, judul, pesan, true);
        }
      }
      return { ids: orders.map(([order]) => order.id) };
    });
    if (!hasil) return Response.json({ ok: true, terproses: false, nominal, pesan: 'Tidak ada bukti OCR yang cocok atau transaksi sudah diproses.' });
    return Response.json({ ok: true, terproses: true, pesananId: hasil.ids[0], pesananIds: hasil.ids, nominal, pesan: 'Pembayaran berhasil diverifikasi.' });
  } catch (e) {
    if (e.code === 409) return Response.json({ ok: true, terproses: false, pesan: 'Transaksi sudah diproses.' });
    console.error('[payhook]', e?.message);
    return err('Gagal memproses notifikasi pembayaran.', 500);
  }
}
