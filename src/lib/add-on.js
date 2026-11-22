export function bacaPilihanAddOn(teks) {
  const masukan = typeof teks === 'string' && teks.length <= 2000 ? teks.split(/[,\r\n]+/) : teks;
  if (!Array.isArray(masukan) || masukan.length > 20 || masukan.some((nama) => typeof nama !== 'string')) return null;
  const pilihan = masukan.map((nama) => nama.trim()).filter(Boolean);
  if (pilihan.some((nama) => nama.length > 60)) return null;
  if (new Set(pilihan.map((nama) => nama.toLowerCase())).size !== pilihan.length) return null;
  return pilihan;
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
