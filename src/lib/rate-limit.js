import { createHash } from 'node:crypto';
import { denganTransaksi, queryDatabase } from './db';

const digest = (value) => createHash('sha256').update(String(value)).digest('hex');

export async function batasiLaju(key, batas, jendelaDetik) {
  const id = digest(key);
  const allowed = await denganTransaksi(async () => {
    await queryDatabase('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
    const { rows: [row] } = await queryDatabase('SELECT hits, window_start <= NOW() - ($1 * INTERVAL \'1 second\') AS lewat FROM rate_limit WHERE id = $2 FOR UPDATE', [jendelaDetik, id]);
    if (!row) {
      await queryDatabase('INSERT INTO rate_limit (id, hits, window_start) VALUES ($1, 1, NOW())', [id]);
      return true;
    }
    if (row.lewat) {
      await queryDatabase('UPDATE rate_limit SET hits = 1, window_start = NOW() WHERE id = $1', [id]);
      return true;
    }
    if (row.hits >= batas) return false;
    await queryDatabase('UPDATE rate_limit SET hits = hits + 1 WHERE id = $1', [id]);
    return true;
  });
  const now = Date.now();
  if (now - (globalThis.__lapakwuRateLimitCleanup || 0) > 15 * 60 * 1000) {
    globalThis.__lapakwuRateLimitCleanup = now;
    await queryDatabase("DELETE FROM rate_limit WHERE window_start < NOW() - INTERVAL '2 days'").catch(() => {});
  }
  return allowed;
}

export function alamatKlien(req) {
  return req.headers.get('cf-connecting-ip')?.trim()
    || req.headers.get('x-real-ip')?.trim()
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}
