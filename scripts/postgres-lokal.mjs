import { spawn } from 'node:child_process';
import { existsSync, openSync, closeSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
    const folder = resolve(process.env.LAPAKWU_POSTGRES_DIR?.trim() || join('data', 'postgres-dev'));
    const postgres = join(folder, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin', 'postgres.exe');
    const cluster = join(folder, 'cluster');
    if (!existsSync(postgres) || !existsSync(join(cluster, 'PG_VERSION'))) {
      throw new Error('PostgreSQL belum berjalan. Arahkan LAPAKWU_POSTGRES_DIR ke folder PostgreSQL portabel yang memuat node_modules dan cluster.');
    }
    const logPath = join(folder, 'postgres.log');
    const log = openSync(logPath, 'a');
    const child = spawn(postgres, ['-D', cluster, '-h', url.hostname, '-p', url.port], {
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
    if (!terhubung) throw gagal || new Error('PostgreSQL lokal gagal dimulai. Lihat ' + logPath);
  }
}
