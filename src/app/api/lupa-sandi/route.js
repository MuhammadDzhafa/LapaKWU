import { randomBytes, createHash } from 'node:crypto';
import { err, getRow, put, upd, originValid } from '@/lib/server';
import { sendResetPasswordEmail } from '@/lib/kirim';
import { alamatKlien, batasiLaju } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const hashToken = (tok, uid) =>
  createHash('sha256').update(`${tok}:${uid}:${process.env.JWT_SECRET || 'lapakwu'}`).digest('hex');

export async function POST(req) {
  try {
    if (!originValid(req)) return err('Sumber permintaan tidak diizinkan.', 403);
    const { email } = await req.json();
    if (!email || typeof email !== 'string') return err('Email wajib diisi.');

    const cleanEmail = email.trim().toLowerCase();
    const allowed = await Promise.all([
      batasiLaju(`reset-ip:${alamatKlien(req)}`, 10, 3600),
      batasiLaju(`reset-email:${cleanEmail}`, 3, 3600),
    ]);
    if (allowed.includes(false)) return Response.json({ ok: true });
    const { db } = { db: null };

    // Cari user berdasarkan email
    const { cariAkunByEmail } = await import('@/lib/auth');
    const targetUser = await cariAkunByEmail(cleanEmail);
    if (!targetUser) {
      // Keamanan: jangan beri tahu apakah email terdaftar atau tidak (anti-enumeration)
      return Response.json({ ok: true });
    }

    const uid = targetUser.id;

    // Generate token reset yang aman
    const rawToken = randomBytes(24).toString('hex');
    const hashed = hashToken(rawToken, uid);

    const recordData = {
      kode_hash: hashed,
      kanal: 'RESET_PASSWORD',
      tujuan: cleanEmail,
      kedaluwarsa: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 jam
      percobaan: 0,
    };

    const existing = await getRow(db, 'kode_verifikasi', uid).catch(() => null);
    if (existing) {
      await upd(db, 'kode_verifikasi', uid, recordData);
    } else {
      await put(db, 'kode_verifikasi', uid, recordData, []);
    }

    const requestUrl = new URL(req.url);
    const configured = new URL(process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin);
    const loopback = ['localhost', '127.0.0.1', '[::1]'];
    const lokal = loopback.includes(configured.hostname) && loopback.includes(requestUrl.hostname);
    const resetUrl = new URL('/reset-sandi', lokal ? requestUrl.origin : configured.origin);
    resetUrl.search = new URLSearchParams({ token: rawToken, userId: uid });

    // Kirim email via Nodemailer (Gmail SMTP)
    await sendResetPasswordEmail(cleanEmail, resetUrl.toString());

    return Response.json({ ok: true });
  } catch (e) {
    console.error('[/api/lupa-sandi] Error:', e?.message || e);
    return err('Terjadi kesalahan server saat memproses permintaan.');
  }
}
