import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
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
    const pgCtl = join(folder, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin', 'pg_ctl.exe');
    const cluster = join(folder, 'cluster');
    if (!existsSync(pgCtl) || !existsSync(join(cluster, 'PG_VERSION'))) {
      throw new Error('PostgreSQL belum berjalan. Arahkan LAPAKWU_POSTGRES_DIR ke folder PostgreSQL portabel yang memuat node_modules dan cluster.');
    }
    const logPath = join(folder, 'postgres.log');
    // Backend PostgreSQL di Windows mewarisi konsol induknya. Berikan satu
    // konsol tersembunyi agar setiap koneksi tidak membuat tab terminal baru.
    const mulai = `
      $ErrorActionPreference = 'Stop'
      $argumen = 'start -D "' + $env:LAPAKWU_PG_CLUSTER + '" -l "' + $env:LAPAKWU_PG_LOG + '" -o "-h 127.0.0.1 -p 25432"'
      Start-Process -FilePath $env:LAPAKWU_PG_CTL -ArgumentList $argumen -WindowStyle Hidden
    `;
    await new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', mulai], {
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'inherit'],
        env: { ...process.env, LAPAKWU_PG_CTL: pgCtl, LAPAKWU_PG_CLUSTER: cluster, LAPAKWU_PG_LOG: logPath },
      });
      child.once('error', reject);
      child.once('exit', (code) => code === 0 ? resolve() : reject(new Error('Peluncur PostgreSQL gagal dimulai.')));
    });

    let terhubung = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      await tunggu(400);
      if (await siap(url)) { terhubung = true; break; }
    }
    if (!terhubung) throw new Error('PostgreSQL lokal gagal dimulai. Lihat ' + logPath);
  }
}
