import { basename } from 'node:path';
import { unduhFile } from '@/lib/backblaze';
import { FORMAT_ID_BUKTI } from '@/lib/bukti-pembayaran';

export const dynamic = 'force-dynamic';

const tipe = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

export async function GET(req, { params }) {
  const { id } = await params;
  const name = basename(id || '');
  if (!name || name !== id || !/^[\w.-]+$/.test(name) || FORMAT_ID_BUKTI.test(name)) {
    return new Response('File tidak ditemukan.', { status: 404 });
  }
  try {
    const buffer = await unduhFile(name);
    const ext = name.split('.').at(-1)?.toLowerCase();
    return new Response(buffer, {
      headers: { 'Content-Type': tipe[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return new Response('File tidak ditemukan.', { status: 404 });
  }
}
