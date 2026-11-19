import assert from 'node:assert/strict';
import { nanoid } from 'nanoid';
import { getDatabase, denganTransaksi, cariSatu, cariBanyak, tulis, ubahData, hapusData, pastikanPembeli } from '../src/lib/db.js';

const connection = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
if (!/test/i.test(new URL(connection).pathname)) {
  throw new Error('Pengujian hanya boleh dijalankan pada database dengan nama yang mengandung kata "test".');
}

const pool = await getDatabase();
const id = `dbtest_${nanoid(12)}`;
const rollbackId = `rollback_${nanoid(12)}`;
const partnerId = `partner_${nanoid(12)}`;
const productId = `product_${nanoid(12)}`;
const orderId = `order_${nanoid(12)}`;
const paymentId = `payment_${nanoid(12)}`;
try {
  await pool.query(await import('node:fs/promises').then(({ readFile }) => readFile('database/schema-postgres.sql', 'utf8')));
  await denganTransaksi(async () => {
    await tulis('users', id, { nama: 'Test LapaKWU', email: `${id}@example.invalid`, password_hash: 'test-only' });
    await pastikanPembeli({ $id: id, name: 'Test LapaKWU', email: `${id}@example.invalid` });
    await tulis('bukti_checkout', id, {
      id_pembeli: id, id_bukti: `bukti-${id}.jpg`, total: 12500,
      status_ocr: 'PERLU_TINJAUAN', status_pembayaran: 'MENUNGGU',
    });
    await ubahData('bukti_checkout', { _id: id }, { status_pembayaran: 'BERHASIL' });
    await tulis('users', partnerId, { nama: 'Test Mitra', email: `${partnerId}@example.invalid`, password_hash: 'test-only' });
    await pastikanPembeli({ $id: partnerId, name: 'Test Mitra', email: `${partnerId}@example.invalid` });
    await tulis('mitra', partnerId, { nama_usaha: 'Lapak Tes', alamat_usaha: 'Alamat tes' });
    await tulis('produk', productId, { id_mitra: partnerId, nama: 'Produk tes', harga: 12500, kategori: 'Tes', stok: 3 });
    await tulis('rekap_penjualan', partnerId, { id_mitra: partnerId, periode: '2026-01', total_penjualan: 12500 });
    await tulis('pesanan', orderId, {
      id_pembeli: id, id_mitra: partnerId, tanggal_pesanan: new Date(), jenis_pemesanan: 'OFFLINE',
      total_harga: 12500, status_pesanan: 'MENUNGGU_KONFIRMASI',
    });
    await tulis('pembayaran', paymentId, {
      id_pesanan: orderId, metode: 'QRIS', jumlah: 12500, status_pembayaran: 'MENUNGGU',
      catatan_ocr: ['Nama penerima perlu diperiksa'], hasil_ocr: { nominal: 12500, penerima_cocok: false },
    });
  });

  const user = await cariSatu('users', { email: `${id}@example.invalid` });
  assert.equal(user?.id, id, 'insert dan lookup email');
  const record = await cariSatu('bukti_checkout', { _id: id });
  assert.equal(record?.total, 12500, 'nilai numeric dikembalikan sebagai number');
  assert.equal(record?.status_pembayaran, 'BERHASIL', 'update');
  const payment = await cariSatu('pembayaran', { _id: paymentId });
  assert.deepEqual(payment?.catatan_ocr, ['Nama penerima perlu diperiksa'], 'array JSONB');
  assert.deepEqual(payment?.hasil_ocr, { nominal: 12500, penerima_cocok: false }, 'object JSONB');
  assert.equal((await cariBanyak('users', { $or: [{ _id: id }, { email: 'tidak-ada@example.invalid' }] })).length, 1, 'filter OR');
  assert.equal((await cariBanyak('pesanan', { _id: { $in: [orderId, 'id-tidak-ada'] } })).length, 1, 'filter IN');
  assert.equal((await cariBanyak('produk', { _id: productId, stok: { $in: [3, 4] } })).length, 1, 'filter IN numerik');
  assert.equal((await cariSatu('rekap_penjualan', { _id: partnerId }))?.total_penjualan, 12500, 'total rekap dikembalikan sebagai number');
  assert.equal((await cariBanyak('pesanan', { created_at: { $gte: new Date(Date.now() - 60_000) } })).length, 1, 'filter tanggal');

  const stockUpdate = await ubahData('produk', { _id: productId, stok: { $gte: 2 } }, {}, { inc: { stok: -2 } });
  assert.equal(stockUpdate.matchedCount, 1, 'stok cukup diperbarui secara atomik');
  assert.equal((await cariSatu('produk', { _id: productId }))?.stok, 1, 'perubahan stok');
  assert.equal((await ubahData('produk', { _id: productId, stok: { $gte: 2 } }, {}, { inc: { stok: -2 } })).matchedCount, 0, 'stok kurang tidak terpotong');

  await ubahData('pengguna', { _id: id }, {
    nama: 'Jangan ditimpa', email: `${id}@example.invalid`, status_akun: 'AKTIF', kanal: 'EMAIL', kontak_terverifikasi: true,
  }, { upsert: true, insertOnly: true });
  assert.equal((await cariSatu('pengguna', { _id: id }))?.nama, 'Test LapaKWU', 'upsert insert-only');

  await assert.rejects(denganTransaksi(async () => {
    await tulis('users', rollbackId, { nama: 'Rollback', email: `${rollbackId}@example.invalid`, password_hash: 'test-only' });
    throw new Error('uji rollback');
  }), /uji rollback/);
  assert.equal(await cariSatu('users', { _id: rollbackId }), null, 'rollback transaksi');

  await hapusData('pesanan', { _id: orderId });
  await hapusData('produk', { _id: productId });
  await hapusData('users', { _id: partnerId });
  await hapusData('users', { _id: id });
  assert.equal(await cariSatu('users', { _id: id }), null, 'hapus akun');
  assert.equal(await cariSatu('bukti_checkout', { _id: id }), null, 'hapus cascade data turunan');
  console.log('Uji PostgreSQL lulus: koneksi/skema, relasi, filter tanggal/OR, JSONB/numeric, upsert, stok atomik, rollback, dan cascade hapus.');
} finally {
  await hapusData('pesanan', { _id: orderId }).catch(() => {});
  await hapusData('produk', { _id: productId }).catch(() => {});
  await hapusData('users', { _id: partnerId }).catch(() => {});
  await hapusData('users', { _id: id }).catch(() => {});
  await hapusData('users', { _id: rollbackId }).catch(() => {});
  await pool.end();
}
