'use client';

import { useEffect, useId, useRef } from 'react';

const mejaAtas = [[26, 12, 10], [9, 8, 7], [6, 5, 4], [3, 2, 1]];
const mejaKiri = [[29, 30, 31], [32, 33, 34], [35, 37, 38], [39, 40, 41], [42, 45, 61]];
const mejaKanan = [[11, 13, 14], [15, 16, 17], [18, 19, 21], [53, 55, 56], [57, 58, 59]];
const tengahAtas = [[24, 25, 27], [23, 22, 20], [28, 43, 49], [46, 48, 49], [36, 47, 63], [50, 51, 52]];
const tengahBawah = [[54, 69, 70], [60, 62, 65], [66, 71, 72], [67, 68, 69]];

const meja = [
  ...mejaAtas.map((nomor, i) => ({ nomor, x: 160 + i * 234, y: 184, lebar: 216, tinggi: 64 })),
  ...mejaKiri.map((nomor, i) => ({ nomor, x: 85, y: 258 + i * 149, lebar: 70, tinggi: 139, vertikal: true })),
  ...mejaKanan.map((nomor, i) => ({ nomor, x: 1099, y: 258 + i * 149, lebar: 70, tinggi: 139, vertikal: true })),
  ...tengahAtas.map((nomor, i) => ({ nomor, x: 195 + (i % 2) * 460, y: 336 + Math.floor(i / 2) * 80, lebar: 404, tinggi: 66 })),
  ...tengahBawah.map((nomor, i) => ({ nomor, x: 195 + (i % 2) * 460, y: 760 + Math.floor(i / 2) * 80, lebar: 404, tinggi: 66 })),
];

function MejaTenant({ data: { nomor, x, y, lebar, tinggi, vertikal }, aktif }) {
  const lebarSlot = vertikal ? lebar : lebar / nomor.length;
  const tinggiSlot = vertikal ? tinggi / nomor.length : tinggi;

  return (
    <g>
      <rect className="denah-bingkai-meja" x={x} y={y} width={lebar} height={tinggi} rx="14" />
      {nomor.map((angka, i) => {
        const kiri = x + (vertikal ? 0 : i * lebarSlot);
        const atas = y + (vertikal ? i * tinggiSlot : 0);
        return (
          <g key={angka} className={angka === aktif ? 'denah-tenant denah-tenant-aktif' : 'denah-tenant'}>
            <rect x={kiri + 4} y={atas + 4} width={lebarSlot - 8} height={tinggiSlot - 8} rx="10" />
            <text x={kiri + lebarSlot / 2} y={atas + tinggiSlot / 2} dominantBaseline="central">{angka}</text>
          </g>
        );
      })}
    </g>
  );
}

export function PetaTenant({ nomor }) {
  const deskripsi = useId();
  const disorot = meja.some((data) => data.nomor.includes(nomor));

  return (
    <svg viewBox="0 0 1254 1188" role="img" aria-labelledby={deskripsi} className="denah-svg">
      <title id={deskripsi}>
        {disorot ? `Denah bazar. Tenant ${nomor} disorot.` : 'Denah bazar dan pintu masuk di sisi bawah.'}
      </title>
      <rect className="denah-zona" x="132" y="14" width="990" height="97" rx="34" />
      <text className="denah-judul" x="627" y="58">Area Bazar / Kewirausahaan</text>
      <text className="denah-label" x="627" y="94">LAYOUT TENANT</text>
      <path className="denah-garis" d="M77 130v28m0-14h347m406 0h347m0-14v28" />
      <text className="denah-label" x="627" y="153">Lebar lapangan 12 m</text>
      <path className="denah-batas" d="M464 1108H90Q77 1108 77 1095V182Q77 169 90 169H1164Q1177 169 1177 182V1095Q1177 1108 1164 1108H790" />
      <rect className="denah-zona" x="265" y="267" width="724" height="52" rx="26" />
      <text className="denah-label" x="627" y="303">ZONA TENGAH ATAS</text>
      <rect className="denah-jalan" x="172" y="586" width="910" height="94" rx="21" />
      <path className="denah-garis" d="M231 633h174m-18-13 18 13-18 13m636-13H849m18-13-18 13 18 13" />
      <text className="denah-judul" x="627" y="648">JALAN</text>
      <rect className="denah-zona" x="265" y="700" width="724" height="52" rx="26" />
      <text className="denah-label" x="627" y="736">ZONA TENGAH BAWAH</text>
      <rect className="denah-sayap" x="14" y="382" width="53" height="512" rx="20" />
      <rect className="denah-sayap" x="1187" y="382" width="53" height="512" rx="20" />
      <text className="denah-label denah-label-putih" transform="translate(51 638) rotate(-90)">GEDUNG B · SAYAP KIRI</text>
      <text className="denah-label denah-label-putih" transform="translate(1203 638) rotate(90)">GEDUNG A · SAYAP KANAN</text>
      {meja.map((data) => <MejaTenant key={data.x + '-' + data.y} data={data} aktif={nomor} />)}
      <rect className="denah-lapakwu" x="195" y="920" width="404" height="66" rx="14" />
      <text className="denah-label" x="397" y="963">LapakWU</text>
      <path className="denah-garis" d="M464 1108v-86a86 86 0 0 1 86 86m240 0v-86a86 86 0 0 0-86 86" />
      <text className="denah-arah denah-masuk" x="583" y="1073">↑</text>
      <text className="denah-arah denah-keluar" x="671" y="1073">↓</text>
      <text className="denah-masuk" x="583" y="1100">Masuk</text>
      <text className="denah-keluar" x="671" y="1100">Keluar</text>
      <rect className="denah-sayap" x="435" y="1120" width="384" height="53" rx="26" />
      <text className="denah-label denah-label-putih" x="627" y="1156">PINTU MASUK / KELUAR</text>
    </svg>
  );
}

export default function DenahTenant({ nomor, nama, onClose }) {
  const dialog = useRef(null);
  const judul = useId();
  const jumlahLokasi = meja.filter((data) => data.nomor.includes(nomor)).length;

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
      {jumlahLokasi > 0 && <p className="denah-petunjuk">Ambil pesanan di tenant {nomor} yang ditandai kuning.</p>}
      {jumlahLokasi === 0 && <p>Nomor tenant ini belum tercantum di denah.</p>}
      {jumlahLokasi > 1 && <p>Nomor ini tercantum di dua lokasi. Cocokkan nama lapak saat mengambil pesanan.</p>}
      <div className="denah-peta">
        <PetaTenant nomor={nomor} />
      </div>
    </dialog>
  );
}
