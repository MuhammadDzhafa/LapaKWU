import { createHmac, timingSafeEqual } from 'node:crypto';
import { err, upd } from '@/lib/server';
import { cariBanyak, cariSatu, denganTransaksi, tulis } from '@/lib/db';
import { rupiahDalamSen } from '@/lib/ocr-bukti';

export const dynamic = 'force-dynamic';

function teksPayload(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value && typeof value === 'object' ? Object.values(value).map(teksPayload).join(' ') : '';
}

async function bacaPayload(req, body) {
  const jenis = req.headers.get('content-type') || '';
  const text = body.toString('utf8');
  if (jenis.includes('application/json')) return JSON.parse(text);
  if (jenis.includes('form')) return Object.fromEntries(await new Response(body, { headers: { 'content-type': jenis } }).formData());
  try { return JSON.parse(text); } catch { return { text }; }
}

function nilaiCocok(nilai, harapan) {
  const actual = Buffer.from(nilai || '');
  const expected = Buffer.from(harapan);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function rahasiaCocok(req, body) {
  const { PAYHOOK_SECRET: secret, PAYHOOK_TOKEN: token } = process.env;
  if (!secret) return false;
  if (!token) return nilaiCocok(req.headers.get('x-payhook-secret'), secret);
  if (!nilaiCocok(req.headers.get('authorization'), `Bearer ${token}`)) return false;

  const timestamp = req.headers.get('x-payhook-timestamp');
  if (!/^\d{10}$/.test(timestamp || '') || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const signature = createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex');
  return nilaiCocok(req.headers.get('x-payhook-signature'), `sha256=${signature}`);
}

export async function POST(req) {
  try {
    const body = Buffer.from(await req.arrayBuffer());
    if (!rahasiaCocok(req, body)) return err('Unauthorized', 401);
    const payload = await bacaPayload(req, body) ?? {};
    const teks = teksPayload(payload);
    if (!teks || payload.is_test === true || payload.test === true || payload.ping === true || payload.action === 'test') {
      return Response.json({ ok: true, status: 'connected', pesan: 'Webhook LapaKWU berhasil terhubung dengan PayHook!' });
    }
    const nominalPayload = payload.nominal ?? payload.amount;
    const raw = (['string', 'number'].includes(typeof nominalPayload) ? String(nominalPayload) : undefined)
      ?? teks.match(/\b(?:RP|IDR)\.?\s*(\d[\d.,]*)/i)?.[1]
      ?? teks.match(/(?:diterima|masuk|menerima)\s*[:=]?\s*(\d[\d.,]*)/i)?.[1];
    const sen = raw ? rupiahDalamSen(raw) : null;
    const masuk = ['in', 'incoming'].includes(payload.direction) || (!payload.direction && (
      payload.event_type === 'payment.incoming' || (!payload.event_type && /\b(menerima|diterima|uang masuk|saldo masuk|transfer masuk|pembayaran masuk)\b/i.test(teks))
    ));
    if (!Number.isSafeInteger(sen) || sen <= 0 || !masuk || (payload.currency && payload.currency !== 'IDR')) {
      return Response.json({ ok: true, terproses: false, pesan: 'Notifikasi dana masuk tidak ditemukan.' });
    }
    const nominal = sen / 100;

    const notifikasi = [payload.notification_title, payload.notification_text].filter(Boolean).join(' ') || teks;
    const ref = payload.referensi
      ?? notifikasi.match(/\b(?:referensi|reference|ref\.?|id transaksi)\s*[:#]?\s*([A-Z0-9-]{8,64})(?![A-Z0-9-])/i)?.[1]
      ?? (/^PH-\d+$/i.test(payload.reference) ? undefined : payload.reference);
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
      await upd(null, 'bukti_checkout', bukti.id, { waktu_dana_masuk: now });
      return { ids: orders.map(([order]) => order.id) };
    });
    if (!hasil) return Response.json({ ok: true, terproses: false, nominal, pesan: 'Tidak ada bukti OCR yang cocok atau transaksi sudah diproses.' });
    return Response.json({ ok: true, terproses: true, pesananId: hasil.ids[0], pesananIds: hasil.ids, nominal, pesan: 'Dana masuk tercatat. Menunggu verifikasi admin.' });
  } catch (e) {
    if (e.code === 409) return Response.json({ ok: true, terproses: false, pesan: 'Transaksi sudah diproses.' });
    console.error('[payhook]', e?.message);
    return err('Gagal memproses notifikasi pembayaran.', 500);
  }
}
