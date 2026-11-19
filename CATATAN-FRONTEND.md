# Pembaruan front end LapaKWU

Timpa folder `src/` proyekmu dengan isi zip ini (struktur folder sama). Tidak ada dependensi baru, tidak ada perubahan di backend, API, atau database.

## Baru
- `src/components/Motion.jsx`: pengatur gerak global (progres scroll, header yang menyesuaikan diri, reveal saat scroll, cahaya kursor, tombol magnetik, riak, angka menghitung naik, animasi terbang ke keranjang). Otomatis mati bila pengguna memilih "kurangi gerakan".

## Diubah
- `src/app/globals.css`: lapisan v2 ditambahkan di akhir file. Palet di `:root` tidak disentuh.
- `src/app/page.jsx`, `src/components/Shell.jsx`, `src/components/Lapak.jsx`: hero, statistik, kartu produk, navbar, ilustrasi.
- `src/components/Modal.jsx`: gaya inline diganti kelas CSS berbasis palet.
- `masuk`, `daftar`, `lupa-sandi`, `reset-sandi`, `verifikasi`: ditambah kelas `auth`.
- `Pesanan.jsx`, `admin`, `mitra`, `checkout`, `tata-cara`: warna abu-abu/hijau/biru/amber bawaan Tailwind diganti token palet yang setara.

## Pintasan
Tekan `/` di beranda untuk langsung mencari produk.
