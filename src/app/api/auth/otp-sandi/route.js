// POST /api/auth/otp-sandi — Kirim dan verifikasi OTP ganti kata sandi
import { createHash, randomInt } from 'node:crypto';
import { getUserIdDariCookie, cariAkunById, ubahPassword } from '@/lib/auth';
import { cariSatu, ubahData, hapusData, denganTransaksi } from '@/lib/db';
import { sendOtpPasswordEmail } from '@/lib/kirim';
export const dynamic = 'force-dynamic';

const hashOtp = (kode, uid) =>
  createHash('sha256').update(`${kode}:${uid}:${process.env.JWT_SECRET || 'lapakwu'}`).digest('hex');

export async function POST(req) {
  try {
    const uid = await getUserIdDariCookie();
    if (!uid) return Response.json({ error: 'Belum masuk.' }, { status: 401 });

    const user = await cariAkunById(uid);
    if (!user) return Response.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });

    const b = await req.json();

    // ── 1. Minta Kode OTP ke Email ─────────────────────────────
    if (b.aksi === 'minta_otp') {
      const existing = await cariSatu('kode_verifikasi', { _id: uid });

      // Cegah spam: jika baru kirim kurang dari 60 detik lalu
      if (existing) {
        const selisihDetik = (Date.now() - new Date(existing.updated_at).getTime()) / 1000;
        if (selisihDetik < 60) {
          return Response.json(
            { error: `Tunggu ${Math.ceil(60 - selisihDetik)} detik sebelum meminta kode baru.` },
            { status: 429 }
          );
        }
      }

      const otp = String(randomInt(100000, 1000000));
      const hashed = hashOtp(otp, uid);
      const now = new Date();
      const kedaluwarsa = new Date(now.getTime() + 10 * 60 * 1000); // 10 menit

      await ubahData('kode_verifikasi', { _id: uid }, {
        kode_hash: hashed, kanal: 'RESET_PASSWORD', tujuan: user.email, kedaluwarsa, percobaan: 0,
      }, { upsert: true });

      // Kirim email OTP
      const ok = await sendOtpPasswordEmail(user.email, otp);

      return Response.json({
        ok: true,
        email: user.email,
        pesan: `Kode OTP telah dikirim ke email ${user.email}`,
        // Jika SMTP lokal/offline, sediakan bantuan kode di response untuk testing
        ...(ok ? {} : { bantuanOtp: otp }),
      });
    }

    // ── 2. Verifikasi OTP & Pasang Sandi Baru ───────────────────
    if (b.aksi === 'verifikasi_otp') {
      const { kode, sandiBaru } = b;
      if (!kode || !sandiBaru) {
        return Response.json({ error: 'Kode OTP dan kata sandi baru wajib diisi.' }, { status: 400 });
      }

      if (typeof sandiBaru !== 'string' || sandiBaru.length < 8) {
        return Response.json({ error: 'Kata sandi baru minimal 8 karakter.' }, { status: 400 });
      }

      const record = await cariSatu('kode_verifikasi', { _id: uid });
      if (!record || record.kanal !== 'RESET_PASSWORD') {
        return Response.json({ error: 'Permintaan OTP tidak ditemukan. Silakan minta kode baru.' }, { status: 404 });
      }

      if (new Date(record.kedaluwarsa) < new Date()) {
        await hapusData('kode_verifikasi', { _id: uid });
        return Response.json({ error: 'Kode OTP sudah kedaluwarsa. Silakan minta kode baru.' }, { status: 400 });
      }

      if (record.percobaan >= 5) {
        return Response.json({ error: 'Terlalu banyak percobaan salah. Minta kode baru.' }, { status: 429 });
      }

      const incomingHash = hashOtp(String(kode).trim(), uid);
      if (incomingHash !== record.kode_hash) {
        await ubahData('kode_verifikasi', { _id: uid, kode_hash: record.kode_hash }, {}, { inc: { percobaan: 1 } });
        return Response.json({ error: 'Kode OTP salah. Periksa kembali emailmu.' }, { status: 400 });
      }

      // Berhasil: Ubah password dan bersihkan OTP
      const dipakai = await denganTransaksi(async () => {
        const result = await hapusData('kode_verifikasi', { _id: uid, kode_hash: record.kode_hash, percobaan: { $lt: 5 }, kedaluwarsa: { $gt: new Date() } });
        if (!result.deletedCount) return false;
        await ubahPassword(uid, sandiBaru);
        return true;
      });
      if (!dipakai) return Response.json({ error: 'Kode OTP sudah tidak berlaku.' }, { status: 400 });

      return Response.json({ ok: true, pesan: 'Kata sandi berhasil diperbarui.' });
    }

    return Response.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
  } catch (e) {
    console.error('[/api/auth/otp-sandi]', e?.message);
    return Response.json({ error: 'Gagal memproses verifikasi kata sandi.' }, { status: 500 });
  }
}
