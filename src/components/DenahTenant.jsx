'use client';

import { useEffect, useId, useRef } from 'react';
import { JUMLAH_TENANT } from '@/lib/tenant';

const meja = [
  ...[156, 373, 590, 806].map((x, i) => ({
    awal: 1 + i * 3, x, y: 206, lebar: 66, tinggi: 56,
  })),
  ...[89, 1011].flatMap((x, sisi) =>
    [241, 415, 590, 761, 931].map((y, i) => ({
      awal: 13 + sisi * 15 + i * 3, x, y, lebar: 60, tinggi: 45, vertikal: true,
    }))),
  ...[365, 448, 532, 800, 884, 967].flatMap((y, baris) =>
    (baris === 5 ? [205] : [205, 605]).map((x, kolom) => ({
      awal: 43 + baris * 6 + kolom * 3, x, y, lebar: kolom ? 116 : 117, tinggi: 59,
    }))),
];

const posisiTenant = meja.flatMap(({ awal, x, y, lebar, tinggi, vertikal }) =>
  [0, 1, 2].map((indeks) => ({
    nomor: awal + indeks,
    x: x + (vertikal ? 0 : indeks * lebar),
    y: y + (vertikal ? indeks * tinggi : 0),
    lebar,
    tinggi,
  })));

export function PetaTenant({ nomor }) {
  const deskripsi = useId();
  const aktif = posisiTenant.find((stand) => stand.nomor === nomor);

  return (
    <svg viewBox="0 0 1157 1240" role="img" aria-labelledby={deskripsi} className="denah-svg">
      <title id={deskripsi}>
        {aktif ? 'Denah bazar. Tenant ' + nomor + ' disorot.' : 'Denah bazar dengan ' + JUMLAH_TENANT + ' tenant dan pintu di sisi bawah.'}
      </title>
      <image href="/denah-bazar.jpeg" width="1157" height="1360" />
      {aktif && (
        <rect
          className="denah-sorotan"
          x={aktif.x}
          y={aktif.y}
          width={aktif.lebar}
          height={aktif.tinggi}
          rx="9"
        />
      )}
    </svg>
  );
}

export default function DenahTenant({ nomor, nama, onClose }) {
  const dialog = useRef(null);
  const judul = useId();

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
  }, []);

  return (
    <dialog ref={dialog} className="denah-modal" aria-labelledby={judul} onClose={onClose}>
      <header className="row denah-header">
        <div>
          <h3 id={judul}>Denah area bazar</h3>
          <p><b>Tenant {nomor}</b>{nama && <> · {nama}</>}</p>
        </div>
        <form method="dialog"><button className="btn sm out">Tutup</button></form>
      </header>
      <div className="denah-peta">
        <PetaTenant nomor={nomor} />
      </div>
    </dialog>
  );
}
