import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { JUMLAH_TENANT } from '../src/lib/tenant.js';
import { getDatabase, denganTransaksi, ubahData, cariSatu, queryDatabase } from '../src/lib/db.js';

// Data tambahan saja: tidak menghapus atau menimpa data yang sudah dicoba.
const url = new URL(process.env.POSTGRES_URL || process.env.DATABASE_URL);
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
  throw new Error('Data demo hanya boleh dibuat pada PostgreSQL localhost, di luar production.');
}
const pool = await getDatabase();
const simpan = (tabel, id, data) => ubahData(tabel, { _id: id }, data, { upsert: true, insertOnly: true });
const password = 'DemoLapak123!';
const buktiId = 'bukti-' + 'demo'.padEnd(21, '0') + '.jpg';
const now = new Date();
const periode = now.toISOString().slice(0, 7);
try {
  await pool.query(await readFile(join(process.cwd(), 'database/schema-postgres.sql'), 'utf8'));
  const folder = join(process.cwd(), 'data/unggahan-dev');
  await mkdir(folder, { recursive: true });
  const gambar = ['2mRphgLJK-D9Y9DUOW8Ok.webp', '7rptxbtRdVW27QXHsk4X9.jpg', 'A5FSAIoCHftDUI1cfktyA.webp'];
  for (let i = 0; i < gambar.length; i++) await copyFile(join(process.cwd(), 'public/uploads', gambar[i]), join(folder, `demo-produk-${i}.` + gambar[i].split('.').at(-1)));
  await copyFile(join(process.cwd(), 'public/qris.jpg'), join(folder, 'demo-qris.jpg'));
  // Foto ini hanya fixture untuk tinjauan manual, bukan bukti transfer sungguhan.
  const bukti = await readFile(join(process.cwd(), 'public/qris.jpg'));
  await copyFile(join(process.cwd(), 'public/qris.jpg'), join(folder, buktiId));
  const hash = createHash('sha256').update(bukti).digest('hex');
  const password_hash = await bcrypt.hash(password, 12);
  await denganTransaksi(async () => {
    for (const [id, nama, email, status] of [
      ['demo-admin', 'Admin Demo', 'admin@demo.lapakwu.test', 'AKTIF'],
      ['demo-pembeli', 'Pembeli Demo', 'pembeli@demo.lapakwu.test', 'AKTIF'],
      ['demo-mitra', 'Mitra Kuliner Demo', 'mitra@demo.lapakwu.test', 'AKTIF'],
      ['demo-mitra2', 'Mitra Kreatif Demo', 'mitra2@demo.lapakwu.test', 'AKTIF'],
      ['demo-pending', 'Calon Mitra Demo', 'pending@demo.lapakwu.test', 'MENUNGGU_VERIFIKASI'],
    ]) {
      await simpan('users', id, { nama, email, password_hash });
      await simpan('pengguna', id, { nama, email, no_telepon: '', status_akun: status, kanal: 'EMAIL', kontak_terverifikasi: true });
    }
    await simpan('admin', 'demo-admin', { level_akses: 'SUPER' });
    await simpan('pembeli', 'demo-pembeli', { alamat: 'Kampus Demo, Gedung A' });
    await simpan('keranjang', 'demo-pembeli', { id_pembeli: 'demo-pembeli', total_harga: 30000 });
    for (const [id, nama_usaha] of [['demo-mitra', 'Dapur Nusantara Demo'], ['demo-mitra2', 'Kreasi Mahasiswa Demo'], ['demo-pending', 'Lapak Calon Mitra Demo']]) {
      if (await cariSatu('mitra', { _id: id })) continue;
      const nomor = id === 'demo-pending' ? null : (await queryDatabase('SELECT n FROM generate_series(1,$1) n WHERE NOT EXISTS (SELECT 1 FROM mitra WHERE nomor_tenant=n) ORDER BY n LIMIT 1', [JUMLAH_TENANT])).rows[0]?.n;
      await simpan('mitra', id, { nama_usaha, alamat_usaha: 'Area bazar kampus (demo)', nomor_tenant: nomor ?? null, id_qris: 'demo-qris.jpg', ...(id !== 'demo-pending' ? { id_admin_verifikator: 'demo-admin' } : {}) });
    }
    const produk = [
      ['Nasi Ayam Geprek', 15000, 'Makanan', 40], ['Es Teh Lemon', 8000, 'Minuman', 60],
      ['Brownies Cokelat', 20000, 'Makanan', 25], ['Tote Bag Kampus', 35000, 'Fashion', 20],
      ['Gantungan Kunci', 10000, 'Kerajinan', 50], ['Stiker Kreatif', 5000, 'Kerajinan', 0],
    ];
    for (let i = 0; i < produk.length; i++) {
      const [nama, harga, kategori, stok] = produk[i];
      await simpan('produk', `demo-produk-${i}`, { id_mitra: i < 3 ? 'demo-mitra' : 'demo-mitra2', nama, harga, kategori, stok, deskripsi: 'Produk contoh untuk pengujian localhost. Gambar ilustrasi demo.', id_gambar: `demo-produk-${i % 3}.` + gambar[i % 3].split('.').at(-1) });
    }
    await simpan('item_keranjang', 'demo-item', { id_keranjang: 'demo-pembeli', id_produk: 'demo-produk-0', jumlah: 2, subtotal: 30000 });
    await simpan('unggahan_bukti', buktiId, { id_pembeli: 'demo-pembeli', ukuran: bukti.length, sha256: hash });
    await simpan('bukti_checkout', hash, { id_pembeli: 'demo-pembeli', id_bukti: buktiId, total: 30000, status_ocr: 'PERLU_TINJAUAN', status_pembayaran: 'MENUNGGU' });
    const skenario = [
      ['tunai', 'MENUNGGU_KONFIRMASI', 'BAYAR_DI_TEMPAT', 'MENUNGGU', 1],
      ['verifikasi', 'MENUNGGU_KONFIRMASI', 'QRIS', 'MENUNGGU', 2],
      ['proses', 'DIPROSES', 'QRIS', 'BERHASIL', 1],
      ['ambil', 'SIAP_DIAMBIL', 'QRIS', 'BERHASIL', 1],
      ['selesai', 'SELESAI', 'QRIS', 'BERHASIL', 10],
      ['refund', 'DIBATALKAN', 'QRIS', 'REFUND_DIAJUKAN', 1],
      ['batal', 'DIBATALKAN', 'BAYAR_DI_TEMPAT', 'GAGAL', 1],
    ];
    for (const [key, status_pesanan, metode, status_pembayaran, jumlah] of skenario) {
      const id = `demo-pesanan-${key}`, total = jumlah * 15000;
      await simpan('pesanan', id, { id_pembeli: 'demo-pembeli', id_mitra: 'demo-mitra', tanggal_pesanan: now, jenis_pemesanan: 'OFFLINE', total_harga: total, status_pesanan, lokasi_pengambilan: 'Area bazar kampus (demo)', ...(status_pesanan === 'DIBATALKAN' ? { alasan_pembatalan: 'Contoh pembatalan demo' } : {}) });
      await simpan('detail_pesanan', `demo-detail-${key}`, { id_pesanan: id, id_produk: 'demo-produk-0', jumlah, harga_satuan: 15000, subtotal: total });
      await simpan('pembayaran', `demo-bayar-${key}`, { id_pesanan: id, metode, jumlah: total, status_pembayaran, ...(status_pembayaran === 'BERHASIL' ? { waktu_bayar: now } : {}), ...(key === 'verifikasi' ? { id_bukti: buktiId, id_bukti_checkout: hash, status_ocr: 'PERLU_TINJAUAN', catatan_ocr: ['Fixture demo: bukan bukti transfer sungguhan.'] } : {}) });
    }
    await simpan('penjualan_offline', 'demo-offline', { id_mitra: 'demo-mitra', id_produk: 'demo-produk-1', nama_produk: 'Es Teh Lemon', jumlah: 3, harga_satuan: 8000, subtotal: 24000, waktu: now, periode });
    await simpan('rekap_penjualan', `demo-mitra_${periode}`, { id_mitra: 'demo-mitra', periode, total_penjualan: 174000, jumlah_transaksi: 1, total_komisi: 0, total_digital: 150000, total_offline: 24000, jumlah_offline: 3, status_pencairan: 'BELUM' });
    await simpan('pencairan_dompet', 'demo-pencairan', { id_mitra: 'demo-mitra', nama_usaha: 'Dapur Nusantara Demo', id_qris: 'demo-qris.jpg', nominal: 10000, status: 'DIAJUKAN' });
    for (const id of ['demo-pembeli', 'demo-mitra']) await simpan('notifikasi', `demo-notif-${id}`, { id_pengguna: id, judul: 'Selamat datang di demo', pesan: 'Data contoh siap dicoba: keranjang, pesanan, pembayaran, rekap dan dompet.', waktu_kirim: now, sudah_dibaca: false });
  });
  console.log(`Demo siap. Password akun baru: ${password}\nAkun: admin / pembeli / mitra / mitra2 / pending @demo.lapakwu.test\nData yang sudah ada dipertahankan. Jalankan npm run dev.`);
} catch (error) {
  console.error('Seed demo gagal:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
