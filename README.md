# LapaKWU

## Demo localhost dengan data dummy

Pada komputer ini PostgreSQL portabel dan `.env.local` sudah tersedia. Jalankan `npm run demo`, lalu buka `http://localhost:3000`. Perintah ini menyalakan PostgreSQL lokal, menambahkan fixture tanpa menghapus data, dan menjalankan Next.js. Untuk menambahkan data saja: `npm run db:seed`.

Semua akun demo baru memakai password **DemoLapak123!**:

| Peran | Email |
| --- | --- |
| Admin | admin@demo.lapakwu.test |
| Pembeli | pembeli@demo.lapakwu.test |
| Mitra kuliner | mitra@demo.lapakwu.test |
| Mitra kreatif | mitra2@demo.lapakwu.test |
| Calon mitra untuk verifikasi admin | pending@demo.lapakwu.test |

Pembeli memiliki keranjang dan tujuh contoh pesanan: tunai menunggu pembayaran, QRIS menunggu admin, diproses, siap diambil, selesai, refund, dan dibatalkan. Mitra memiliki enam produk (termasuk stok habis), rekap bulan berjalan, penjualan offline, saldo QRIS, dan pengajuan pencairan Rp10.000. Gunakan jendela privat atau browser berbeda untuk mencoba beberapa peran sekaligus.

Di `.env.local`, gunakan `LAPAKWU_STORAGE=local` dan `LAPAKWU_NOTIFIKASI=console`. Dalam mode development, email/WhatsApp dicetak di terminal Next.js; ambil OTP atau tautan reset dari sana. Tidak ada pesan eksternal yang dikirim dalam mode ini. Unggahan gambar dan bukti disimpan di `data/unggahan-dev/`. Tanpa PaddleOCR, bukti QRIS tetap masuk untuk pemeriksaan manual admin. Gambar bukti/QRIS bawaan hanya fixture: jangan melakukan pembayaran sungguhan. OCR nyata, pengiriman email/WhatsApp nyata, dan webhook penyedia pembayaran memerlukan konfigurasi layanan masing-masing.

Seed hanya menerima database localhost di luar production. Menjalankannya ulang mempertahankan perubahan pada fixture yang sudah ada, termasuk password dan status pesanan; pesanan tunai contoh kedaluwarsa setelah satu jam, dan checkout baru dapat dibuat untuk mencoba alurnya kembali. Pada komputer lain, siapkan PostgreSQL serta `.env.local` sesuai langkah di bawah sebelum menjalankan demo.

Aplikasi marketplace berbasis Next.js. Website dan API dijalankan oleh Node.js; PostgreSQL menyimpan akun, produk, keranjang, pesanan, pembayaran, serta catatan operasional; Backblaze B2 menyimpan gambar dan bukti pembayaran. Pemeriksaan bukti QRIS memakai PaddleOCR lokal di server. Pembeli tetap dapat memilih tunai di lapak atau transfer/QRIS.

## Menjalankan di komputer pengembangan

1. Siapkan PostgreSQL 15 atau lebih baru dan buat database serta pengguna khusus aplikasi.
2. Salin `.env.example` menjadi `.env.local`, lalu isi `POSTGRES_URL` dan `JWT_SECRET` acak minimal 32 karakter.
3. Jalankan `npm ci` dan `npm run db:setup` untuk membuat tabel, indeks, serta data awal.
4. Jalankan `npm run dev` dan buka `http://localhost:3000`.

Untuk membuat admin pertama, isi `INITIAL_ADMIN_PASSWORD` dengan password sementara minimal 12 karakter, lalu jalankan `npm run admin -- admin@example.com "Admin Lapak"`. Hapus nilai sementara setelah akun dibuat. Pendaftaran pengguna biasa tetap tersedia di aplikasi.

## File dan pemeriksaan pembayaran

Isi `Backblaze_keyID`, `Backblaze_app_key`, dan `Backblaze_bucketName` untuk mengaktifkan foto produk, QRIS mitra, dan unggahan bukti pembayaran. Siapkan Python 3.11 atau 3.12, pasang dependensi dari `scripts/requirements-ocr.txt`, dan isi `OCR_PYTHON` dengan path interpreter virtual environment serta `OCR_NAMA_PENERIMA` sesuai nama merchant di bukti QRIS. Admin menerima hasil OCR sebagai bantuan dan memeriksa dana masuk sebelum menyetujui pembayaran. Bukti dapat dibuka oleh pembeli yang mengunggahnya dan admin.

`EMAIL_USER` dan `EMAIL_PASS` mengaktifkan email; `FONNTE_TOKEN` mengaktifkan WhatsApp; `PAYHOOK_SECRET` mengaktifkan endpoint konfirmasi dana masuk bila layanan webhook yang dipercaya tersedia. Fitur ini opsional.

## Deploy di VPS

Panduan deploy yang dapat diulang ada di `deploy/README.md`. Ringkasnya, aplikasi berjalan di container Docker terpisah pada port lokal khusus, PostgreSQL memakai jaringan Docker privat tanpa port database publik, dan Nginx meneruskan domain HTTPS ke aplikasi. Data PostgreSQL disimpan pada volume persisten. Isi rahasia hanya di `.env.production` pada server dan jangan commit file tersebut.

Periksa koneksi database dengan `npm run db:check`. Pengujian transaksi PostgreSQL yang aman hanya menerima database dengan nama mengandung `test`; jalankan `npm run db:test` setelah mengatur `POSTGRES_URL` ke database test. Cadangkan PostgreSQL sebelum setiap pembaruan aplikasi dan secara berkala.

## Catatan perubahan database

Aplikasi menggunakan PostgreSQL untuk penyimpanan baru. Data MongoDB lama tidak dipindahkan sesuai keputusan proyek. Skrip MongoDB, MySQL, dan Appwrite yang sebelumnya dipakai saat tahap lama sudah dihapus dari jalur operasional.

## Dompet dan unggahan lokal

Admin menyetujui pembayaran QRIS sebelum saldo dicatat. Saldo bisa ditarik setelah pesanan selesai, dengan minimal penarikan Rp10.000. Admin membayar secara manual ke QRIS yang tercatat saat pengajuan lalu mengonfirmasi pencairan.

Untuk pengujian dengan `npm run dev`, `LAPAKWU_STORAGE=local` menyimpan unggahan baru ke `data/unggahan-dev/`. Produksi menggunakan Backblaze B2.
