# LapaKWU

Next.js + Appwrite (Auth, TablesDB, Storage, Sites). Semua layanan memakai paket gratis.

1. `cp .env.example .env.local` lalu isi (Appwrite wajib; Brevo dan/atau Fonnte untuk kode verifikasi dan notifikasi)
2. `npm install`
3. `npm run setup` (database, 15 tabel, index, bucket)
4. `npm run dev`, daftar akun, lalu `npm run admin -- <USER_ID>` untuk menjadikannya admin
5. Push ke GitHub, hubungkan ke Appwrite Sites (Next.js, SSR, jangan isi `output`), isi semua env var, tambahkan domain Sites sebagai Web platform


Untuk proyek yang sudah pernah di-setup: jalankan lagi `npm run setup`. Skrip aman diulang dan hanya menambah tabel `penjualan_offline` serta kolom `total_offline` dan `jumlah_offline` di `rekap_penjualan` (tunggu beberapa detik sampai kolom berstatus available di console Appwrite sebelum memakai fitur stok offline).
