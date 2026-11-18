import { spawn } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as jeda } from 'node:timers/promises';
import { MongoClient } from 'mongodb';

const host = '127.0.0.1:27029';
const set = 'lapakwuDev';
const uri = 'mongodb://' + host + '/?directConnection=true';
const config = process.env.MONGODB_URI;
if (process.argv.includes('--if-configured') && !config?.startsWith('mongodb://' + host + '/')) process.exit(0);

async function perintah(command) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 1000, connectTimeoutMS: 1000 });
  try { return await client.db('admin').command(command); }
  finally { await client.close(); }
}

try {
  let hello = await perintah({ hello: 1 }).catch((error) => {
    if (error.name !== 'MongoServerSelectionError') throw error;
    return null;
  });
  if (!hello) {
    const folder = join(process.cwd(), 'data', 'mongodb-dev');
    const binary = process.env.MONGOD_PATH || join(folder, 'mongod.exe');
    await access(binary).catch(() => { throw new Error('Pasang MongoDB Community Server lalu isi MONGOD_PATH dengan path executable mongod.'); });
    const dbpath = join(folder, 'db');
    await mkdir(dbpath, { recursive: true });
    const child = spawn(binary, [
      '--dbpath', dbpath, '--logpath', join(folder, 'mongod.log'), '--logappend',
      '--bind_ip', '127.0.0.1', '--port', '27029', '--replSet', set,
    ], { detached: true, stdio: 'ignore', windowsHide: true });
    let gagal;
    child.once('error', (error) => { gagal = error; });
    child.unref();
    for (let i = 0; i < 15 && !hello && !gagal && child.exitCode === null; i++) {
      await jeda(300);
      hello = await perintah({ hello: 1 }).catch(() => null);
    }
    if (!hello) throw gagal || new Error('MongoDB lokal gagal mulai. Lihat data/mongodb-dev/mongod.log.');
  }
  if (hello.isreplicaset && !hello.setName) {
    await perintah({ replSetInitiate: { _id: set, members: [{ _id: 0, host }] } }).catch((error) => {
      if (error.codeName !== 'AlreadyInitialized') throw error;
    });
  }
  for (let i = 0; i < 20; i++) {
    hello = await perintah({ hello: 1 });
    if (hello.setName === set && hello.isWritablePrimary) {
      console.log('MongoDB lokal siap di ' + host + '.');
      break;
    }
    if (hello.setName && hello.setName !== set) throw new Error('Port 27029 dipakai replica set lain.');
    if (i === 19) throw new Error('Replica set lokal belum bisa menerima penulisan.');
    await jeda(400);
  }
} catch (e) {
  console.error('MongoDB lokal:', e.message);
  process.exitCode = 1;
}
