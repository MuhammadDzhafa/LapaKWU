import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as tunggu } from 'node:timers/promises';
import pg from 'pg';

async function siap(url) {
  const client = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 1000 });
  try {
    await client.connect();
    return true;
  } catch (error) {
    if (['ECONNREFUSED', '57P03'].includes(error.code)) return false;
    throw error;
  } finally {
    await client.end();
  }
}

if (process.env.LAPAKWU_POSTGRES_LOCAL === '1') {
  const url = new URL(process.env.POSTGRES_URL);
  if (url.hostname !== '127.0.0.1' || url.port !== '25432') {
    throw new Error('PostgreSQL portabel memerlukan POSTGRES_URL di 127.0.0.1:25432.');
  }
  url.pathname = '/postgres';
  if (!await siap(url)) {
    const folder = join(process.cwd(), 'data', 'postgres-dev');
    const postgres = join(folder, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin', 'postgres.exe');
    const log = openSync(join(folder, 'postgres.log'), 'a');
    const child = spawn(postgres, ['-D', join(folder, 'cluster'), '-h', url.hostname, '-p', url.port], {
      detached: true, windowsHide: true, stdio: ['ignore', log, log],
    });
    closeSync(log);
    let gagal;
    child.on('error', (error) => { gagal = error; });
    child.unref();

    let terhubung = false;
    for (let attempt = 0; attempt < 120 && !gagal; attempt++) {
      await tunggu(400);
      if (await siap(url)) { terhubung = true; break; }
    }
    if (!terhubung) throw gagal || new Error('PostgreSQL lokal gagal dimulai. Lihat data/postgres-dev/postgres.log.');
  }
}
