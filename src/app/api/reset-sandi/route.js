import { createHash } from 'node:crypto';
import { err, originValid } from '@/lib/server';
import { ubahPassword, getJwtSecret } from '@/lib/auth';
import { cariSatu, hapusData, ubahData, denganTransaksi, queryDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

const hashToken = (tok, uid) =>
  createHash('sha256').update(`${tok}:${uid}:${new TextDecoder().decode(getJwtSecret())}`).digest('hex');

export async function POST(req) {
  try {
    if (!originValid(req)) return err('Sumber permintaan tidak diizinkan.', 403);
    const { token, userId, sandi } = await req.json();

    if (!token || !userId || !sandi) {
      return err('Data tidak lengkap.');
    }

    if (typeof sandi !== 'string' || sandi.length < 8) {
      return err('Kata sandi minimal 8 karakter.');
    }

    const record = await cariSatu('kode_verifikasi', { _id: userId });
    if (!record || record.kanal !== 'RESET_PASSWORD') {
      return err('Permintaan reset tidak ditemukan atau sudah digunakan.');
    }

    if (new Date(record.kedaluwarsa) < new Date()) {
      await hapusData('kode_verifikasi', { _id: userId, kode_hash: record.kode_hash }).catch(() => {});
      return err('Link reset kata sandi sudah kedaluwarsa. Silakan minta link baru.');
    }

    if (record.percobaan >= 5) {
      return err('Terlalu banyak percobaan salah. Silakan minta link baru.', 429);
    }

    const incomingHash = hashToken(String(token).trim(), userId);
    if (incomingHash !== record.kode_hash) {
      await ubahData('kode_verifikasi', { _id: userId, kode_hash: record.kode_hash, percobaan: { $lt: 5 } }, {}, { inc: { percobaan: 1 } });
      return err('Token reset tidak valid.');
    }

    const dipakai = await denganTransaksi(async () => {
      await queryDatabase('SELECT id FROM kode_verifikasi WHERE id = $1 FOR UPDATE', [userId]);
      const terbaru = await cariSatu('kode_verifikasi', { _id: userId });
      if (!terbaru || terbaru.kanal !== 'RESET_PASSWORD' || terbaru.kode_hash !== record.kode_hash ||
        terbaru.percobaan >= 5 || new Date(terbaru.kedaluwarsa) <= new Date()) return false;
      const consume = await hapusData('kode_verifikasi', { _id: userId, kode_hash: record.kode_hash, percobaan: { $lt: 5 }, kedaluwarsa: { $gt: new Date() } });
      if (!consume.deletedCount) return false;
      await ubahPassword(userId, sandi);
      return true;
    });
    if (!dipakai) return err('Token reset sudah tidak berlaku atau sudah digunakan.', 409);

    return Response.json({ ok: true, pesan: 'Kata sandi berhasil diperbarui.' });
  } catch (e) {
    console.error('[/api/reset-sandi] Error:', e?.message || e);
    return err(e?.message || 'Gagal mengatur kata sandi baru.');
  }
}
