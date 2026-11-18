import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { cariSatu, denganTransaksi, getDatabase, koleksiInti, pastikanPembeli, tulis, ubahData } from '../src/lib/db.js';

let client;
try {
  const connection = await getDatabase();
  client = connection.client;
  const { db } = connection;
  const sudahAda = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  for (const nama of [...koleksiInti, 'unggahan_bukti', 'bukti_checkout', 'payhook_event']) {
    if (!sudahAda.has(nama)) {
      await db.createCollection(nama).catch((error) => { if (error.code !== 48) throw error; });
    }
  }
  await ubahData('payment_gateway', { _id: 'simulasi' }, { nama_layanan: 'Simulasi Gateway' }, { upsert: true, insertOnly: true });

  const [aksi, emailArg, namaArg] = process.argv.slice(2);
  if (aksi === '--admin') {
    const email = emailArg?.trim().toLowerCase();
    const password = process.env.MONGODB_ADMIN_PASSWORD;
    if (!email?.includes('@') || !password || password.length < 12) {
      throw new Error('Gunakan npm run admin -- <email> [nama] dengan MONGODB_ADMIN_PASSWORD minimal 12 karakter.');
    }
    const nama = namaArg || 'Super Administrator';
    const password_hash = await bcrypt.hash(password, 12);
    await denganTransaksi(async () => {
      const akun = await cariSatu('users', { email });
      const id = akun?.id || nanoid();
      if (await cariSatu('mitra', { _id: id })) throw new Error('Email ini sudah menjadi akun mitra. Gunakan akun lain untuk admin.');
      if (akun) await ubahData('users', { _id: id }, { nama, password_hash });
      else await tulis('users', id, { email, nama, password_hash });
      await pastikanPembeli({ $id: id, name: nama, email });
      await ubahData('pengguna', { _id: id }, { nama, email, status_akun: 'AKTIF', kontak_terverifikasi: true });
      await ubahData('admin', { _id: id }, { level_akses: 'SUPER' }, { upsert: true });
    });
    console.log('Akun admin siap.');
  } else if (aksi) {
    throw new Error('Aksi setup tidak dikenal.');
  } else {
    console.log('Koleksi dan indeks MongoDB siap.');
  }
} catch (e) {
  console.error('Setup MongoDB gagal:', e.message);
  process.exitCode = 1;
} finally {
  await client?.close();
}
