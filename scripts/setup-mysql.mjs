// scripts/setup-mysql.mjs
// Setup database MySQL dan buat admin langsung di server:
// Jalankan skema: node --env-file=.env.local scripts/setup-mysql.mjs
// Buat akun admin: node --env-file=.env.local scripts/setup-mysql.mjs --admin admin@lapakwu.id sandi1234 "Admin Lapak"
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { nanoid } from 'nanoid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ DATABASE_URL belum diatur di file .env.local');
  console.error('   Contoh: DATABASE_URL=mysql://user:password@localhost:3306/lapakwu');
  process.exit(1);
}

async function run() {
  const isMakeAdmin = process.argv[2] === '--admin';

  // Jika migrasi skema awal, hubungkan tanpa memilih nama database dulu (agar tidak error 'Unknown database')
  let connUri = dbUrl;
  if (!isMakeAdmin) {
    try {
      const u = new URL(dbUrl);
      u.pathname = '';
      connUri = u.toString();
    } catch {}
  }

  const conn = await mysql.createConnection({
    uri: connUri,
    multipleStatements: true,
  });

  try {
    const isMakeAdmin = process.argv[2] === '--admin';

    if (isMakeAdmin) {
      const email = process.argv[3];
      const password = process.argv[4];
      const nama = process.argv[5] || 'Super Administrator';

      if (!email || !password) {
        console.error('❌ Gunakan format: npm run admin -- <email> <password> [nama]');
        process.exit(1);
      }

      console.log(`⏳ Membuat / memperbarui akun admin untuk ${email}...`);
      const hash = await bcrypt.hash(password, 12);

      const [existing] = await conn.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      let uid = existing[0]?.id;

      if (uid) {
        await conn.execute('UPDATE users SET password_hash = ?, nama = ? WHERE id = ?', [hash, nama, uid]);
      } else {
        uid = nanoid();
        await conn.execute('INSERT INTO users (id, nama, email, password_hash) VALUES (?, ?, ?, ?)', [uid, nama, email, hash]);
      }

      // Pastikan ada di tabel pengguna
      await conn.execute(
        `INSERT INTO pengguna (id, nama, email, no_telepon, status_akun, kanal, kontak_terverifikasi)
         VALUES (?, ?, ?, '', 'AKTIF', 'EMAIL', 1)
         ON DUPLICATE KEY UPDATE status_akun = 'AKTIF', kontak_terverifikasi = 1, nama = VALUES(nama)`,
        [uid, nama, email]
      );

      // Pastikan ada di tabel admin
      await conn.execute(
        `INSERT INTO admin (id, level_akses)
         VALUES (?, 'SUPER')
         ON DUPLICATE KEY UPDATE level_akses = 'SUPER'`,
        [uid]
      );

      // Pastikan ada di tabel pembeli & keranjang
      await conn.execute(
        `INSERT IGNORE INTO pembeli (id, alamat) VALUES (?, '')`,
        [uid]
      );
      await conn.execute(
        `INSERT IGNORE INTO keranjang (id, id_pembeli, total_harga) VALUES (?, ?, 0)`,
        [uid, uid]
      );

      console.log(`✅ Berhasil! Akun Admin siap:`);
      console.log(`   Email   : ${email}`);
      console.log(`   Password: ${password}`);
      console.log(`   User ID : ${uid}`);
      process.exit(0);
    }

    console.log('⏳ Menjalankan migrasi skema database dari lapakwu.sql...');
    const sqlFile = join(__dirname, '..', 'lapakwu.sql');
    const sql = readFileSync(sqlFile, 'utf8');

    await conn.query(sql);
    console.log('✅ Skema tabel berhasil dibuat / diperbarui di MySQL!');
    console.log('💡 Langkah selanjutnya: jalankan command berikut untuk membuat akun Super Admin:');
    console.log('   node --env-file=.env.local scripts/setup-mysql.mjs --admin admin@lapakwu.id sandi1234 "Admin Lapak"');
  } catch (err) {
    console.error('❌ Terjadi kesalahan saat migrasi:', err.message || err);
  } finally {
    await conn.end();
  }
}

run();
