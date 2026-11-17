// Membuat database, 13 tabel (sesuai ERD), index, bucket gambar, dan data awal.
// Jalankan: npm run setup   |   Jadikan admin: npm run admin -- <USER_ID>
import { Client, TablesDB, Storage, Users, Permission, Role } from 'node-appwrite';

const origPrepare = Client.prototype.prepareRequest;
if (origPrepare) {
  Client.prototype.prepareRequest = function (...args) {
    const res = origPrepare.apply(this, args);
    if (res?.options) {
      delete res.options.dispatcher;
      delete res.options.agent;
    }
    return res;
  };
}

const c = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);
const db = new TablesDB(c), storage = new Storage(c), users = new Users(c);
const DB = 'lapakwu', BUCKET = 'gambar-produk';
const ok = (p) => p.catch((e) => { if (e.code !== 409) throw e; }); // 409 = sudah ada
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

if (process.argv[2] === '--admin') {
  const uid = process.argv[3];
  if (!uid) throw new Error('Pakai: npm run admin -- <USER_ID>');
  const u = await users.get({ userId: uid });
  await users.updateLabels({ userId: uid, labels: [...new Set([...u.labels, 'admin'])] });
  const own = [Permission.read(Role.user(uid))];
  await ok(db.createRow({ databaseId: DB, tableId: 'pengguna', rowId: uid, data: { nama: u.name, email: u.email, no_telepon: '', status_akun: 'AKTIF', kanal: 'EMAIL', kontak_terverifikasi: true }, permissions: own }));
  await db.updateRow({ databaseId: DB, tableId: 'pengguna', rowId: uid, data: { status_akun: 'AKTIF', kontak_terverifikasi: true } });
  await ok(db.createRow({ databaseId: DB, tableId: 'admin', rowId: uid, data: { level_akses: 'SUPER' }, permissions: own }));
  console.log(`✔ ${u.email} sekarang admin`);
  process.exit(0);
}

if (process.argv[2] === '--pulihkan') {
  // Bikin ulang profil yang hilang (pendaftaran terputus): npm run pulihkan -- <USER_ID> [pembeli|mitra]
  const uid = process.argv[3], peran = process.argv[4] || 'pembeli';
  if (!uid) throw new Error('Pakai: npm run pulihkan -- <USER_ID> [pembeli|mitra]');
  const u = await users.get({ userId: uid });
  const own = [Permission.read(Role.user(uid))];
  const milik = [Permission.read(Role.user(uid)), Permission.update(Role.user(uid)), Permission.delete(Role.user(uid))];
  const baru = (t, data, permissions) => ok(db.createRow({ databaseId: DB, tableId: t, rowId: uid, data, permissions }));
  const fix = (t) => db.updateRow({ databaseId: DB, tableId: t, rowId: uid, data: {}, permissions: own }).catch(() => {});
  await baru('pengguna', { nama: u.name || u.email.split('@')[0], email: u.email, no_telepon: '', status_akun: 'MENUNGGU_VERIFIKASI', kanal: 'EMAIL', kontak_terverifikasi: false }, own);
  await fix('pengguna');
  if (peran === 'mitra') { await baru('mitra', { nama_usaha: u.name || 'Lapak baru', alamat_usaha: '' }, own); await fix('mitra'); }
  else {
    await baru('pembeli', { alamat: '' }, own); await fix('pembeli');
    await baru('keranjang', { id_pembeli: uid, total_harga: 0 }, milik);
  }
  console.log(`✔ profil ${peran} untuk ${u.email} sudah dipulihkan. Muat ulang halaman.`);
  process.exit(0);
}

