# LapaKWU · Demo 55 detik

Demo mandiri berbahasa Indonesia untuk pengunjung dan mitra bazar. Urutan dan caption ada di [timeline](../src/demo-timeline.js). Alur pengunjung mendapat porsi pertama, lalu denah menutup perjalanan ke stan sebelum fokus berpindah ke mitra. Potongan pembayaran dan uang tunai memakai status demo. Data contoh diisolasi pada sesi browser pengambilan gambar.

Gaya visual mengikuti warna aplikasi (#FF933E, #FFCB56, #FFE9A9, #73A5CA, #22313F), tipografi Plus Jakarta Sans dengan fallback Segoe UI, sudut membulat, garis tipis, dan bayangan lembut. Layar halaman utuh dipakai sebagai tekstur, sedangkan potongan UI memberi contoh konkret tanpa kehilangan keterbacaan. Referensi musik dipakai pada 55 detik pertama dengan penutupan audio halus.

- [depth-layer-moves · multiplane](https://vincentwei1021.github.io/video-shotcraft/library.html) untuk pembuka, katalog, denah, dan dasbor. Koefisien parallax 0,35 / 0,7 / 1,4 dengan caption tetap. Adaptasi dari `demos/camera/depth-layer-moves/MultiplaneReal.tsx`.
- [cursor-flyover](https://vincentwei1021.github.io/video-shotcraft/library.html) untuk pencarian, keranjang, metode pembayaran, dan dompet. Kamera mengikuti satu titik fokus dan mereda sebelum ripple 18 frame. Adaptasi dari `demos/camera/cursor-flyover/CursorFlyover.tsx`. `PageCam` memakai tekstur DPR 2 dan zoom pada layout untuk menjaga ketajaman.

Anchor awal tiap fitur dan kemunculan potongan UI dipilih dari transient kick/snare. `beatF()` mengubah posisi beat hasil analisis ke frame hanya di batas Remotion.

## Revisi animasi web

`node demo/capture.mjs --live` merekam interaksi Chrome dari UI asli dengan animasi situs aktif. Katalog, hasil pencarian, jumlah keranjang, pratinjau bukti QRIS, pilihan tunai, dialog denah, dan tab mitra memakai tangkapan bergerak. Data, struk, dan mutasi contoh hanya berlaku dalam browser pengambilan gambar. `--only=cart,payment` merekam ulang klip tertentu dari daftar.

Komposisi tetap 55 detik dengan audio dan penanda beat yang sama. Di awal tiap shot, mask diagonal, vertikal, atau melingkar membuka shot baru di atas frame terakhir shot sebelumnya. Sapuan cahaya memperjelas arah gerak.
