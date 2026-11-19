import { cariBanyak, cariSatu, denganTransaksi, tulis, ubahData } from '@/lib/db';
import { err, notif, siapa } from '@/lib/server';
import { MINIMAL_PENARIKAN, saldoDompet } from '@/lib/dompet';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const u = await siapa(req);
    if (!u) return err('Belum masuk.', 401);
    const b = await req.json();
    if (b.aksi === 'muat') {
      if (!await cariSatu('mitra', { _id: u.$id })) return err('Khusus mitra.', 403);
      const [saldo, riwayat] = await Promise.all([
        saldoDompet(u.$id),
        cariBanyak('pencairan_dompet', { id_mitra: u.$id }, { sort: { created_at: -1 }, limit: 50 }),
      ]);
      return Response.json({ ...saldo, riwayat });
    }
    if (b.aksi !== 'tarik') return err('Aksi tidak dikenal.');
    if (!Number.isSafeInteger(b.nominal) || b.nominal < MINIMAL_PENARIKAN || !Number.isSafeInteger(b.nominal * 100)) {
      return err('Minimal penarikan Rp10.000 dengan nominal bulat.');
    }
    if (typeof b.permintaan !== 'string' || !/^[0-9a-f-]{36}$/.test(b.permintaan)) return err('ID pengajuan tidak valid.');

    return await denganTransaksi(async () => {
      // Tulis pada dokumen mitra agar dua permintaan serentak tidak bisa memakai saldo yang sama.
      const kunci = await ubahData('mitra', { _id: u.$id }, {}, { inc: { versi_dompet: 1 } });
      if (!kunci.matchedCount) return err('Khusus mitra.', 403);
      const id = u.$id + '_' + b.permintaan;
      const lama = await cariSatu('pencairan_dompet', { _id: id });
      if (lama) return lama.nominal === b.nominal
        ? Response.json({ ok: true })
        : err('Nominal pengajuan sudah tercatat.', 409);
      const mitra = await cariSatu('mitra', { _id: u.$id });
      const pengguna = await cariSatu('pengguna', { _id: u.$id });
      if (pengguna?.status_akun !== 'AKTIF') return err('Akun mitra belum aktif.', 403);
      if (!mitra.id_qris) return err('Unggah QRIS pencairan di menu QRIS Toko.');
      const saldo = await saldoDompet(u.$id);
      if (b.nominal > saldo.tersedia) return err('Saldo tersedia tidak mencukupi.');
      await tulis('pencairan_dompet', id, {
        id_mitra: u.$id, nama_usaha: mitra.nama_usaha, id_qris: mitra.id_qris,
        nominal: b.nominal, status: 'DIAJUKAN',
      });
      const admins = await cariBanyak('admin', {}, { limit: 0x7fffffff });
      for (const admin of admins) {
        await notif(null, admin.id, 'Penarikan saldo mitra',
          `${mitra.nama_usaha} mengajukan pencairan Rp${b.nominal.toLocaleString('id-ID')}. Buka menu Pencairan Mitra.`);
      }
      return Response.json({ ok: true });
    });
  } catch (error) {
    console.error('[/api/dompet]', error.message);
    return err('Dompet gagal diproses. Coba lagi.', 500);
  }
}
