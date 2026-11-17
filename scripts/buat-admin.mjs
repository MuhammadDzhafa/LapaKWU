import { Client, TablesDB, Users, ID, Permission, Role, Query } from 'node-appwrite';

const origPrepare = Client.prototype.prepareRequest;
if (origPrepare) {
  Client.prototype.prepareRequest = function (...args) {
    const res = origPrepare.apply(this, args);
    delete res.options.dispatcher;
    delete res.options.agent;
    return res;
  };
}

const c = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const db = new TablesDB(c);
const users = new Users(c);
const DB = 'lapakwu';

const email = 'admin@gmail.com';
const password = '12345678';
const nama = 'Admin';

async function main() {
  console.log('Mencari akun dengan email:', email);
  const list = await users.list([Query.equal('email', [email])]);
  let u;
  if (list.total > 0) {
    u = list.users[0];
    console.log('Akun sudah ada di Appwrite Auth (ID:', u.$id, '), memperbarui password dan status...');
    await users.updatePassword({ userId: u.$id, password });
    await users.updateEmailVerification({ userId: u.$id, emailVerification: true });
    await users.updateStatus({ userId: u.$id, status: true });
  } else {
    console.log('Membuat akun baru di Appwrite Auth...');
    u = await users.create({
      userId: ID.unique(),
      email,
      password,
      name: nama,
    });
    await users.updateEmailVerification({ userId: u.$id, emailVerification: true });
  }

  const uid = u.$id;
  const labels = [...new Set([...(u.labels || []), 'admin'])];
  await users.updateLabels({ userId: uid, labels });

  const own = [Permission.read(Role.user(uid)), Permission.update(Role.user(uid)), Permission.delete(Role.user(uid))];

  // Pastikan tabel pengguna terisi
  try {
    await db.getRow({ databaseId: DB, tableId: 'pengguna', rowId: uid });
    console.log('Memperbarui data di tabel pengguna...');
    await db.updateRow({
      databaseId: DB,
      tableId: 'pengguna',
      rowId: uid,
      data: {
        nama: u.name || nama,
        email: u.email,
        status_akun: 'AKTIF',
        kontak_terverifikasi: true,
      },
    });
  } catch (err) {
    console.log('Menambahkan row baru di tabel pengguna...');
    await db.createRow({
      databaseId: DB,
      tableId: 'pengguna',
      rowId: uid,
      data: {
        nama: u.name || nama,
        email: u.email,
        no_telepon: '',
        status_akun: 'AKTIF',
        kanal: 'EMAIL',
        kontak_terverifikasi: true,
      },
      permissions: own,
    });
  }

  // Pastikan tabel admin terisi
  try {
    await db.getRow({ databaseId: DB, tableId: 'admin', rowId: uid });
    console.log('Row admin sudah ada.');
  } catch (err) {
    console.log('Menambahkan row baru di tabel admin...');
    await db.createRow({
      databaseId: DB,
      tableId: 'admin',
      rowId: uid,
      data: { level_akses: 'SUPER' },
      permissions: own,
    });
  }

  console.log(`\n✔ Sukses! Akun admin berhasil dibuat / diperbarui:`);
  console.log(`- Email: ${email}`);
  console.log(`- Password: ${password}`);
  console.log(`- User ID: ${uid}`);
  console.log(`- Labels: ${labels.join(', ')}`);
}

main().catch((e) => {
  console.error('Error saat membuat admin:', e);
  process.exit(1);
});
