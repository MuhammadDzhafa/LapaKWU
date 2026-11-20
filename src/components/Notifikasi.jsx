'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { list, Query, tgl, ubah } from '@/lib/aw';
import Ikon from '@/components/Ikon';

const HALAMAN = 20;

export default function Notifikasi({ uid, peran }) {
  const [terbuka, setTerbuka] = useState(false);
  const [terbaru, setTerbaru] = useState(null);
  const [riwayat, setRiwayat] = useState([]);
  const [belumDibaca, setBelumDibaca] = useState(null);
  const [galat, setGalat] = useState('');
  const [menandai, setMenandai] = useState(null);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [akhir, setAkhir] = useState(false);
  const wadah = useRef(null);
  const tombol = useRef(null);
  const versi = useRef(0);
  const path = usePathname();

  const ambil = useCallback((queries) => list('notifikasi', [
    Query.equal('id_pengguna', uid), Query.orderDesc('$createdAt'), ...queries,
  ]), [uid]);

  const muat = useCallback(async () => {
    const giliran = ++versi.current;
    try {
      const daftar = await ambil([Query.limit(HALAMAN)]);
      const baru = daftar.find((item) => !item.sudah_dibaca)
        ?? (daftar.length === HALAMAN
          ? (await ambil([Query.equal('sudah_dibaca', false), Query.limit(1)]))[0]
          : null);
      if (giliran !== versi.current) return;
      setTerbaru(daftar);
      setBelumDibaca(baru?.$id ?? null);
      setGalat('');
    } catch {
      if (giliran === versi.current) setGalat('Notifikasi gagal dimuat.');
    }
  }, [ambil]);

  useEffect(() => {
    const periksa = () => { if (!document.hidden) muat(); };
    periksa();
    const timer = setInterval(periksa, 5000);
    document.addEventListener('visibilitychange', periksa);
    return () => {
      versi.current++;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', periksa);
    };
  }, [muat]);

  useEffect(() => { setTerbuka(false); }, [path]);

  useEffect(() => {
    if (!terbuka) return;
    const diLuar = (e) => {
      if (!wadah.current?.contains(e.target)) setTerbuka(false);
    };
    const escape = (e) => {
      if (e.key === 'Escape') {
        setTerbuka(false);
        tombol.current?.focus();
      }
    };
    document.addEventListener('pointerdown', diLuar);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', diLuar);
      document.removeEventListener('keydown', escape);
    };
  }, [terbuka]);

  const daftar = [...new Map([...riwayat, ...(terbaru ?? [])].map((item) => [item.$id, item])).values()]
    .sort((a, b) => Date.parse(b.$createdAt) - Date.parse(a.$createdAt) || a.$id.localeCompare(b.$id));

  async function baca(id) {
    setMenandai(id);
    try {
      await ubah('notifikasi', id, { sudah_dibaca: true });
      setRiwayat((items) => items.map((item) => item.$id === id ? { ...item, sudah_dibaca: true } : item));
      await muat();
    } catch {
      setGalat('Notifikasi gagal ditandai. Coba lagi.');
    } finally {
      setMenandai(null);
    }
  }

  async function muatLagi() {
    setMemuatLagi(true);
    try {
      const hasil = await ambil([Query.offset(daftar.length), Query.limit(HALAMAN)]);
      setRiwayat((items) => [...new Map([...items, ...daftar, ...hasil].map((item) => [item.$id, item])).values()]);
      setAkhir(hasil.length < HALAMAN);
      setGalat('');
    } catch {
      setGalat('Notifikasi lama gagal dimuat. Coba lagi.');
    } finally {
      setMemuatLagi(false);
    }
  }

  const notifikasiTerbaru = terbaru?.[0];
  return <div className="nav-notifikasi" ref={wadah}>
    <button type="button" className="nav-lonceng" ref={tombol}
      aria-label={belumDibaca ? 'Notifikasi, ada yang belum dibaca' : 'Notifikasi'}
      aria-expanded={terbuka} aria-controls="panel-notifikasi"
      onClick={() => {
        if (!terbuka) muat();
        setTerbuka(!terbuka);
      }}>
      <span key={notifikasiTerbaru?.$id} className={notifikasiTerbaru && !notifikasiTerbaru.sudah_dibaca ? 'lonceng-gerak' : undefined}><Ikon n="bell" /></span>
      {belumDibaca && <span className="lonceng-titik" aria-hidden="true" />}
    </button>
    {terbuka && <section id="panel-notifikasi" className="panel-notifikasi" aria-labelledby="judul-notifikasi">
      <h2 id="judul-notifikasi">Notifikasi</h2>
      {galat && <p className="muted" role="status">{galat} <button className="link" type="button" onClick={muat}>Muat ulang</button></p>}
      {!galat && !terbaru && <p className="muted">Memuat notifikasi…</p>}
      {!galat && terbaru && !daftar.length && <p className="muted">Belum ada notifikasi.</p>}
      <ul className="daftar-notifikasi">
        {daftar.map((item) => <li key={item.$id} data-baru={!item.sudah_dibaca || undefined}>
          <b>{item.judul}</b>
          <p>{item.pesan}</p>
          <div className="baris-notifikasi">
            <time className="muted" dateTime={item.$createdAt}>{tgl(item.$createdAt)}</time>
            {!item.sudah_dibaca && <button type="button" className="link" disabled={menandai !== null}
              onClick={() => baca(item.$id)}>Tandai dibaca</button>}
          </div>
        </li>)}
      </ul>
      {!akhir && terbaru?.length === HALAMAN && <button className="link" type="button" disabled={memuatLagi} onClick={muatLagi}>
        {memuatLagi ? 'Memuat…' : 'Muat notifikasi lama'}
      </button>}
      {peran === 'mitra' && <a className="link" href="/mitra#pesanan" onClick={() => setTerbuka(false)}>Lihat pesanan</a>}
      {peran === 'pembeli' && <Link className="link" href="/pesanan" onClick={() => setTerbuka(false)}>Lihat pesanan</Link>}
    </section>}
  </div>;
}
