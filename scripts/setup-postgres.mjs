import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { getDatabase, denganTransaksi, cariSatu, tulis, ubahData, pastikanPembeli } from '../src/lib/db.js';

const pool = await getDatabase();
try {
  const schema = await readFile(join(process.cwd(), 'database', 'schema-postgres.sql'), 'utf8');
  await pool.query(schema);
  await ubahData('payment_gateway', { _id: 'simulasi' }, { nama_layanan: 'Simulasi Gateway' }, { upsert: true, insertOnly: true });

  const [aksi, emailArg, namaArg] = process.argv.slice(2);
  if (aksi === '--admin') {
    const email = emailArg?.trim().toLowerCase();
    const nama = namaArg?.trim() || 'Super Administrator';
    const password = process.env.INITIAL_ADMIN_PASSWORD;
    if (!email?.includes('@') || !password || password.length < 12) {
      throw new Error('Isi INITIAL_ADMIN_PASSWORD minimal 12 karakter lalu jalankan npm run admin -- <email> [nama].');
    }
    await denganTransaksi(async () => {
      const existing = await cariSatu('users', { email });
      const id = existing?.id || nanoid();
      if (await cariSatu('mitra', { _id: id })) throw new Error('Email ini sudah terdaftar sebagai mitra. Gunakan email admin yang lain.');
      const password_hash = await bcrypt.hash(password, 12);
      if (existing) await ubahData('users', { _id: id }, { nama, password_hash });
      else await tulis('users', id, { nama, email, password_hash });
      await pastikanPembeli({ $id: id, name: nama, email });
      await ubahData('pengguna', { _id: id }, { nama, email, status_akun: 'AKTIF', kontak_terverifikasi: true });
      await ubahData('admin', { _id: id }, { level_akses: 'SUPER' }, { upsert: true });
    });
    console.log('Akun admin PostgreSQL siap.');
  } else if (aksi) {
    throw new Error('Perintah tidak dikenal.');
  } else {
    console.log('Skema PostgreSQL dan data awal siap.');
  }
} catch (error) {
  console.error('Setup PostgreSQL gagal:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
