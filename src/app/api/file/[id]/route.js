import { basename } from 'node:path';
import { unduhFile } from '@/lib/backblaze';

export const dynamic = 'force-dynamic';

const tipe = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

export async function GET(req, { params }) {
  const { id } = await params;
  const name = basename(id || '');
  const ext = name.split('.').at(-1)?.toLowerCase();
  if (name !== id || !/^[\w-]{1,80}\.[a-z0-9]+$/i.test(name) || /^bukti-/i.test(name) || !Object.hasOwn(tipe, ext)) {
    return new Response('File tidak ditemukan.', { status: 404 });
  }
  try {
    const buffer = await unduhFile(name);
    return new Response(buffer, {
      headers: { 'Content-Type': tipe[ext], 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return new Response('File tidak ditemukan.', { status: 404 });
  }
}
