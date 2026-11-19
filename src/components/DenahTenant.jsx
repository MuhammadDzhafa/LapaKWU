'use client';

import { useEffect, useId, useRef } from 'react';

const meja = [
  ...[13, 10, 7, 4, 1].map((awal, i) => ({ awal, x: 65, y: 64 + 130 * i, vertikal: true })),
  ...[16, 19, 22, 25, 28].map((awal, i) => ({ awal, x: 125 + 124 * i, y: 64 })),
  ...[31, 34, 37, 40, 43].map((awal, i) => ({ awal, x: 755, y: 64 + 130 * i, vertikal: true })),
  ...[46, 55, 64, 73, 82].flatMap((awal, i) =>
    [0, 1, 2].map((kolom) => ({ awal: awal + kolom * 3, x: 195 + 175 * kolom, y: [176, 257, 338, 506, 587][i] }))),
];

const kotak = meja.flatMap(({ awal, x, y, vertikal }) =>
  [0, 1, 2].map((i) => ({ nomor: awal + i, x: x + (vertikal ? 0 : i * 34), y: y + (vertikal ? i * 34 : 0) })));

function Stand({ kotak: { nomor, x, y }, dipilih }) {
  return (
    <g className={dipilih ? 'denah-stand denah-stand-aktif' : 'denah-stand'} aria-hidden="true">
      <rect x={x} y={y} width="34" height="34" rx="3" />
      <text x={x + 17} y={y + 17} dominantBaseline="central" textAnchor="middle">{nomor}</text>
    </g>
  );
}

export default function DenahTenant({ nomor, nama, onClose }) {
  const dialog = useRef(null);
  const area = useRef(null);
  const judul = useId();
  const deskripsi = useId();
  const aktif = kotak.find((stand) => stand.nomor === nomor);

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
    if (aktif) {
      const lebar = area.current.scrollWidth;
      area.current.scrollLeft = (aktif.x + 17) * lebar / 856 - area.current.clientWidth / 2;
    }
  }, [aktif]);

  return (
    <dialog ref={dialog} className="denah-modal" aria-labelledby={judul} onClose={onClose}>
      <header className="row denah-header">
        <div>
          <h3 id={judul}>Denah area bazar</h3>
          <p><b>Tenant {nomor}</b>{nama && <> · {nama}</>}</p>
        </div>
        <form method="dialog"><button className="btn sm out">Tutup</button></form>
      </header>
      <div ref={area} className="denah-scroll" tabIndex={0} aria-label="Denah dapat digeser ke samping">
        <svg viewBox="0 0 856 806" role="img" aria-labelledby={deskripsi} className="denah-svg">
          <title id={deskripsi}>{`Denah 90 stand. Tenant ${nomor} ditandai warna kuning. Pintu masuk dan keluar di sisi bawah.`}</title>
          <path d="M349 718H51V51H805V718H507" fill="none" stroke="currentColor" strokeWidth="3"/>
          <rect className="denah-zona" x="168" y="151" width="514" height="244" rx="10"/>
          <rect className="denah-zona" x="168" y="480" width="514" height="166" rx="10"/>
          <rect className="denah-jalan" x="168" y="411" width="514" height="53" rx="9"/>
          <text className="denah-label" x="425" y="444" textAnchor="middle">→　　 JALAN　　 ←</text>
          <text className="denah-label" transform="translate(30 390) rotate(-90)" textAnchor="middle">GEDUNG B · SAYAP KIRI</text>
          <text className="denah-label" transform="translate(827 390) rotate(90)" textAnchor="middle">GEDUNG A · SAYAP KANAN</text>
          <path d="M349 718V688Q385 688 385 718M507 718V688Q471 688 471 718" fill="none" stroke="currentColor"/>
          <text className="denah-label" x="394" y="751" textAnchor="middle">↑ MASUK</text>
          <text className="denah-label" x="464" y="751" textAnchor="middle">↓ KELUAR</text>
          <text className="denah-label" x="428" y="780" textAnchor="middle">PINTU MASUK / KELUAR</text>
          {kotak.filter((stand) => stand.nomor !== nomor).map((stand) => <Stand key={stand.nomor} kotak={stand}/>)}
          {aktif && <Stand kotak={aktif} dipilih/>}
        </svg>
      </div>
    </dialog>
  );
}
