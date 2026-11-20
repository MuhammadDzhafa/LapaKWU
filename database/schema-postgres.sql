CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  session_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS rate_limit (
  id TEXT PRIMARY KEY, hits INTEGER NOT NULL, window_start TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS pengguna (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nama TEXT NOT NULL, email TEXT NOT NULL, no_telepon TEXT NOT NULL DEFAULT '',
  status_akun TEXT NOT NULL, kanal TEXT NOT NULL, kontak_terverifikasi BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS kode_verifikasi (
  id TEXT PRIMARY KEY REFERENCES pengguna(id) ON DELETE CASCADE,
  kode_hash TEXT NOT NULL, kanal TEXT NOT NULL, tujuan TEXT NOT NULL, kedaluwarsa TIMESTAMPTZ NOT NULL,
  percobaan INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS notifikasi (
  id TEXT PRIMARY KEY, id_pengguna TEXT NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
  judul TEXT NOT NULL, pesan TEXT NOT NULL, waktu_kirim TIMESTAMPTZ NOT NULL, sudah_dibaca BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS pembeli (
  id TEXT PRIMARY KEY REFERENCES pengguna(id) ON DELETE CASCADE, alamat TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS mitra (
  id TEXT PRIMARY KEY REFERENCES pengguna(id) ON DELETE CASCADE,
  id_admin_verifikator TEXT REFERENCES pengguna(id) ON DELETE SET NULL,
  nama_usaha TEXT NOT NULL, alamat_usaha TEXT NOT NULL DEFAULT '', catatan_verifikasi TEXT, rekening TEXT, id_qris TEXT,
  nomor_tenant INTEGER UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS admin (
  id TEXT PRIMARY KEY REFERENCES pengguna(id) ON DELETE CASCADE, level_akses TEXT NOT NULL DEFAULT 'SUPER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS produk (
  id TEXT PRIMARY KEY, id_mitra TEXT NOT NULL REFERENCES mitra(id) ON DELETE CASCADE,
  nama TEXT NOT NULL, harga NUMERIC(15,2) NOT NULL, kategori TEXT NOT NULL, deskripsi TEXT,
  stok INTEGER NOT NULL DEFAULT 0, id_gambar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS keranjang (
  id TEXT PRIMARY KEY, id_pembeli TEXT NOT NULL REFERENCES pembeli(id) ON DELETE CASCADE,
  total_harga NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS item_keranjang (
  id TEXT PRIMARY KEY, id_keranjang TEXT NOT NULL REFERENCES keranjang(id) ON DELETE CASCADE,
  id_produk TEXT NOT NULL REFERENCES produk(id) ON DELETE CASCADE, jumlah INTEGER NOT NULL DEFAULT 1, subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS pesanan (
  id TEXT PRIMARY KEY, id_pembeli TEXT NOT NULL REFERENCES pengguna(id), id_mitra TEXT NOT NULL REFERENCES mitra(id),
  tanggal_pesanan TIMESTAMPTZ NOT NULL, jenis_pemesanan TEXT NOT NULL DEFAULT 'OFFLINE', total_harga NUMERIC(15,2) NOT NULL,
  status_pesanan TEXT NOT NULL, alamat_pengiriman TEXT, lokasi_pengambilan TEXT, waktu_pengambilan TIMESTAMPTZ, alasan_pembatalan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS detail_pesanan (
  id TEXT PRIMARY KEY, id_pesanan TEXT NOT NULL REFERENCES pesanan(id) ON DELETE CASCADE,
  id_produk TEXT NOT NULL REFERENCES produk(id), jumlah INTEGER NOT NULL, harga_satuan NUMERIC(15,2) NOT NULL, subtotal NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS payment_gateway (
  id TEXT PRIMARY KEY, nama_layanan TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS pembayaran (
  id TEXT PRIMARY KEY, id_pesanan TEXT NOT NULL REFERENCES pesanan(id) ON DELETE CASCADE,
  id_gateway TEXT REFERENCES payment_gateway(id) ON DELETE SET NULL, metode TEXT NOT NULL, jumlah NUMERIC(15,2) NOT NULL,
  status_pembayaran TEXT NOT NULL, waktu_bayar TIMESTAMPTZ, id_bukti TEXT, id_bukti_checkout TEXT,
  status_ocr TEXT, catatan_ocr JSONB, hasil_ocr JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS rekap_penjualan (
  id TEXT PRIMARY KEY, id_mitra TEXT NOT NULL REFERENCES mitra(id) ON DELETE CASCADE, periode TEXT NOT NULL,
  total_penjualan NUMERIC(15,2) NOT NULL DEFAULT 0, jumlah_transaksi INTEGER NOT NULL DEFAULT 0,
  total_komisi NUMERIC(15,2) NOT NULL DEFAULT 0, total_digital NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_offline NUMERIC(15,2) NOT NULL DEFAULT 0, jumlah_offline INTEGER NOT NULL DEFAULT 0,
  status_pencairan TEXT NOT NULL DEFAULT 'BELUM', tanggal_cair TIMESTAMPTZ, catatan_cair TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS penjualan_offline (
  id TEXT PRIMARY KEY, id_mitra TEXT NOT NULL REFERENCES mitra(id) ON DELETE CASCADE,
  id_produk TEXT NOT NULL REFERENCES produk(id) ON DELETE RESTRICT, nama_produk TEXT NOT NULL,
  jumlah INTEGER NOT NULL, harga_satuan NUMERIC(15,2) NOT NULL, subtotal NUMERIC(15,2) NOT NULL,
  waktu TIMESTAMPTZ NOT NULL, periode TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS unggahan_bukti (
  id TEXT PRIMARY KEY, id_pembeli TEXT NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
  ukuran BIGINT NOT NULL, sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS unggahan_file (
  id TEXT PRIMARY KEY, id_pengguna TEXT NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
  ukuran INTEGER NOT NULL, jenis TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_unggahan_file_user_waktu ON unggahan_file(id_pengguna, created_at DESC);
CREATE TABLE IF NOT EXISTS bukti_checkout (
  id TEXT PRIMARY KEY, id_pembeli TEXT NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE, id_bukti TEXT NOT NULL,
  total NUMERIC(15,2) NOT NULL, status_ocr TEXT NOT NULL, referensi TEXT, status_pembayaran TEXT NOT NULL, waktu_bayar TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS checkout_request (
  id TEXT PRIMARY KEY, id_pembeli TEXT NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
  response JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS payhook_event (
  id TEXT PRIMARY KEY, id_bukti_checkout TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS pencairan_dompet (
  id TEXT PRIMARY KEY, id_mitra TEXT NOT NULL, nama_usaha TEXT NOT NULL, id_qris TEXT NOT NULL,
  nominal NUMERIC(15,2) NOT NULL CHECK (nominal >= 10000),
  status TEXT NOT NULL CHECK (status IN ('DIAJUKAN', 'DICAIRKAN')),
  tanggal_cair TIMESTAMPTZ, id_admin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), extra JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_pencairan_mitra_waktu ON pencairan_dompet(id_mitra, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pencairan_status_waktu ON pencairan_dompet(status, created_at);

CREATE INDEX IF NOT EXISTS idx_notifikasi_pengguna ON notifikasi(id_pengguna, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_produk_mitra ON produk(id_mitra);
CREATE INDEX IF NOT EXISTS idx_item_keranjang_keranjang ON item_keranjang(id_keranjang);
CREATE INDEX IF NOT EXISTS idx_pesanan_pembeli ON pesanan(id_pembeli);
CREATE INDEX IF NOT EXISTS idx_pesanan_mitra_status_waktu ON pesanan(id_mitra, status_pesanan, tanggal_pesanan);
CREATE INDEX IF NOT EXISTS idx_detail_pesanan_pesanan ON detail_pesanan(id_pesanan);
CREATE INDEX IF NOT EXISTS idx_pembayaran_pesanan ON pembayaran(id_pesanan);
CREATE INDEX IF NOT EXISTS idx_pembayaran_bukti ON pembayaran(id_bukti);
CREATE INDEX IF NOT EXISTS idx_pembayaran_checkout_metode ON pembayaran(id_bukti_checkout, metode);
CREATE INDEX IF NOT EXISTS idx_pembayaran_status_waktu ON pembayaran(metode, status_pembayaran, created_at);
CREATE INDEX IF NOT EXISTS idx_bukti_checkout_cocok ON bukti_checkout(referensi, total, status_ocr, status_pembayaran, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rekap_mitra_periode ON rekap_penjualan(id_mitra, periode);
CREATE INDEX IF NOT EXISTS idx_penjualan_offline_laporan ON penjualan_offline(id_mitra, id_produk, periode, waktu DESC);
