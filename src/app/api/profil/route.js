import { siapa, err, getRow, put, upd, baca, milik } from '@/lib/server';
import { ubahNama, ubahEmail } from '@/lib/auth';
import { normHp } from '@/lib/kirim';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const u = await siapa(req);
    if (!u) return err('Sesi login tidak dikenali server.', 401);
    const b = await req.json();
    const s = (v, n = 255) => String(v || '').trim().slice(0, n);

    if (b.aksi === 'daftar') {
      const kanal = b.kanal === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL';
      const hp = normHp(b.no_telepon);
      if (kanal === 'WHATSAPP' && !hp) return err('Isi nomor WhatsApp yang valid, misalnya 0812xxxxxxx.');
      if (b.peran === 'mitra' && !s(b.nama_usaha)) return err('Isi nama usaha.');

      const pgAda = await getRow(null, 'pengguna', u.$id).catch(() => null);
      if (pgAda) {
        await upd(null, 'pengguna', u.$id, {
          ...(hp ? { no_telepon: hp } : {}),
          kanal,
        });
      } else {
        await put(null, 'pengguna', u.$id, { nama: u.name, email: u.email, no_telepon: hp || '', status_akun: 'AKTIF', kanal, kontak_terverifikasi: true }, []);
      }

      if (b.peran === 'mitra') {
        const mtAda = await getRow(null, 'mitra', u.$id).catch(() => null);
        if (mtAda) await upd(null, 'mitra', u.$id, { nama_usaha: s(b.nama_usaha), alamat_usaha: s(b.alamat) });
        else await put(null, 'mitra', u.$id, { nama_usaha: s(b.nama_usaha), alamat_usaha: s(b.alamat) }, []);
      } else {
        const pbAda = await getRow(null, 'pembeli', u.$id).catch(() => null);
        if (pbAda) await upd(null, 'pembeli', u.$id, { alamat: s(b.alamat) });
        else await put(null, 'pembeli', u.$id, { alamat: s(b.alamat) }, []);
        if (!(await getRow(null, 'keranjang', u.$id).catch(() => null))) {
          await put(null, 'keranjang', u.$id, { id_pembeli: u.$id, total_harga: 0 }, []);
        }
      }
      return Response.json({ ok: true });
    }

    // Pulihkan profil yang hilang atau tidak terbaca
    if (b.aksi === 'pulihkan') {
      const adaAdmin = await getRow(null, 'admin', u.$id).catch(() => null);
      const pg0 = await getRow(null, 'pengguna', u.$id).catch(() => null);
      if (!pg0) {
        await put(null, 'pengguna', u.$id, { nama: u.name || u.email.split('@')[0], email: u.email, no_telepon: '', status_akun: adaAdmin ? 'AKTIF' : 'MENUNGGU_VERIFIKASI', kanal: 'EMAIL', kontak_terverifikasi: !!adaAdmin }, []);
      }
      const mt = await getRow(null, 'mitra', u.$id).catch(() => null);
      const pb = await getRow(null, 'pembeli', u.$id).catch(() => null);
      if (!mt && !pb && !adaAdmin) {
        await put(null, 'pembeli', u.$id, { alamat: '' }, []);
        if (!(await getRow(null, 'keranjang', u.$id).catch(() => null))) {
          await put(null, 'keranjang', u.$id, { id_pembeli: u.$id, total_harga: 0 }, []);
        }
      }
      return Response.json({ ok: true });
    }

    let pg = await getRow(null, 'pengguna', u.$id).catch(() => null);
    if (!pg) {
      const mt0 = await getRow(null, 'mitra', u.$id).catch(() => null);
      const pb0 = await getRow(null, 'pembeli', u.$id).catch(() => null);
      if (mt0 || pb0) {
        pg = await put(null, 'pengguna', u.$id, {
          nama: u.name || u.email.split('@')[0],
          email: u.email,
          no_telepon: '',
          status_akun: 'AKTIF',
          kanal: 'EMAIL',
          kontak_terverifikasi: true,
        }, []).catch(() => null);
      }
    }
    if (!pg && ['nama', 'email', 'telepon', 'detail'].includes(b.aksi)) return err('Profil tidak ditemukan.', 404);

    const perluVerif = async () => {
      const pb = await getRow(null, 'pembeli', u.$id).catch(() => null);
      await upd(null, 'pengguna', u.$id, { kontak_terverifikasi: false, ...(pb ? { status_akun: 'MENUNGGU_VERIFIKASI' } : {}) });
    };

    if (b.aksi === 'nama') {
      const nama = s(b.nama, 100);
      if (!nama) return err('Nama tidak boleh kosong.');
      await ubahNama(u.$id, nama);
      await upd(null, 'pengguna', u.$id, { nama });
      return Response.json({ ok: true });
    }

    if (b.aksi === 'email') {
      await ubahEmail(u.$id, u.email);
      await upd(null, 'pengguna', u.$id, { email: u.email });
      if (pg.kanal === 'EMAIL') { await perluVerif(); return Response.json({ ok: true, verifikasi: true }); }
      return Response.json({ ok: true });
    }

    if (b.aksi === 'telepon') {
      const kosong = !String(b.no_telepon || '').trim();
      const hp = normHp(b.no_telepon);
      if (kosong && pg.kanal === 'WHATSAPP') return err('Nomor WhatsApp wajib diisi karena dipakai untuk verifikasi.');
      if (!kosong && !hp) return err('Nomor telepon tidak valid. Contoh: 0812xxxxxxx.');
      await upd(null, 'pengguna', u.$id, { no_telepon: hp || '' });
      if (pg.kanal === 'WHATSAPP' && hp !== pg.no_telepon) { await perluVerif(); return Response.json({ ok: true, verifikasi: true }); }
      return Response.json({ ok: true });
    }

    if (b.aksi === 'detail') {
      const mt = await getRow(null, 'mitra', u.$id).catch(() => null);
      const pb = await getRow(null, 'pembeli', u.$id).catch(() => null);
      if (mt) {
        const d = {};
        if ('nama_usaha' in b) { if (!s(b.nama_usaha)) return err('Nama usaha tidak boleh kosong.'); d.nama_usaha = s(b.nama_usaha); }
        if ('alamat' in b) d.alamat_usaha = s(b.alamat);
        if ('id_qris' in b) {
          d.id_qris = b.id_qris ? s(b.id_qris, 36) : null;
        }
        await upd(null, 'mitra', u.$id, d);
      } else if (pb && 'alamat' in b) await upd(null, 'pembeli', u.$id, { alamat: s(b.alamat) });
      return Response.json({ ok: true });
    }

    if (b.aksi === 'hapus_qris') {
      const mt = await getRow(null, 'mitra', u.$id).catch(() => null);
      if (!mt) return err('Khusus mitra.', 403);
      // Pengajuan yang sudah tercatat memakai gambar QRIS saat pengajuan dibuat.
      await upd(null, 'mitra', u.$id, { id_qris: null });
      return Response.json({ ok: true });
    }

    if (b.aksi === 'ubah') {
      const pgTarget = await getRow(null, 'pengguna', u.$id).catch(() => null);
      if (!pgTarget) return err('Profil tidak ditemukan.', 404);
      const nama = s(b.nama, 100);
      if (!nama) return err('Nama tidak boleh kosong.');
      const data = { nama };
      if (pgTarget.kanal !== 'WHATSAPP') {
        if (b.no_telepon && !normHp(b.no_telepon)) return err('Nomor telepon tidak valid.');
        data.no_telepon = normHp(b.no_telepon) || '';
      }
      await ubahNama(u.$id, nama);
      await upd(null, 'pengguna', u.$id, data);
      if (await getRow(null, 'pembeli', u.$id).catch(() => null)) await upd(null, 'pembeli', u.$id, { alamat: s(b.alamat) });
      if (await getRow(null, 'mitra', u.$id).catch(() => null)) {
        if (!s(b.nama_usaha)) return err('Nama usaha tidak boleh kosong.');
        await upd(null, 'mitra', u.$id, { nama_usaha: s(b.nama_usaha), alamat_usaha: s(b.alamat) });
      }
      return Response.json({ ok: true });
    }

    return err('Aksi tidak dikenal.');
  } catch (e) {
    console.error('[/api/profil] unhandled error:', e?.message || e);
    return err('Terjadi kesalahan server. Coba lagi.', 500);
  }
}
