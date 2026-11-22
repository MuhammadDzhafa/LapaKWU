export const MAKS_HARGA_ADD_ON = 999999999;
const hargaValid = (nilai) => Number.isSafeInteger(nilai) && nilai >= 0 && nilai <= MAKS_HARGA_ADD_ON;

export function bacaPilihanAddOn(teks) {
  const masukan = typeof teks === 'string' && teks.length <= 2000 ? teks.split(/[,\r\n]+/) : teks;
  if (!Array.isArray(masukan) || masukan.length > 20) return null;
  const pilihan = [];
  const dipakai = new Set();
  for (const item of masukan) {
    const namaMentah = typeof item === 'string' ? item : item?.nama;
    const harga = typeof item === 'string' ? 0 : item?.harga;
    if (typeof namaMentah !== 'string' || namaMentah.length > 60 || namaMentah.includes('\0') || !hargaValid(harga)) return null;
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
  return (Math.round(produk.harga * 100) + hargaAddOn(produk, pilihan) * 100) / 100;
}

export function addOnValid(produk, pilihan = '') {
  return produk.pilihan_add_on?.length
    ? produk.pilihan_add_on.includes(pilihan)
    : pilihan === '';
}

export const MAKS_CATATAN_ITEM = 200;

export function itemCocok(item, idProduk, addOn, catatan) {
  return item.id_produk === idProduk && (item.add_on ?? '') === addOn && (item.catatan_item ?? '') === catatan;
}

export function namaDenganAddOn(nama, pilihan) {
  return pilihan ? `${nama} · ${pilihan}` : nama;
}
