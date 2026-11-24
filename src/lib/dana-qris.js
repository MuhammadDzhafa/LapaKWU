import { cariBanyak, cariSatu, queryDatabase, ubahData } from './db.js';

// Kedua pemanggil harus memegang kunci ini sampai transaksi mereka selesai.
export async function kunciReferensiQris(referensi) {
  await queryDatabase('SELECT pg_advisory_xact_lock(1, hashtext($1))', [referensi]);
}

export async function cocokkanDanaQris(referensi) {
  const event = await cariSatu('payhook_event', { _id: referensi });
  const sejak = new Date(Date.now() - 48 * 60 * 60 * 1000);
  if (!event || event.id_bukti_checkout || !Number.isFinite(event.nominal)
    || new Date(event.created_at) < sejak) return [];

  const bukti = await cariBanyak('bukti_checkout', {
    referensi, total: event.nominal, status_ocr: 'COCOK', status_pembayaran: 'MENUNGGU',
    created_at: { $gte: sejak },
  }, { limit: 2 });
  if (bukti.length !== 1) return [];

  const pembayaran = await cariBanyak('pembayaran', { id_bukti_checkout: bukti[0].id, metode: 'QRIS' }, { limit: 500 });
  if (!pembayaran.length || pembayaran.some((bayar) => !['MENUNGGU', 'BERHASIL'].includes(bayar.status_pembayaran))) return [];
  const ids = pembayaran.map((bayar) => bayar.id_pesanan);
  const { rowCount: pesananAktif } = await queryDatabase(
    "SELECT id FROM pesanan WHERE id = ANY($1::text[]) AND status_pesanan <> 'DIBATALKAN'", [ids],
  );
  if (pesananAktif !== ids.length) return [];

  await ubahData('payhook_event', { _id: referensi }, { id_bukti_checkout: bukti[0].id });
  await ubahData('bukti_checkout', { _id: bukti[0].id }, { waktu_dana_masuk: event.created_at });
  return ids;
}
