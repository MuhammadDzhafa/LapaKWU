'use client';

import { useEffect, useId, useRef } from 'react';

const meja = [
  { nomor: [26, 12, 10], x: [222, 278, 332], y: 217 },
  { nomor: [9, 8, 7], x: [463, 509, 552], y: 217 },
  { nomor: [6, 5, 4], x: [702, 751, 795], y: 217 },
  { nomor: [3, 2, 1], x: [934, 984, 1028], y: 217 },
  { nomor: [24, 25, 27], x: [319, 399, 478], y: 369 },
  { nomor: [23, 22, 20], x: [776, 855, 937], y: 369 },
  { nomor: [28, 43, 49], x: [313, 400, 483], y: 449 },
  { nomor: [46, 48, 49], x: [771, 859, 943], y: 449 },
  { nomor: [36, 47, 63], x: [313, 400, 484], y: 527 },
  { nomor: [50, 51, 52], x: [775, 860, 941], y: 527 },
  { nomor: [54, 69, 70], x: [312, 398, 480], y: 797 },
  { nomor: [60, 62, 65], x: [774, 859, 941], y: 798 },
  { nomor: [66, 71, 72], x: [315, 398, 479], y: 874 },
  { nomor: [67, 68, 69], x: [776, 859, 941], y: 875 },
  { nomor: [29, 30, 31, 32, 33, 34, 35, 37, 38, 39, 40, 41, 42, 45, 61],
    x: 120, y: [259, 305, 350, 425, 468, 512, 586, 629, 671, 741, 784, 828, 900, 944, 987] },
  { nomor: [11, 13, 14, 15, 16, 17, 18, 19, 21, 53, 55, 56, 57, 58, 59],
    x: 1134, y: [259, 305, 350, 426, 469, 512, 586, 629, 672, 746, 788, 831, 900, 944, 987] },
];

const posisiTenant = meja.flatMap(({ nomor, x, y }) =>
  nomor.map((angka, indeks) => ({
    nomor: angka,
    x: Array.isArray(x) ? x[indeks] : x,
    y: Array.isArray(y) ? y[indeks] : y,
  })));

export function PetaTenant({ nomor }) {
  const deskripsi = useId();
  const aktif = posisiTenant.filter((stand) => stand.nomor === nomor);

  return (
    <svg viewBox="0 0 1254 1190" role="img" aria-labelledby={deskripsi} className="denah-svg">
      <title id={deskripsi}>
        {aktif.length ? 'Denah bazar. Tenant ' + nomor + ' disorot.' : 'Denah bazar dan pintu masuk di sisi bawah.'}
      </title>
      <image href="/denah-bazar.jpeg" width="1254" height="1254" />
      {aktif.map(({ x, y }) => (
        <rect
          className="denah-sorotan"
          key={x + '-' + y}
          x={x - 32}
          y={y - 23}
          width="64"
          height="46"
          rx="9"
        />
      ))}
    </svg>
  );
}

export default function DenahTenant({ nomor, nama, onClose }) {
  const dialog = useRef(null);
  const judul = useId();
  const jumlahLokasi = posisiTenant.filter((stand) => stand.nomor === nomor).length;

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
      {jumlahLokasi === 0 && <p>Nomor tenant ini belum tercantum di denah.</p>}
      {jumlahLokasi > 1 && <p>Nomor ini tercantum di dua lokasi. Cocokkan nama lapak saat mengambil pesanan.</p>}
      <div className="denah-peta">
        <PetaTenant nomor={nomor} />
      </div>
    </dialog>
  );
}
