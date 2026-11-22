'use client';

export default function PilihKategoriProduk({ nilai, onUbah, nonaktif = false, kategori = [] }) {
  const pilihan = [...new Set([...kategori, ...nilai.filter(Boolean)])];

  return (
    <fieldset className="field input-varian" disabled={nonaktif}>
      <legend>Kategori produk</legend>
      {nilai.map((kategori, indeks) => (
        <div className="row" key={indeks}>
          <select aria-label={`Kategori ${indeks + 1}`} required value={kategori}
            onChange={(e) => onUbah(nilai.map((item, i) => i === indeks ? e.target.value : item))}>
            <option value="" disabled>Pilih kategori</option>
            {pilihan.map((nama) => (
              <option key={nama} value={nama} disabled={nama !== kategori && nilai.includes(nama)}>{nama}</option>
            ))}
          </select>
          {nilai.length > 1 && <button type="button" className="btn out sm"
            aria-label={`Hapus kategori ${indeks + 1}`}
            onClick={() => onUbah(nilai.filter((_, i) => i !== indeks))}>Hapus</button>}
        </div>
      ))}
      <button type="button" className="btn out sm" disabled={nilai.includes('') || nilai.length >= pilihan.length || nilai.length >= 20}
        onClick={() => onUbah([...nilai, ''])}>+ Tambah kategori</button>
    </fieldset>
  );
}
