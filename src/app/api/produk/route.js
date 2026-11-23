import { svc, siapa, err, getRow, put, upd, ID } from '@/lib/server';
import { arsipProduk } from '@/lib/arsip-produk';
import { hapusFile } from '@/lib/backblaze';
import { cariBanyak, cariSatu, denganTransaksi, hapusData, kunciProduk } from '@/lib/db';
import { bacaPilihanAddOn, stokValid } from '@/lib/add-on';
import { bacaKategori } from '@/lib/kategori';
import { dataKategoriProduk, transaksiKategori } from '@/lib/kategori-db';
export const dynamic = 'force-dynamic';

// Kelola produk mitra: tambah, ubah, hapus.
// Akses tulis diperiksa di server berdasarkan akun mitra pemilik produk.
const hargaValid = (n) => Number.isFinite(+n) && +n >= 0 && Number.isSafeInteger(Math.round(+n * 100));

async function hapusGambarJikaTidakDipakai(id, uid, produkDikecualikan) {
  if (!id) return;
  const [file, produk, mitra, pencairan] = await Promise.all([
    cariSatu('unggahan_file', { _id: id, id_pengguna: uid }),
    cariBanyak('produk', { id_gambar: id }, { limit: 500 }),
    cariSatu('mitra', { id_qris: id }),
    cariSatu('pencairan_dompet', { id_qris: id }),
  ]);
  if (!file || produk.length === 500 || produk.some((row) => row.$id !== produkDikecualikan) || mitra || pencairan) return;
  await hapusFile(id).catch(() => {});
  await hapusData('unggahan_file', { _id: id, id_pengguna: uid });
}

