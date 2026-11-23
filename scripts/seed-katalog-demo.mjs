import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { JUMLAH_TENANT } from '../src/lib/tenant.js';
import { denganTransaksi, getDatabase, queryDatabase } from '../src/lib/db.js';

const url = new URL(process.env.POSTGRES_URL || process.env.DATABASE_URL);
if (process.env.NODE_ENV === 'production'
  || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  || !/^\/lapakwu_(dev|test(?:_[a-z0-9]+)?)$/.test(url.pathname)) {
  throw new Error('Katalog demo hanya boleh diisi di database LapaKWU dev atau test pada localhost.');
}

const katalog = [
  ['Dapur', 'Makanan', ['Keripik Singkong', 'Nasi Ayam', 'Tahu Crispy', 'Brownies Cokelat']],
  ['Kedai', 'Minuman', ['Es Kopi Susu', 'Teh Lemon', 'Cokelat Dingin', 'Susu Stroberi']],
  ['Studio', 'Kerajinan', ['Gantungan Kunci', 'Gelang Manik', 'Magnet Kulkas', 'Stiker Ilustrasi']],
  ['Butik', 'Fashion', ['Tote Bag Kanvas', 'Kaos Kampus', 'Topi Katun', 'Dompet Kain']],
  ['Pojok', 'Perlengkapan', ['Buku Catatan', 'Tempat Pensil', 'Botol Minum', 'Map Dokumen']],
];
const jumlahLapak = 90;
const produkPerLapak = 91;
const lapak = Array.from({ length: jumlahLapak }, (_, i) => {
  const [nama, kategori, jenis] = katalog[i % katalog.length];
  const nomor = String(i + 1).padStart(2, '0');
  const id = `katalog-demo-lapak-${nomor}`;
  return { id, nama: `${nama} Kampus ${nomor} (Demo)`, email: `${id}@example.invalid`, kategori, jenis };
});
const produk = lapak.flatMap(({ id, kategori, jenis }, indeksLapak) =>
  Array.from({ length: produkPerLapak }, (_, i) => ({
    id: `${id}-produk-${i + 1}`,
    id_mitra: id,
    nama: `${jenis[i % jenis.length]} · Varian ${Math.floor(i / jenis.length) + 1}`,
    kategori,
    harga: 5000 + ((i + indeksLapak) % 36) * 1000,
    stok: 8 + (i % 30),
  })),
);

const pool = await getDatabase();
try {
  const passwordHash = await bcrypt.hash(randomUUID(), 12);
  const lapakJson = JSON.stringify(lapak);
  await denganTransaksi(async () => {
    await queryDatabase('LOCK TABLE mitra IN SHARE ROW EXCLUSIVE MODE');
    await queryDatabase(`
      INSERT INTO users (id, nama, email, password_hash)
      SELECT id, nama, email, $2 FROM jsonb_to_recordset($1::jsonb) AS l(id text, nama text, email text)
      ON CONFLICT (id) DO NOTHING
    `, [lapakJson, passwordHash]);
    await queryDatabase(`
      INSERT INTO pengguna (id, nama, email, status_akun, kanal, kontak_terverifikasi)
      SELECT id, nama, email, 'AKTIF', 'EMAIL', true FROM jsonb_to_recordset($1::jsonb) AS l(id text, nama text, email text)
      ON CONFLICT (id) DO NOTHING
    `, [lapakJson]);
    await queryDatabase(`
      WITH lapak_baru AS (
        SELECT id, nama, row_number() OVER (ORDER BY id) AS urutan
        FROM jsonb_to_recordset($1::jsonb) AS l(id text, nama text)
        WHERE NOT EXISTS (SELECT 1 FROM mitra m WHERE m.id = l.id)
      ), tenant_kosong AS (
        SELECT nomor, row_number() OVER (ORDER BY nomor) AS urutan
        FROM generate_series(1, $2::integer) AS tenant(nomor)
        WHERE NOT EXISTS (SELECT 1 FROM mitra m WHERE m.nomor_tenant = tenant.nomor)
      )
      INSERT INTO mitra (id, nama_usaha, nomor_tenant)
      SELECT id, nama, nomor FROM lapak_baru LEFT JOIN tenant_kosong USING (urutan)
      ON CONFLICT (id) DO NOTHING
    `, [lapakJson, JUMLAH_TENANT]);
    await queryDatabase(`
      INSERT INTO produk (id, id_mitra, nama, kategori, harga, stok)
      SELECT id, id_mitra, nama, kategori, harga, stok
      FROM jsonb_to_recordset($1::jsonb) AS p(id text, id_mitra text, nama text, kategori text, harga numeric, stok int)
      ON CONFLICT (id) DO NOTHING
    `, [JSON.stringify(produk)]);
    const { rows } = await queryDatabase(`
      SELECT m.id, count(p.id)::int AS jumlah
      FROM mitra m LEFT JOIN produk p ON p.id_mitra = m.id AND p.id LIKE 'katalog-demo-lapak-%'
      WHERE m.id = ANY($1)
      GROUP BY m.id
    `, [lapak.map(({ id }) => id)]);
    assert.equal(rows.length, jumlahLapak);
    assert.ok(rows.every(({ jumlah }) => jumlah === produkPerLapak));
  });
  console.log(`Katalog demo siap: ${jumlahLapak} lapak, ${produk.length} produk, ${produkPerLapak} per lapak.`);
} finally {
  await pool.end();
}
