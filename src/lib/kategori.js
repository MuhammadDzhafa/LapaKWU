export const KATEGORI_PRODUK = [
  'Makanan', 'Minuman', 'Fashion', 'Kerajinan', 'Perlengkapan',
  'Aksesori', 'Alat Tulis', 'Kecantikan', 'Dekorasi', 'Elektronik', 'Lainnya',
];

const kategoriBaku = new Map(KATEGORI_PRODUK.map((nama) => [nama.toLowerCase(), nama]));

export function bacaKategori(nilai) {
  const daftar = typeof nilai === 'string' ? [nilai] : nilai;
  if (!Array.isArray(daftar) || daftar.length > 20) return null;
  const hasil = new Map();
  for (const isi of daftar) {
    if (typeof isi !== 'string' || isi.length > 100) return null;
    const nama = isi.trim();
    if (!nama) continue;
    const kunci = nama.toLowerCase();
    if (!hasil.has(kunci)) hasil.set(kunci, kategoriBaku.get(kunci) ?? nama);
  }
  return [...hasil.values()];
}

export function kategoriProduk(produk) {
  const pilihan = bacaKategori(produk.kategori_list);
  return pilihan?.length ? pilihan : bacaKategori(produk.kategori) ?? [];
}
