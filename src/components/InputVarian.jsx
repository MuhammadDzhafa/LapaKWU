'use client';

import { MAKS_HARGA_ADD_ON } from '@/lib/add-on';

export default function InputVarian({ judul, nilai, onUbah, nonaktif = false }) {
  const ubah = (indeks, data) => onUbah(nilai.map((item, i) => i === indeks ? { ...item, ...data } : item));
  return (
    <fieldset className="field input-varian" disabled={nonaktif}>
      <legend>{judul}</legend>
      {nilai.map(({ nama, harga }, indeks) => (
        <div className="varian-harga" key={indeks}>
          <input
            type="text"
            aria-label={`Nama varian ${indeks + 1}`}
            placeholder={`Nama varian ${indeks + 1}`}
            maxLength={60}
            value={nama}
            onChange={(e) => ubah(indeks, { nama: e.target.value })}
          />
          <label>
            <small>Tambahan harga (Rp)</small>
            <input type="number" min={0} max={MAKS_HARGA_ADD_ON} step={1}
              aria-label={`Tambahan harga varian ${indeks + 1} (Rp)`}
              value={harga} onChange={(e) => ubah(indeks, { harga: e.target.value })} />
          </label>
          {nilai.length > 1 && <button
            type="button"
            className="btn out sm"
            aria-label={`Hapus varian ${indeks + 1}`}
            onClick={() => onUbah(nilai.filter((_, i) => i !== indeks))}
          >Hapus</button>}
        </div>
      ))}
      <button type="button" className="btn out sm" disabled={nilai.length >= 20} onClick={() => onUbah([...nilai, { nama: '', harga: 0 }])}>
        + Tambah varian
      </button>
    </fieldset>
  );
}