export async function POST(req) {
  try {
  const u = await siapa(req);
  if (!u) return err('Belum masuk.', 401);

  const b = await req.json();
  const { db } = svc();

  // Pastikan akun aktif dan merupakan mitra
  const pg = await getRow(db, 'pengguna', u.$id).catch(() => null);
  if (!pg || pg.status_akun !== 'AKTIF') return err('Akun mitra belum aktif.', 403);
  if (!(await getRow(db, 'mitra', u.$id).catch(() => null))) return err('Hanya mitra yang bisa mengelola produk.', 403);

  const pilihanAddOn = b.pilihan_add_on === undefined ? [] : bacaPilihanAddOn(b.pilihan_add_on);
  if (!pilihanAddOn) return err('Isi maksimal 20 nama add-on yang berbeda (maksimal 60 karakter) dan harga bulat dari Rp0 hingga Rp999.999.999.');
  const dataAddOn = {
    pilihan_add_on: pilihanAddOn.map(({ nama }) => nama),
    harga_add_on: Object.fromEntries(pilihanAddOn.map(({ nama, harga }) => [nama, harga])),
  };
  const stokPerVarian = pilihanAddOn.some(({ stok }) => stok !== undefined);
  if (stokPerVarian) {
    const total = pilihanAddOn.reduce((sum, { stok }) => sum + stok, 0);
    if (!stokValid(total)) return err('Isi stok setiap varian. Total stok harus berupa bilangan bulat yang valid.');
    dataAddOn.stok_varian = Object.fromEntries(pilihanAddOn.map(({ nama, stok }) => [nama, stok]));
    dataAddOn.stok = total;
    dataAddOn.stok_belum_dialokasikan = 0;
  }

  const adaKategori = b.kategori_list !== undefined || b.kategori !== undefined;
  const kategoriList = bacaKategori(b.kategori_list ?? b.kategori);
  if (adaKategori && !kategoriList?.length) return err('Pilih minimal satu kategori yang valid.');

  // ── Tambah produk ──────────────────────────────────────────────────
  if (b.aksi === 'tambah') {
    const { nama, harga, deskripsi, stok, id_gambar } = b;
    if (!nama || harga == null || !kategoriList?.length || (!stokPerVarian && stok == null)) return err('Data produk tidak lengkap.');
    if (!hargaValid(harga) || (!stokPerVarian && !stokValid(+stok))) return err('Harga atau stok tidak valid.');
    if (id_gambar && !(await cariSatu('unggahan_file', { _id: id_gambar, id_pengguna: u.$id, jenis: 'gambar' }))) return err('Gambar tidak ditemukan atau bukan milik akun ini.', 403);
    const data = { id_mitra: u.$id, nama, harga: +harga, deskripsi: deskripsi || '', stok: +stok, ...dataAddOn };
    if (id_gambar) data.id_gambar = id_gambar;
    const row = await transaksiKategori(async () =>
      put(db, 'produk', ID.unique(), { ...data, ...await dataKategoriProduk(kategoriList) }));
    return Response.json({ ok: true, id: row.$id });
  }

  // ── Ubah harga / stok / nama / deskripsi ──────────────────────────
  if (b.aksi === 'ubah') {
    const p = await getRow(db, 'produk', String(b.id || '')).catch(() => null);
    if (!p || p.diarsipkan || p.id_mitra !== u.$id) return err('Produk tidak ditemukan.', 404);
    if ((b.harga != null && !hargaValid(b.harga)) || (b.stok != null && !stokValid(+b.stok))) return err('Harga atau stok tidak valid.');
    const data = {};
    if (b.pilihan_add_on !== undefined) Object.assign(data, dataAddOn);
    if (b.nama != null) data.nama = b.nama;
    if (b.harga != null) data.harga = +b.harga;
    if (b.stok != null && !stokPerVarian) data.stok = +b.stok;
    if (b.deskripsi != null) data.deskripsi = b.deskripsi;
    if (b.id_gambar != null) data.id_gambar = b.id_gambar;
    if (b.id_gambar != null && b.id_gambar !== p.id_gambar && !(await cariSatu('unggahan_file', { _id: b.id_gambar, id_pengguna: u.$id, jenis: 'gambar' }))) return err('Gambar tidak ditemukan atau bukan milik akun ini.', 403);
    const simpan = async () => {
      await kunciProduk(p.$id);
      const terbaru = await cariSatu('produk', { _id: p.$id, id_mitra: u.$id, diarsipkan: false });
      if (!terbaru) return err('Produk tidak ditemukan.', 404);
      if (b.stok_diharapkan !== undefined && new Date(terbaru.updated_at).toISOString() !== b.stok_diharapkan) {
        return err('Data produk berubah. Muat ulang sebelum mengubah stok varian.', 409);
      }
      if (stokPerVarian) {
        data.stok_belum_dialokasikan = Math.max(0, (terbaru.stok_belum_dialokasikan ?? 0) - Math.max(0, data.stok - terbaru.stok));
      }
      if (terbaru.stok_varian && !stokPerVarian) {
        if (b.pilihan_add_on !== undefined && !pilihanAddOn.length) {
          data.stok = terbaru.stok + (terbaru.stok_belum_dialokasikan ?? 0);
          if (!stokValid(data.stok)) return err('Total stok melebihi batas.');
          data.stok_varian = null;
          data.stok_belum_dialokasikan = 0;
        } else if (b.stok != null || b.pilihan_add_on !== undefined) {
          return err('Ubah jumlah stok melalui setiap varian.');
        }
      }
      if (adaKategori) Object.assign(data, await dataKategoriProduk(kategoriList));
      await upd(db, 'produk', p.$id, data);
      return Response.json({ ok: true });
    };
    const hasil = await (adaKategori ? transaksiKategori(simpan) : denganTransaksi(simpan));
    if (hasil.ok && b.id_gambar != null && p.id_gambar && p.id_gambar !== b.id_gambar) await hapusGambarJikaTidakDipakai(p.id_gambar, u.$id, p.$id);
    return hasil;
  }

  // ── Hapus produk ──────────────────────────────────────────────────
  if (b.aksi === 'hapus') {
    if (typeof b.id !== 'string' || !await arsipProduk(b.id, u.$id)) return err('Produk tidak ditemukan.', 404);
    return Response.json({ ok: true });
  }

  return err('Aksi tidak dikenal.');
  } catch (e) {
    if (e.code === 409) return err(e.message, 409);
    console.error('[/api/produk] unhandled error:', e?.message || e);
    return err('Terjadi kesalahan server. Coba lagi.', 500);
  }
}
