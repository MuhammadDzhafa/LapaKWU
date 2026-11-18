import mysql from 'mysql2/promise';
import { getDatabase, koleksiInti } from '../src/lib/db.js';

let source;
let client;
try {
  const uri = process.env.MYSQL_SOURCE_URL || process.env.DATABASE_URL;
  if (!uri) throw new Error('Isi MYSQL_SOURCE_URL atau DATABASE_URL lama.');
  source = await mysql.createConnection({ uri, timezone: 'Z', decimalNumbers: true });
  const connection = await getDatabase();
  client = connection.client;
  for (const tabel of koleksiInti) {
    const collection = connection.db.collection(tabel);
    let terakhir;
    let total = 0;
    let inserted = 0;
    while (true) {
      const condition = terakhir === undefined ? '' : ' WHERE id > ?';
      const [rows] = await source.execute('SELECT * FROM `' + tabel + '`' + condition + ' ORDER BY id LIMIT 250', terakhir === undefined ? [] : [terakhir]);
      if (!rows.length) break;
      const result = await collection.bulkWrite(rows.map(({ id, ...data }) => {
        if (tabel === 'users') data.email = data.email.trim().toLowerCase();
        return { updateOne: { filter: { _id: id }, update: { $setOnInsert: data }, upsert: true } };
      }), { ordered: true });
      terakhir = rows.at(-1).id;
      total += rows.length;
      inserted += result.upsertedCount;
    }
    console.log(tabel + ' — ' + total + ' sumber, ' + inserted + ' ditambahkan, ' + (total - inserted) + ' ID sudah ada');
  }
  console.log('Migrasi selesai.');
} catch (e) {
  console.error('Migrasi berhenti. Periksa koneksi dan data sumber, lalu jalankan ulang.', e.code || '');
  process.exitCode = 1;
} finally {
  await source?.end();
  await client?.close();
}
