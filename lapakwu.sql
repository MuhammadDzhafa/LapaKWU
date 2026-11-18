-- ============================================================
--  LapaKWU — Skema Database MySQL
--  Dibuat dari konfigurasi Appwrite TablesDB (setup.mjs)
--  Cocok untuk MySQL 8.0+ / MariaDB 10.6+
-- ============================================================

CREATE DATABASE IF NOT EXISTS lapakwu
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lapakwu;

-- ------------------------------------------------------------
-- 0. users (Tabel Autentikasi Mandiri Pengganti Appwrite Auth)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36)  NOT NULL,
  nama          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 1. pengguna
--    Profil umum setiap akun (pembeli, mitra, admin).
--    id = UUID yang sama dengan user_id di tabel `users` (auth).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pengguna (
  id              VARCHAR(36)  NOT NULL,
  nama            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  no_telepon      VARCHAR(20)  NOT NULL DEFAULT '',
  status_akun     ENUM('MENUNGGU_VERIFIKASI','AKTIF','DITOLAK','DIBLOKIR') NOT NULL,
  kanal           ENUM('EMAIL','WHATSAPP') NOT NULL,
  kontak_terverifikasi TINYINT(1) NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_pengguna_users FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 2. kode_verifikasi
--    Token OTP sementara (email / WhatsApp).
--    id = user_id pemilik kode.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kode_verifikasi (
  id          VARCHAR(36)  NOT NULL,
  kode_hash   VARCHAR(64)  NOT NULL,
  kanal       VARCHAR(20)  NOT NULL,
  tujuan      VARCHAR(255) NOT NULL,
  kedaluwarsa DATETIME     NOT NULL,
  percobaan   INT          NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_kode_pengguna FOREIGN KEY (id) REFERENCES pengguna(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 3. notifikasi
--    Pemberitahuan in-app per pengguna.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifikasi (
  id            VARCHAR(36)  NOT NULL,
  id_pengguna   VARCHAR(36)  NOT NULL,
  judul         VARCHAR(255) NOT NULL,
  pesan         VARCHAR(500) NOT NULL,
  waktu_kirim   DATETIME     NOT NULL,
  sudah_dibaca  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifikasi_pengguna (id_pengguna),
  CONSTRAINT fk_notif_pengguna FOREIGN KEY (id_pengguna) REFERENCES pengguna(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 4. pembeli
--    Data tambahan khusus akun pembeli.
--    id = user_id (1-to-1 dengan pengguna).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pembeli (
  id         VARCHAR(36)  NOT NULL,
  alamat     VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_pembeli_pengguna FOREIGN KEY (id) REFERENCES pengguna(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 5. mitra
--    Data tambahan khusus akun mitra (penjual).
--    id = user_id (1-to-1 dengan pengguna).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mitra (
  id                   VARCHAR(36)  NOT NULL,
  id_admin_verifikator VARCHAR(36)  DEFAULT NULL,
  nama_usaha           VARCHAR(255) NOT NULL,
  alamat_usaha         VARCHAR(255) NOT NULL DEFAULT '',
  catatan_verifikasi   VARCHAR(500) DEFAULT NULL,
  rekening             VARCHAR(100) DEFAULT NULL,
  id_qris              VARCHAR(36)  DEFAULT NULL,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_mitra_pengguna FOREIGN KEY (id) REFERENCES pengguna(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 6. admin
--    Data tambahan khusus akun admin.
--    id = user_id (1-to-1 dengan pengguna).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin (
  id           VARCHAR(36) NOT NULL,
  level_akses  VARCHAR(50) NOT NULL DEFAULT 'SUPER',
  created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_admin_pengguna FOREIGN KEY (id) REFERENCES pengguna(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 7. produk
--    Katalog produk yang dijual setiap mitra.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS produk (
  id         VARCHAR(36)    NOT NULL,
  id_mitra   VARCHAR(36)    NOT NULL,
  nama       VARCHAR(255)   NOT NULL,
  harga      DECIMAL(15,2)  NOT NULL,
  kategori   VARCHAR(100)   NOT NULL,
  deskripsi  TEXT           DEFAULT NULL,
  stok       INT            NOT NULL DEFAULT 0,
  id_gambar  VARCHAR(36)    DEFAULT NULL,
  created_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_produk_mitra (id_mitra),
  CONSTRAINT fk_produk_mitra FOREIGN KEY (id_mitra) REFERENCES mitra(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 8. keranjang
--    Satu keranjang per pembeli.
--    id = user_id pembeli.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS keranjang (
  id           VARCHAR(36)   NOT NULL,
  id_pembeli   VARCHAR(36)   NOT NULL,
  total_harga  DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_keranjang_pembeli FOREIGN KEY (id_pembeli) REFERENCES pembeli(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 9. item_keranjang
--    Baris produk di dalam keranjang pembeli.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS item_keranjang (
  id            VARCHAR(36)   NOT NULL,
  id_keranjang  VARCHAR(36)   NOT NULL,
  id_produk     VARCHAR(36)   NOT NULL,
  jumlah        INT           NOT NULL DEFAULT 1,
  subtotal      DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_item_keranjang (id_keranjang),
  CONSTRAINT fk_item_keranjang   FOREIGN KEY (id_keranjang) REFERENCES keranjang(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_produk      FOREIGN KEY (id_produk)    REFERENCES produk(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 10. pesanan
--     Transaksi pembelian (satu mitra per baris pesanan).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pesanan (
  id                  VARCHAR(36)   NOT NULL,
  id_pembeli          VARCHAR(36)   NOT NULL,
  id_mitra            VARCHAR(36)   NOT NULL,
  tanggal_pesanan     DATETIME      NOT NULL,
  jenis_pemesanan     ENUM('ONLINE','OFFLINE') NOT NULL DEFAULT 'OFFLINE',
  total_harga         DECIMAL(15,2) NOT NULL,
  status_pesanan      ENUM('MENUNGGU_KONFIRMASI','DIPROSES','DIKIRIM','SIAP_DIAMBIL','SELESAI','DIBATALKAN') NOT NULL,
  alamat_pengiriman   VARCHAR(255)  DEFAULT NULL,
  lokasi_pengambilan  VARCHAR(255)  DEFAULT NULL,
  waktu_pengambilan   DATETIME      DEFAULT NULL,
  alasan_pembatalan   VARCHAR(500)  DEFAULT NULL,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pesanan_pembeli (id_pembeli),
  KEY idx_pesanan_mitra   (id_mitra),
  CONSTRAINT fk_pesanan_pembeli FOREIGN KEY (id_pembeli) REFERENCES pengguna(id),
  CONSTRAINT fk_pesanan_mitra   FOREIGN KEY (id_mitra)   REFERENCES mitra(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 11. detail_pesanan
--     Rincian produk per pesanan.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detail_pesanan (
  id          VARCHAR(36)   NOT NULL,
  id_pesanan  VARCHAR(36)   NOT NULL,
  id_produk   VARCHAR(36)   NOT NULL,
  jumlah      INT           NOT NULL,
  harga_satuan DECIMAL(15,2) NOT NULL,
  subtotal    DECIMAL(15,2) NOT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_detail_pesanan (id_pesanan),
  CONSTRAINT fk_detail_pesanan FOREIGN KEY (id_pesanan) REFERENCES pesanan(id) ON DELETE CASCADE,
  CONSTRAINT fk_detail_produk  FOREIGN KEY (id_produk)  REFERENCES produk(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 12. payment_gateway
--     Daftar penyedia pembayaran yang tersedia.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_gateway (
  id             VARCHAR(36)  NOT NULL,
  nama_layanan   VARCHAR(100) NOT NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 13. pembayaran
--     Catatan transaksi pembayaran setiap pesanan.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pembayaran (
  id                 VARCHAR(36)   NOT NULL,
  id_pesanan         VARCHAR(36)   NOT NULL,
  id_gateway         VARCHAR(36)   DEFAULT NULL,
  metode             VARCHAR(50)   NOT NULL,
  jumlah             DECIMAL(15,2) NOT NULL,
  status_pembayaran  ENUM('MENUNGGU','BERHASIL','GAGAL','REFUND_DIAJUKAN','DIKEMBALIKAN') NOT NULL,
  waktu_bayar        DATETIME      DEFAULT NULL,
  id_bukti           VARCHAR(36)   DEFAULT NULL,
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pembayaran_pesanan (id_pesanan),
  KEY idx_pembayaran_status  (status_pembayaran),
  CONSTRAINT fk_pembayaran_pesanan  FOREIGN KEY (id_pesanan) REFERENCES pesanan(id) ON DELETE CASCADE,
  CONSTRAINT fk_pembayaran_gateway  FOREIGN KEY (id_gateway) REFERENCES payment_gateway(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 14. rekap_penjualan
--     Rekapitulasi penjualan mitra per bulan (periode = YYYY-MM).
--     id = {id_mitra}_{YYYY-MM}
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rekap_penjualan (
  id                  VARCHAR(50)   NOT NULL,
  id_mitra            VARCHAR(36)   NOT NULL,
  periode             VARCHAR(10)   NOT NULL,
  total_penjualan     DECIMAL(15,2) NOT NULL DEFAULT 0,
  jumlah_transaksi    INT           NOT NULL DEFAULT 0,
  total_komisi        DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_digital       DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_offline       DECIMAL(15,2) NOT NULL DEFAULT 0,
  jumlah_offline      INT           NOT NULL DEFAULT 0,
  status_pencairan    ENUM('BELUM','DIAJUKAN','DICAIRKAN') NOT NULL DEFAULT 'BELUM',
  tanggal_cair        DATETIME      DEFAULT NULL,
  catatan_cair        VARCHAR(255)  DEFAULT NULL,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rekap_mitra           (id_mitra),
  KEY idx_rekap_status_pencairan (status_pencairan),
  CONSTRAINT fk_rekap_mitra FOREIGN KEY (id_mitra) REFERENCES mitra(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 15. penjualan_offline
--     Transaksi penjualan langsung (walk-in) per mitra.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS penjualan_offline (
  id           VARCHAR(36)   NOT NULL,
  id_mitra     VARCHAR(36)   NOT NULL,
  id_produk    VARCHAR(36)   NOT NULL,
  nama_produk  VARCHAR(255)  NOT NULL,
  jumlah       INT           NOT NULL,
  harga_satuan DECIMAL(15,2) NOT NULL,
  subtotal     DECIMAL(15,2) NOT NULL,
  waktu        DATETIME      NOT NULL,
  periode      VARCHAR(10)   NOT NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_offline_mitra   (id_mitra),
  KEY idx_offline_produk  (id_produk),
  KEY idx_offline_periode (periode),
  CONSTRAINT fk_offline_mitra  FOREIGN KEY (id_mitra)  REFERENCES mitra(id)  ON DELETE CASCADE,
  CONSTRAINT fk_offline_produk FOREIGN KEY (id_produk) REFERENCES produk(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  Data awal
-- ============================================================

-- Simulasi Gateway (ID tetap = 'simulasi', sesuai setup.mjs)
INSERT IGNORE INTO payment_gateway (id, nama_layanan)
VALUES ('simulasi', 'Simulasi Gateway');

-- ============================================================
--  Selesai.
--  Langkah berikutnya:
--  1. Import file ini ke server MySQL Firdaus:
--       mysql -u <user> -p < lapakwu.sql
--  2. Ganti konfigurasi koneksi di aplikasi Next.js
--     (src/lib/db.js baru) dari Appwrite ke MySQL.
--  3. Pastikan backend Next.js bisa terhubung ke DB server.
-- ============================================================
