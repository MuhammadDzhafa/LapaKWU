# Deploy LapaKWU di VPS Bluepack

## Arsitektur deploy

- Docker Compose mengelola satu container Next.js (website, API, dan PaddleOCR) serta satu container PostgreSQL.
- PostgreSQL hanya ada di jaringan Docker privat. Tidak ada port database yang diterbitkan ke host/internet.
- Next.js diterbitkan hanya ke `127.0.0.1:3101`; Nginx yang sudah ada meneruskan HTTPS dari `lapakwu.bluepack.my.id` ke port itu.
- Volume `postgres-data` menyimpan isi PostgreSQL saat container diperbarui.
- Foto produk dan bukti pembayaran memakai Backblaze B2.

TLS dihentikan di Nginx pada blok HTTPS di bawah. Security response headers juga dipasang di Nginx, jadi tetap dikirim dari origin ketika Cloudflare bertindak sebagai proxy. Hindari menetapkan nilai header berbeda di Cloudflare agar tidak terjadi nilai ganda atau bertentangan.

## Persiapan satu kali

1. Arahkan DNS `lapakwu.bluepack.my.id` ke alamat publik VPS. Pastikan port TCP 80/443 dapat diakses dari internet.
2. Pastikan Docker Compose, Nginx, dan Certbot tersedia. Jangan mengubah konfigurasi Nginx untuk aplikasi lain.
3. Sebelum memakai port 3101, pastikan port tersebut kosong: `sudo ss -lntp | grep ':3101 '`. Jika sudah dipakai, ubah `LAPAKWU_PORT` di `.env.production` dan `proxy_pass` Nginx ke port kosong lain.
4. Clone repository ke `/opt/lapukwu` (atau folder deploy khusus lain), lalu salin `.env.production.example` menjadi `.env.production` dan `.env.production.secrets.example` menjadi `.env.production.secrets`.
5. Buat password DB acak yang hanya berisi hex, misalnya `openssl rand -hex 32`; isi `PG_PASSWORD`. Buat `JWT_SECRET` dengan `openssl rand -base64 48`. Isi tiga kredensial Backblaze B2 dan `OCR_NAMA_PENERIMA` di file `.env.production.secrets`. Jangan kirim atau commit kedua file `.env.production*` tersebut.

## Deploy dan setup database baru

Jalankan dari folder repository:

```sh
docker compose --env-file .env.production build web
docker compose --env-file .env.production up -d db
docker compose --env-file .env.production run --rm web npm run db:setup
docker compose --env-file .env.production up -d web
docker compose --env-file .env.production ps
```

Database baru ini sengaja dimulai kosong sesuai keputusan bahwa data lama MongoDB tidak perlu dipindahkan. Buat akun admin pertama secara eksplisit; jangan gunakan password contoh:

```sh
INITIAL_ADMIN_PASSWORD='password-acak-minimal-12-karakter' \
  docker compose --env-file .env.production run --rm -e INITIAL_ADMIN_PASSWORD web \
  npm run admin -- admin@bluepack.my.id 'Admin Lapak'
```

Lebih baik ekspor variabel admin sementara di shell, jalankan perintah, lalu `unset INITIAL_ADMIN_PASSWORD` agar password tidak masuk ke riwayat perintah.

## HTTPS tanpa mengganggu Nginx yang sudah ada

Pasang file `nginx-lapukwu.conf` di `sites-available`, tetapi Nginx memerlukan sertifikat sebelum blok HTTPS bisa dimuat. Urutan awal:

1. Pasang `nginx-http-bootstrap.conf` sebagai site sementara.
2. Jalankan `sudo nginx -t`, lalu reload Nginx.
3. Jalankan `sudo certbot certonly --webroot -w /var/www/certbot -d lapakwu.bluepack.my.id`.
4. Ganti site sementara dengan `nginx-lapukwu.conf`, jalankan `sudo nginx -t`, lalu reload.
5. Periksa perpanjangan sertifikat dengan `sudo certbot renew --dry-run`.

Jangan mengganti atau menonaktifkan site Nginx lain. Periksa konflik `server_name` sebelum mengaktifkan konfigurasi LapakKWU.

## Verifikasi, pembaruan, dan backup

```sh
docker compose --env-file .env.production ps
docker compose --env-file .env.production exec web npm run db:check
curl -fsS https://lapakwu.bluepack.my.id/api/health
curl -fsS https://lapakwu.bluepack.my.id/ -o /dev/null -w '%{http_code}\n'
```

Sebelum pembaruan, buat backup lalu build dan ganti container web. Jangan menghapus volume database:

```sh
docker compose --env-file .env.production exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "backup-lapakwu-$(date +%F-%H%M).sql"
docker compose --env-file .env.production build web
docker compose --env-file .env.production run --rm web npm run db:setup
docker compose --env-file .env.production up -d web
```

Simpan backup di lokasi terpisah yang terlindungi; dump berisi informasi akun dan transaksi. Jangan jalankan `docker compose down -v` karena perintah itu menghapus volume PostgreSQL.
