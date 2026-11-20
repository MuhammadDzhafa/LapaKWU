# Catatan perubahan frontend v3

Hanya tampilan yang diubah. API, database, dan logika bisnis tidak disentuh. Palet warna tidak berubah.

## File baru
- `src/components/Ikon.jsx` : ikon garis kecil (warna mengikuti teks sekitarnya).

## File yang diubah
- `src/app/globals.css` : lapisan "v3" ditambahkan di bagian paling bawah (file lama tidak dihapus).
- `src/components/Shell.jsx` : dock navigasi bawah untuk HP.
- `src/components/Motion.jsx` : label sel tabel otomatis, tab yang diketuk bergeser ke tengah.
- `src/components/Pesanan.jsx` : pelacak tahap pesanan di tiap kartu pesanan.
- `src/app/admin/page.jsx` : kepala dashboard, ringkasan yang bisa diketuk, tab ber-ikon, pratinjau gambar tanpa gaya inline.
- `src/app/mitra/page.jsx` : kepala dashboard, ringkasan, tab ber-ikon.

## Cara mencoba
`npm run demo`, lalu login sebagai admin / mitra / pembeli (lihat README) dan buka lewat HP atau lebar layar < 700px.

## Putaran animasi (v4)
- `src/app/layout.jsx` : tirai tenda saat pertama masuk (sekali per sesi, dilewati bila "kurangi gerakan" aktif).
- `src/components/Motion.jsx` : tilt 3D kartu produk dan percikan warna saat produk masuk keranjang.
- `src/app/globals.css` : lapisan "v4" di paling bawah (gerak pegas, tenda yang bergerak, cincin warna pada pencarian, parallax scroll, napas pada keranjang).

## Putaran "canggih" (v5)
- Garis belang tenda di hero dan kepala dashboard kembali diam (tidak bergeser).
- Indikator meluncur dengan pegas antar tab dashboard dan antar menu dock HP.
- Penunjuk kursor halus yang membesar di atas tombol dan kartu (hanya mouse/trackpad).
- Cincin warna berputar di tepi kartu produk saat disorot; kilau sekali lewat di judul hero.
