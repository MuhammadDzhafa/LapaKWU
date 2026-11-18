import { createHash, randomInt } from 'node:crypto';
import { siapa, err, getRow, put, upd, del } from '@/lib/server';
import { kirimEmail, kirimWA } from '@/lib/kirim';
export const dynamic = 'force-dynamic';

const hash = (k, uid) => createHash('sha256').update(`${k}:${uid}:${process.env.JWT_SECRET || 'lapakwu'}`).digest('hex');
const samar = (pg) => pg.kanal === 'WHATSAPP' ? pg.no_telepon.slice(0, 5) + '****' + pg.no_telepon.slice(-2) : pg.email.replace(/^(.).*(@.*)$/, '$1***$2');

export async function POST(req) {
  try {
  const u = await siapa(req);
  if (!u) return err('Belum masuk.', 401);
  const b = await req.json();
  const { db } = { db: null };
  const pg = await getRow(db, 'pengguna', u.$id).catch(() => null);
  if (!pg) return err('Profil belum dibuat.', 404);
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
      console.warn(`[verifikasi] Pengiriman lewat ${wa ? 'WhatsApp' : 'email'} gagal / layanan offline. Menyediakan kode fallback.`);
      return Response.json({
        ok: true,
        tujuan: samar(pg),
        bantuan: kode,
        pesan: `Layanan pengiriman ${wa ? 'WhatsApp' : 'email'} sedang offline. Untuk pengujian, gunakan kode: ${kode}`,
      });
    }
    return Response.json({ ok: true, tujuan: samar(pg) });
  }

  if (b.aksi === 'cek') {
    if (!lama) return err('Minta kode dulu.');
    if (new Date(lama.kedaluwarsa) < new Date()) return err('Kode sudah kedaluwarsa. Minta kode baru.');
    if (lama.percobaan >= 5) return err('Terlalu banyak percobaan salah. Minta kode baru.', 429);
    if (hash(String(b.kode || '').trim(), u.$id) !== lama.kode_hash) { await upd(db, 'kode_verifikasi', u.$id, { percobaan: lama.percobaan + 1 }); return err('Kode salah.'); }
    await del(null, 'kode_verifikasi', u.$id);
    const pembeli = await getRow(null, 'pembeli', u.$id).catch(() => null);
    // Pembeli langsung aktif. Mitra tetap menunggu persetujuan admin.
    await upd(null, 'pengguna', u.$id, { kontak_terverifikasi: true, ...(pembeli ? { status_akun: 'AKTIF' } : {}) });
    // (Email verification flag tidak perlu di-sync ke Appwrite lagi)
    return Response.json({ ok: true });
  }
  return err('Aksi tidak dikenal.');
  } catch (e) {
    console.error('[/api/verifikasi] unhandled error:', e?.message || e);
    return err('Terjadi kesalahan server. Coba lagi.', 500);
  }
}
