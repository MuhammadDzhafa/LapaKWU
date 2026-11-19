import { getDatabase } from '../src/lib/db.js';

const pool = await getDatabase();
try {
  const result = await pool.query(`
    SELECT current_database() AS database,
           current_user AS user,
           (SELECT COUNT(*)::int FROM information_schema.tables
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tables
  `);
  console.log('Koneksi PostgreSQL berhasil.');
  console.log(`Database: ${result.rows[0].database}; tabel aplikasi: ${result.rows[0].tables}.`);
} catch (error) {
  console.error('Koneksi PostgreSQL gagal:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
