'use client';

export default function InputVarian({ judul, nilai, onUbah, nonaktif = false }) {
  return (
    <fieldset className="field input-varian" disabled={nonaktif}>
      <legend>{judul}</legend>
      {nilai.map((nama, indeks) => (
        <div className="row" key={indeks}>
          <input
            type="text"
            aria-label={`Nama varian ${indeks + 1}`}
            placeholder={`Nama varian ${indeks + 1}`}
            maxLength={60}
            value={nama}
            onChange={(e) => onUbah(nilai.map((item, i) => i === indeks ? e.target.value : item))}
          />
          {nilai.length > 1 && <button
            type="button"
            className="btn out sm"
            aria-label={`Hapus varian ${indeks + 1}`}
            onClick={() => onUbah(nilai.filter((_, i) => i !== indeks))}
          >Hapus</button>}
        </div>
      ))}
      <button type="button" className="btn out sm" disabled={nilai.length >= 20} onClick={() => onUbah([...nilai, ''])}>
        + Tambah varian
      </button>
    </fieldset>
  );
}
