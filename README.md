# LapaKWU

Aplikasi Next.js (Node.js 22+) dengan autentikasi JWT, MongoDB Atlas Free (M0), dan PaddleOCR yang berjalan di CPU server sendiri. Checkout QRIS tetap dapat diperiksa manual saat OCR tidak tersedia.

## MongoDB Atlas

1. Buat cluster [Atlas Free (M0)](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/). Buat database user dengan akses baca dan tulis pada database aplikasi, lalu izinkan IP server aplikasi.
2. Isi `MONGODB_URI` dan `MONGODB_DB` di `.env.local`. Pada instalasi baru, gunakan `.env.example` sebagai acuan dan buat `JWT_SECRET` acak. Untuk migrasi, pertahankan `JWT_SECRET` lama agar sesi yang masih berlaku tetap dapat dibaca.
3. Jalankan `npm ci` lalu `npm run setup` untuk membuat koleksi, indeks, dan data awal. Setelah database siap, jalankan `npm run dev`. Untuk produksi, jalankan `npm run build` dan `npm start` di server dengan disk persisten.
4. Untuk membuat admin pertama, isi `MONGODB_ADMIN_PASSWORD` sementara dalam lingkungan terminal lalu jalankan `npm run admin -- admin@example.com "Admin LapaKWU"`. Hapus variabel setelah selesai.

## MongoDB lokal untuk pengembangan

Atur `MONGODB_URI=mongodb://127.0.0.1:27029/?replicaSet=lapakwuDev` dan `MONGODB_DB=lapakwu` di `.env.local`. Jalankan `npm run mongodb:local` sebelum setup atau migrasi. Perintah ini memakai `data/mongodb-dev/mongod.exe` atau executable dari `MONGOD_PATH`, menyimpan data di `data/mongodb-dev/db`, dan membuka koneksi hanya di komputer ini. `npm run dev` menjalankannya otomatis jika URI lokal tersebut aktif.

## Backblaze B2 storage

Isi tiga variabel berikut di `.env.local`. Product photos, store QRIS images, and payment proofs are stored in the configured B2 bucket.

```env
Backblaze_keyID=
Backblaze_app_key=
Backblaze_bucketName=
```

## Memindahkan data dari MySQL

Cadangkan sumber dan hentikan penulisan ke MySQL selama transfer akhir. Gunakan database MongoDB tujuan yang kosong untuk migrasi pertama. Atur `MYSQL_SOURCE_URL` di `.env.local` atau gunakan `DATABASE_URL` lama, lalu jalankan `npm run migrate:mysql` dan `npm run setup`. Skrip memindahkan 16 tabel dengan ID, hash kata sandi, tanggal, dan relasi yang sama. Skrip dapat diulang setelah terputus. ID yang sudah ada dilewati, sehingga perubahan lanjutan pada baris yang sudah dipindah tidak akan tersalin. Aplikasi berjalan dengan MongoDB dan driver MySQL hanya diperlukan untuk menjalankan skrip migrasi.

Bandingkan jumlah baris yang dilaporkan, lalu periksa login, katalog, riwayat pesanan, dan akses bukti lama sebelum mengarahkan trafik ke MongoDB. File media disimpan di Backblaze B2, sementara database menyimpan ID-nya.

## PaddleOCR untuk bukti QRIS

Buat virtual environment Python 3.11 atau 3.12 di server aplikasi. Di Windows, jalankan:

```powershell
py -3.12 -m venv .venv-ocr
.\.venv-ocr\Scripts\python.exe -m pip install -r scripts/requirements-ocr.txt --extra-index-url https://www.paddlepaddle.org.cn/packages/stable/cpu/
```

Di Linux, gunakan `python3.12 -m venv .venv-ocr` dan jalankan perintah pip yang sama dengan `.venv-ocr/bin/python`. Di `.env.local`, isi `OCR_PYTHON` dengan path interpreter tersebut dan `OCR_NAMA_PENERIMA` dengan nama merchant persis seperti yang tercetak pada bukti QRIS. Jalankan skrip sekali dengan gambar contoh untuk mengunduh dan menyiapkan model sebelum menerima pesanan. PaddleOCR berjalan lokal tanpa API OCR berbayar. [Panduan PaddleOCR CPU](https://www.paddleocr.ai/v3.3.2/en/quick_start.html)

Backend membandingkan hasil OCR dengan total checkout yang dihitung dari database, nama penerima yang dikonfigurasi, dan tanggal kalender Jakarta hari ini atau kemarin. Hasil OCR ditampilkan di panel verifikasi. Admin mencocokkan dana yang masuk dan menyetujui transaksi sebelum invoice tersedia bagi pembeli dan mitra. Jika OCR gagal membaca bukti, admin dapat meninjaunya secara manual.

PayHook opsional. Jika sudah dipakai, atur `PAYHOOK_SECRET` dan kirim nilainya melalui header `x-payhook-secret`. PayHook menandai dana masuk jika nominal dan referensi transaksi cocok dengan satu bukti OCR. Persetujuan pembayaran dilakukan oleh admin.

Bukti baru berukuran maksimal 2 MB. Dokumen bukti dapat dibuka oleh pembeli yang mengunggahnya dan admin yang sudah masuk.

## Dompet dan unggahan lokal

Pembayaran QRIS yang disetujui tampil sebagai saldo pesanan berjalan. Saldo tersedia setelah pesanan selesai dan mitra bisa mengajukan pencairan mulai Rp10.000. Admin melihat QRIS yang dipakai saat pengajuan, membayar secara manual, lalu mengonfirmasi pencairan.

Untuk pengujian dengan `npm run dev`, `LAPAKWU_STORAGE=local` menyimpan unggahan ke `data/unggahan-dev/`. Konfigurasi produksi menggunakan Backblaze B2.