// [tipe, kolom, ukuran|elemen enum, wajib, nilai bawaan]  s=string i=int f=float b=bool d=datetime e=enum
const T = {
  pengguna: [['s','nama',255,1],['s','email',255,1],['s','no_telepon',20],['e','status_akun',['MENUNGGU_VERIFIKASI','AKTIF','DITOLAK','DIBLOKIR'],1],['e','kanal',['EMAIL','WHATSAPP'],1],['b','kontak_terverifikasi',0,1]],
  kode_verifikasi: [['s','kode_hash',64,1],['s','kanal',20,1],['s','tujuan',255,1],['d','kedaluwarsa',0,1],['i','percobaan',0,1]],
  notifikasi: [['s','id_pengguna',36,1],['s','judul',255,1],['s','pesan',500,1],['d','waktu_kirim',0,1],['b','sudah_dibaca',0,1]],
  pembeli: [['s','alamat',255]],
  mitra: [['s','id_admin_verifikator',36],['s','nama_usaha',255,1],['s','alamat_usaha',255,1],['s','catatan_verifikasi',500],['s','rekening',100],['s','id_qris',36]],
  admin: [['s','level_akses',50,1]],
  pesanan: [['s','id_pembeli',36,1],['s','id_mitra',36,1],['d','tanggal_pesanan',0,1],['e','jenis_pemesanan',['ONLINE','OFFLINE'],1],['f','total_harga',0,1],['e','status_pesanan',['MENUNGGU_KONFIRMASI','DIPROSES','DIKIRIM','SIAP_DIAMBIL','SELESAI','DIBATALKAN'],1],['s','alamat_pengiriman',255],['s','lokasi_pengambilan',255],['d','waktu_pengambilan'],['s','alasan_pembatalan',500]],
  rekap_penjualan: [['s','id_mitra',36,1],['s','periode',10,1],['f','total_penjualan',0,1],['i','jumlah_transaksi',0,1],['f','total_komisi',0,1],['f','total_digital',0,1],['e','status_pencairan',['BELUM','DIAJUKAN','DICAIRKAN'],1],['d','tanggal_cair'],['s','catatan_cair',255],['f','total_offline',0,0,0],['i','jumlah_offline',0,0,0]],
  penjualan_offline: [['s','id_mitra',36,1],['s','id_produk',36,1],['s','nama_produk',255,1],['i','jumlah',0,1],['f','harga_satuan',0,1],['f','subtotal',0,1],['d','waktu',0,1],['s','periode',10,1]],
  pembayaran: [['s','id_pesanan',36,1],['s','id_gateway',36],['s','metode',50,1],['f','jumlah',0,1],['e','status_pembayaran',['MENUNGGU','BERHASIL','GAGAL','REFUND_DIAJUKAN','DIKEMBALIKAN'],1],['d','waktu_bayar'],['s','id_bukti',36]],
  payment_gateway: [['s','nama_layanan',100,1]],
  detail_pesanan: [['s','id_pesanan',36,1],['s','id_produk',36,1],['i','jumlah',0,1],['f','harga_satuan',0,1],['f','subtotal',0,1]],
  produk: [['s','id_mitra',36,1],['s','nama',255,1],['f','harga',0,1],['s','kategori',100,1],['s','deskripsi',2000],['i','stok',0,1],['s','id_gambar',36]],
  keranjang: [['s','id_pembeli',36,1],['f','total_harga',0,1]],
  item_keranjang: [['s','id_keranjang',36,1],['s','id_produk',36,1],['i','jumlah',0,1],['f','subtotal',0,1]],
};
const INDEX = [['produk','id_mitra'],['pesanan','id_pembeli'],['pesanan','id_mitra'],['item_keranjang','id_keranjang'],['detail_pesanan','id_pesanan'],['pembayaran','id_pesanan'],['notifikasi','id_pengguna'],['rekap_penjualan','id_mitra'],['pembayaran','status_pembayaran'],['rekap_penjualan','status_pencairan'],['penjualan_offline','id_mitra'],['penjualan_offline','id_produk'],['penjualan_offline','periode']];

const adm = Role.label('admin');
const dasar = [Permission.read(adm), Permission.update(adm), Permission.delete(adm)];
const tambahan = {
  kode_verifikasi: [],
  produk: [Permission.read(Role.any()), Permission.create(Role.label('mitra'))],
  mitra: [Permission.read(Role.any())],
  payment_gateway: [Permission.read(Role.users())],
  item_keranjang: [Permission.create(Role.users())],
};

await ok(db.create({ databaseId: DB, name: 'LapaKWU' }));
for (const [t, cols] of Object.entries(T)) {
  console.log('tabel', t);
  await ok(db.createTable({ databaseId: DB, tableId: t, name: t, permissions: t === 'kode_verifikasi' ? [] : [...dasar, ...(tambahan[t] || [])], rowSecurity: true }));
  for (const [ty, key, a, req, def] of cols) {
    const o = { databaseId: DB, tableId: t, key, required: !!req, ...(def !== undefined ? { xdefault: def } : {}) };
    if (ty === 's') await ok(db.createStringColumn({ ...o, size: a }));
    if (ty === 'i') await ok(db.createIntegerColumn(o));
    if (ty === 'f') await ok(db.createFloatColumn(o));
    if (ty === 'b') await ok(db.createBooleanColumn(o));
    if (ty === 'd') await ok(db.createDatetimeColumn(o));
    if (ty === 'e') await ok(db.createEnumColumn({ ...o, elements: a }));
  }
}
console.log('menunggu kolom siap...'); await wait(10000);
for (const [t, k] of INDEX) {
  for (let i = 0; i < 12; i++) {
    try { await ok(db.createIndex({ databaseId: DB, tableId: t, key: `idx_${k}`, type: 'key', columns: [k] })); break; }
    catch (e) { if (i === 11) throw e; await wait(3000); }
  }
}
await ok(storage.createBucket({
  bucketId: BUCKET, name: 'Gambar produk',
  permissions: [Permission.read(Role.any()), Permission.create(Role.label('mitra')), Permission.update(Role.label('mitra')), Permission.delete(Role.label('mitra'))],
  fileSecurity: false, maximumFileSize: 5_000_000, allowedFileExtensions: ['jpg', 'jpeg', 'png', 'webp'],
}));
for (let i = 0; i < 12; i++) {
  try { await ok(db.createRow({ databaseId: DB, tableId: 'payment_gateway', rowId: 'simulasi', data: { nama_layanan: 'Simulasi Gateway' }, permissions: [] })); break; }
  catch (e) { if (i === 11) throw e; await wait(3000); }
}
console.log('✔ Selesai. Lanjut: daftar akun di web, lalu npm run admin -- <USER_ID>');
