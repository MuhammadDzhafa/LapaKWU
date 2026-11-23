'use client';

import { useEffect, useId, useRef } from 'react';
import { JUMLAH_TENANT } from '@/lib/tenant';

const meja = [
  ...[1, 4, 7, 10].map((awal, i) => ({ awal, x: 84 + 170 * i, y: 78, lebar: 50, tinggi: 42, zona: 'atas' })),
  ...[['kiri', 13, 32], ['kanan', 28, 760]].flatMap(([zona, pertama, x]) =>
    Array.from({ length: 5 }, (_, i) => ({ awal: pertama + i * 3, x, y: 106 + i * 122, lebar: 46, tinggi: 32, zona, vertikal: true }))),
  ...[43, 49, 55, 61, 67, 73].flatMap((awal, i) =>
    (awal === 73 ? [0] : [0, 1]).map((kolom) => ({
      awal: awal + kolom * 3, x: 122 + 300 * kolom, y: [192, 250, 308, 505, 563, 621][i],
      lebar: 94, tinggi: 42, zona: 'tengah',
    }))),
];

const kotak = meja.flatMap(({ awal, x, y, lebar, tinggi, zona, vertikal }) =>
  [0, 1, 2].map((i) => ({
    nomor: awal + i, x: x + (vertikal ? 0 : i * lebar), y: y + (vertikal ? i * tinggi : 0), lebar, tinggi, zona,
  })));

function Stand({ data: { nomor, x, y, lebar, tinggi, zona }, aktif }) {
  return (
    <g className={aktif ? 'denah-stand denah-stand-aktif' : 'denah-stand'} data-zona={zona}>
      <rect x={x} y={y} width={lebar} height={tinggi} rx="6" />
      <text x={x + lebar / 2} y={y + tinggi / 2} dominantBaseline="central" textAnchor="middle">{nomor}</text>
    </g>
  );
}

export function PetaTenant({ nomor }) {
  const deskripsi = useId();
  const aktif = kotak.find((stand) => stand.nomor === nomor);

  return (
    <svg viewBox="0 0 838 836" role="img" aria-labelledby={deskripsi} className="denah-svg">
      <title id={deskripsi}>{aktif ? `Denah bazar. Tenant ${nomor} disorot.` : `Denah bazar dengan ${JUMLAH_TENANT} tenant dan pintu di sisi bawah.`}</title>
      <text className="denah-judul" x="419" y="29">Area Bazar / Kewirausahaan</text>
      <text className="denah-label" x="419" y="52">12 m × 12 m · 75 kelompok · 25 meja (3 kelompok/meja)</text>
      <path d="M330 782H26V66H812V782H508" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect className="denah-zona" x="105" y="144" width="628" height="35" rx="17" />
      <text className="denah-label" x="419" y="167">ZONA TENGAH ATAS</text>
      <rect className="denah-jalan" x="96" y="374" width="646" height="67" rx="12" />
      <text className="denah-judul" x="419" y="415">→　　 JALAN　　 ←</text>
      <rect className="denah-zona" x="105" y="457" width="628" height="35" rx="17" />
      <text className="denah-label" x="419" y="480">ZONA TENGAH BAWAH</text>
      <text className="denah-label" transform="translate(19 397) rotate(-90)">GEDUNG B · SAYAP KIRI</text>
      <text className="denah-label" transform="translate(819 397) rotate(90)">GEDUNG A · SAYAP KANAN</text>
      {[0, 1, 2, 3].flatMap((i) => [55, 783].map((x) => (
        <text key={`${i}-${x}`} className="denah-jarak" x={x} y={218 + i * 122}>50 cm</text>
      )))}
      <path d="M330 782V728Q383 728 383 782M508 782V728Q455 728 455 782" fill="none" stroke="currentColor" strokeWidth="2" />
      <text className="denah-label" x="387" y="750" fill="#16854c">↑</text>
      <text className="denah-label" x="451" y="750" fill="#b62435">↓</text>
      <text className="denah-jarak" x="387" y="771">MASUK</text>
      <text className="denah-jarak" x="451" y="771">KELUAR</text>
      <text className="denah-label" x="419" y="809">PINTU KELUAR / MASUK</text>
      {kotak.filter((stand) => stand !== aktif).map((stand) => <Stand key={stand.nomor} data={stand} />)}
      {aktif && <Stand data={aktif} aktif />}
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
