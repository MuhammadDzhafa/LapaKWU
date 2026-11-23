export const MAKS_HARGA_ADD_ON = 999999999;
const hargaValid = (nilai) => Number.isSafeInteger(nilai) && nilai >= 0 && nilai <= MAKS_HARGA_ADD_ON;
// Nama tunggal tetap memakai format lama. Awalan ini membedakan daftar dari nama biasa.
const PENANDA_MULTI = '\u001f';

export function simpanPilihanAddOn(pilihan) {
  const urut = [...new Set(pilihan)].sort();
  return urut.length > 1 ? PENANDA_MULTI + JSON.stringify(urut) : urut[0] ?? '';
}

function daftarAddOn(pilihan) {
  if (typeof pilihan !== 'string' || pilihan.length > 7300) return null;
  if (!pilihan.startsWith(PENANDA_MULTI)) return pilihan ? [pilihan] : [];
  try {
    const daftar = JSON.parse(pilihan.slice(1));
    return Array.isArray(daftar) && daftar.length >= 2 && daftar.length <= 20
      && daftar.every((nama) => typeof nama === 'string' && nama.length > 0 && nama.length <= 60 && !nama.includes(PENANDA_MULTI))
      && new Set(daftar).size === daftar.length ? daftar : null;
  } catch {
    return null;
  }
}

export function bacaPilihanAddOn(teks) {
  const masukan = typeof teks === 'string' && teks.length <= 2000 ? teks.split(/[,\r\n]+/) : teks;
  if (!Array.isArray(masukan) || masukan.length > 20) return null;
  const pilihan = [];
  const dipakai = new Set();
  for (const item of masukan) {
    const namaMentah = typeof item === 'string' ? item : item?.nama;
    const harga = typeof item === 'string' ? 0 : item?.harga;
    if (typeof namaMentah !== 'string' || namaMentah.length > 60 || namaMentah.includes('\0') || namaMentah.includes(PENANDA_MULTI) || !hargaValid(harga)) return null;
    const nama = namaMentah.trim();
    if (!nama && harga === 0) continue;
    const kunci = nama.toLowerCase();
    if (!nama || dipakai.has(kunci)) return null;
    dipakai.add(kunci);
    pilihan.push({ nama, harga });
  }
  return pilihan;
}

export function hargaAddOn(produk, pilihan) {
  const daftar = produk.harga_add_on;
  const harga = pilihan && daftar && Object.hasOwn(daftar, pilihan) ? daftar[pilihan] : 0;
  return hargaValid(harga) ? harga : 0;
}

export function hargaSatuanProduk(produk, pilihan) {
  const tambahan = (daftarAddOn(pilihan) ?? []).reduce((total, nama) => total + hargaAddOn(produk, nama), 0);
  return (Math.round(produk.harga * 100) + tambahan * 100) / 100;
}

export function addOnValid(produk, pilihan = '') {
  const daftar = daftarAddOn(pilihan);
  if (!daftar) return false;
  return produk.pilihan_add_on?.length
    ? daftar.length > 0
      && daftar.every((nama) => produk.pilihan_add_on.includes(nama))
    : daftar.length === 0;
}

export const MAKS_CATATAN_ITEM = 200;

export function itemCocok(item, idProduk, addOn, catatan) {
  if (item.id_produk !== idProduk || (item.catatan_item ?? '') !== catatan) return false;
  const tersimpan = daftarAddOn(item.add_on ?? '');
  const dipilih = daftarAddOn(addOn);
  return Boolean(tersimpan && dipilih && simpanPilihanAddOn(tersimpan) === simpanPilihanAddOn(dipilih));
}

export function namaDenganAddOn(nama, pilihan) {
  const daftar = daftarAddOn(pilihan);
  return daftar?.length ? `${nama} · ${daftar.join(', ')}` : nama;
}
