import { createHash } from 'node:crypto';
import { err, getRow, upd, del } from '@/lib/server';
import { ubahPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const hashToken = (tok, uid) =>
  createHash('sha256').update(`${tok}:${uid}:${process.env.JWT_SECRET || 'lapakwu'}`).digest('hex');

export async function POST(req) {
  try {
    const { token, userId, sandi } = await req.json();

    if (!token || !userId || !sandi) {
      return err('Data tidak lengkap.');
    }

    if (typeof sandi !== 'string' || sandi.length < 8) {
      return err('Kata sandi minimal 8 karakter.');
    }

    const { db } = { db: null };

    const record = await getRow(db, 'kode_verifikasi', userId).catch(() => null);
    if (!record || record.kanal !== 'RESET_PASSWORD') {
      return err('Permintaan reset tidak ditemukan atau sudah digunakan.');
    }

    if (new Date(record.kedaluwarsa) < new Date()) {
      await del(db, 'kode_verifikasi', userId).catch(() => {});
      return err('Link reset kata sandi sudah kedaluwarsa. Silakan minta link baru.');
    }

    if (record.percobaan >= 5) {
      return err('Terlalu banyak percobaan salah. Silakan minta link baru.', 429);
    }

    const incomingHash = hashToken(String(token).trim(), userId);
    if (incomingHash !== record.kode_hash) {
      await upd(db, 'kode_verifikasi', userId, { percobaan: record.percobaan + 1 }).catch(() => {});
      return err('Token reset tidak valid.');
    }

    // Update password user via auth.js (bcrypt hash)
    await ubahPassword(userId, sandi);

    // Hapus token setelah berhasil digunakan
    await del(db, 'kode_verifikasi', userId).catch(() => {});

    return Response.json({ ok: true, pesan: 'Kata sandi berhasil diperbarui.' });
  } catch (e) {
    console.error('[/api/reset-sandi] Error:', e?.message || e);
    return err(e?.message || 'Gagal mengatur kata sandi baru.');
  }
}
