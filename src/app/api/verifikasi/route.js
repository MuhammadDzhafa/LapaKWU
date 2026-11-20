import { createHash, randomInt } from 'node:crypto';
import { siapa, err, getRow, put, upd } from '@/lib/server';
import { cariSatu, hapusData, ubahData, denganTransaksi } from '@/lib/db';
import { getJwtSecret } from '@/lib/auth';
import { kirimEmail, kirimWA } from '@/lib/kirim';
export const dynamic = 'force-dynamic';

const hash = (k, uid) => createHash('sha256').update(`${k}:${uid}:${new TextDecoder().decode(getJwtSecret())}`).digest('hex');
const samar = (pg) => pg.kanal === 'WHATSAPP' ? pg.no_telepon.slice(0, 5) + '****' + pg.no_telepon.slice(-2) : pg.email.replace(/^(.).*(@.*)$/, '$1***$2');

export async function POST(req) {
  try {
  const u = await siapa(req);
  if (!u) return err('Belum masuk.', 401);
  const b = await req.json();
  const { db } = { db: null };
  const pg = await getRow(db, 'pengguna', u.$id).catch(() => null);
  if (!pg) return err('Profil belum dibuat.', 404);
  if (pg.status_akun === 'DIBLOKIR') return err('Akun diblokir.', 403);
  if (pg.kontak_terverifikasi) return Response.json({ ok: true, sudah: true });
  const lama = await getRow(db, 'kode_verifikasi', u.$id).catch(() => null);

  if (b.aksi === 'kirim') {
    if (lama && Date.now() - new Date(lama.$updatedAt) < 60000) return err('Tunggu 1 menit sebelum meminta kode baru.', 429);
    const kode = String(randomInt(100000, 1000000));
    const wa = pg.kanal === 'WHATSAPP';
    const data = { kode_hash: hash(kode, u.$id), kanal: pg.kanal, tujuan: wa ? pg.no_telepon : pg.email, kedaluwarsa: new Date(Date.now() + 10 * 60000).toISOString(), percobaan: 0 };
    if (lama) await upd(db, 'kode_verifikasi', u.$id, data); else await put(db, 'kode_verifikasi', u.$id, data, []);
    const teks = `Kode verifikasi: ${kode}\nBerlaku 10 menit. Jangan bagikan kode ini ke siapa pun.`;
    const ok = wa ? await kirimWA(pg.no_telepon, `*LapaKWU*\n${teks}`) : await kirimEmail(pg.email, 'Kode verifikasi LapaKWU', teks);
    if (!ok) {
      console.warn(`[verifikasi] Pengiriman lewat ${wa ? 'WhatsApp' : 'email'} gagal / layanan offline.`);
      return err(`Kode tidak dapat dikirim melalui ${wa ? 'WhatsApp' : 'email'}. Coba lagi setelah satu menit.`, 503);
    }
    return Response.json({ ok: true, tujuan: samar(pg) });
  }

  if (b.aksi === 'cek') {
    if (!lama) return err('Minta kode dulu.');
    if (new Date(lama.kedaluwarsa) < new Date()) return err('Kode sudah kedaluwarsa. Minta kode baru.');
    if (lama.percobaan >= 5) return err('Terlalu banyak percobaan salah. Minta kode baru.', 429);
    if (hash(String(b.kode || '').trim(), u.$id) !== lama.kode_hash) {
      await ubahData('kode_verifikasi', { _id: u.$id, kode_hash: lama.kode_hash, percobaan: { $lt: 5 } }, {}, { inc: { percobaan: 1 } });
      return err('Kode salah.');
    }
    const dipakai = await denganTransaksi(async () => {
      const kontak = await getRow(db, 'pengguna', u.$id);
      const tujuan = kontak.kanal === 'WHATSAPP' ? kontak.no_telepon : kontak.email;
      if (kontak.status_akun === 'DIBLOKIR' || kontak.kanal !== lama.kanal || tujuan !== lama.tujuan) return false;
      const consume = await hapusData('kode_verifikasi', { _id: u.$id, kode_hash: lama.kode_hash, percobaan: { $lt: 5 }, kedaluwarsa: { $gt: new Date() } });
      if (!consume.deletedCount) return false;
      const mitra = await cariSatu('mitra', { _id: u.$id });
      await upd(null, 'pengguna', u.$id, {
        kontak_terverifikasi: true,
        ...(!mitra && kontak.status_akun === 'MENUNGGU_VERIFIKASI' ? { status_akun: 'AKTIF' } : {}),
      });
      return true;
    });
    if (!dipakai) return err('Kode sudah tidak berlaku. Minta kode baru.', 409);
    // (Email verification flag tidak perlu di-sync ke Appwrite lagi)
    return Response.json({ ok: true });
  }
  return err('Aksi tidak dikenal.');
  } catch (e) {
    console.error('[/api/verifikasi] unhandled error:', e?.message || e);
    return err('Terjadi kesalahan server. Coba lagi.', 500);
  }
}
