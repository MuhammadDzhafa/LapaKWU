import { randomBytes, createHash } from 'node:crypto';
import { svc, err, getRow, put, upd, Query } from '@/lib/server';
import { sendResetPasswordEmail } from '@/lib/kirim';

export const dynamic = 'force-dynamic';

const hashToken = (tok, uid) =>
  createHash('sha256').update(`${tok}:${uid}:${process.env.APPWRITE_API_KEY}`).digest('hex');

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') return err('Email wajib diisi.');

    const cleanEmail = email.trim().toLowerCase();
    const { db, users } = svc();

    // Cari user berdasarkan email
    const userList = await users.list([Query.equal('email', cleanEmail), Query.limit(1)]);
    if (!userList.users || userList.users.length === 0) {
      // Keamanan: jangan beri tahu apakah email terdaftar atau tidak (anti-enumeration)
      return Response.json({ ok: true });
    }

    const targetUser = userList.users[0];
    const uid = targetUser.$id;

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

    // Tentukan URL dasar aplikasi
    const host = req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

    // Link mengarah ke form reset password
    const resetUrl = `${baseUrl}/reset-sandi?token=${rawToken}&userId=${uid}`;

    // Kirim email via Nodemailer (Gmail SMTP)
    await sendResetPasswordEmail(cleanEmail, resetUrl);

    return Response.json({ ok: true });
  } catch (e) {
    console.error('[/api/lupa-sandi] Error:', e?.message || e);
    return err('Terjadi kesalahan server saat memproses permintaan.');
  }
}
