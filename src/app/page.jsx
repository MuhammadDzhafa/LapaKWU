'use client';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { list, Query, rp, img, tambahKeranjang } from '@/lib/aw';
import { useSaya } from '@/components/Shell';
import Lapak from '@/components/Lapak';

// Peragaan di hero: tiap tekan − stok turun dan rekap naik, sama seperti di dashboard mitra.
function Live() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((x) => x + 1), 2400);
    return () => clearInterval(t);
  }, []);
  const n = i % 5, stok = 12 - n, rekap = 21000 + n * 7000;
  return (<div aria-hidden="true">
    <div className="live a"><small>Keripik pisang</small>
      <div className="qrow"><span className="qb2">−</span><b className="num"><span key={stok} className="tick">{stok}</span></b><span className="qb2 go">+</span></div>
      {n > 0 && <span key={i} className="chg">−1 offline</span>}</div>
    <div className="live b"><small>Rekap hari ini</small><b className="rp"><span key={rekap} className="tick">{rp(rekap)}</span></b><small>online + offline</small></div>
  </div>);
}

// Panggung hero: lapak miring mengikuti pointer. Mati otomatis kalau pengguna memilih mengurangi gerakan.
function Panggung({ children }) {
  const ref = useRef(null);
  const gerak = (e) => {
    const el = ref.current;
    if (!el || e.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const b = el.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
    el.style.setProperty('--ry', `${x * 9}deg`); el.style.setProperty('--rx', `${-y * 7}deg`);
    el.style.setProperty('--px', `${x * 14}px`); el.style.setProperty('--py', `${y * 10}px`);
  };
  const diam = () => ['--rx', '--ry', '--px', '--py'].forEach((v) => ref.current?.style.setProperty(v, v.startsWith('--p') ? '0px' : '0deg'));
  return <div className="stage" ref={ref} onPointerMove={gerak} onPointerLeave={diam}>{children}</div>;
}

const JUDUL = ['Belanja', 'di', 'lapak', 'teman', 'sekampus.'];

export default function Beranda() {
  const { akun, peran, toast } = useSaya();
  const r = useRouter();
  const [p, setP] = useState(null);
  const [m, setM] = useState([]);
  const [q, setQ] = useState('');
  const [k, setK] = useState('Semua');
  const [lapak, setLapak] = useState('');
  const [baru, setBaru] = useState(null);

  useEffect(() => {
    Promise.all([list('produk', [Query.orderDesc('$createdAt')]), list('mitra')]).then(([ps, ms]) => { setP(ps); setM(ms); }).catch(() => setP([]));
    const t = setInterval(() => { if (!document.hidden) list('produk', [Query.orderDesc('$createdAt')]).then(setP).catch(() => {}); }, 15000); // stok mengikuti penjualan offline mitra
    return () => clearInterval(t);
  }, []);

  const nama = useMemo(() => Object.fromEntries(m.map((x) => [x.$id, x.nama_usaha])), [m]);
  const kat = useMemo(() => ['Semua', ...new Set((p || []).map((x) => x.kategori))], [p]);
  const lapakAda = m.filter((x) => (p || []).some((y) => y.id_mitra === x.$id));
  const tampil = (p || []).filter((x) => (k === 'Semua' || x.kategori === k) && (!lapak || x.id_mitra === lapak) && x.nama.toLowerCase().includes(q.toLowerCase()));

  const tambah = async (x) => {
    if (!akun) return r.push('/masuk');
    if (peran !== 'pembeli') return toast('Keranjang hanya untuk akun pembeli.', true);
    try { await tambahKeranjang(akun.$id, x, 1); toast(`${x.nama} masuk keranjang`); setBaru(x.$id); setTimeout(() => setBaru((v) => (v === x.$id ? null : v)), 1100); } catch (e) { toast(e.message, true); }
  };

  return (
    <>
      <section className="hero2">
        <div className="awning" aria-hidden="true" />
        <div className="wrap">
          <div>
            <h1 aria-label={JUDUL.join(' ')}>{JUDUL.map((w, i) => <Fragment key={w}><span className="w" aria-hidden="true" style={{ '--w': i }}><span>{w}</span></span>{i < JUDUL.length - 1 && ' '}</Fragment>)}</h1>
            <p className="lead">Banyak mitra, satu keranjang. Pesan antar ke alamatmu, atau ambil langsung di lapaknya.</p>
            <div className="cta">
              <a href="#katalog" className="btn lg">Lihat produk</a>
              {peran !== 'mitra' && <Link href="/masuk?daftar=mitra" className="btn lg out">Buka lapakmu</Link>}
            </div>
          </div>
          <Panggung><Lapak /><Live /></Panggung>
        </div>
        <div className="ticker" aria-hidden="true"><div>{[0, 1].map((k) => ['Pesan antar', 'Ambil di lapak', 'QRIS', 'Virtual account', 'Bayar di tempat', 'Produk mitra KWU'].map((t) => <span key={k + t}>{t}</span>))}</div></div>
      </section>

      <div className="wrap">
        <div className="searchcard" id="katalog">
          <input type="search" aria-label="Cari produk" placeholder="Cari produk, misalnya keripik" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips">{kat.map((c) => <button key={c} className={'chip' + (c === k ? ' on' : '')} onClick={() => setK(c)}>{c}</button>)}</div>
        </div>
      </div>

      {lapakAda.length > 0 && (
        <section className="sec" id="mitra"><div className="wrap">
          <h2>Lapak mitra</h2><p className="sub">Pilih satu lapak untuk melihat produknya saja.</p>
          <div className="stalls">
            {lapakAda.map((x) => (
              <button key={x.$id} className={'stall' + (lapak === x.$id ? ' on' : '')} aria-pressed={lapak === x.$id} onClick={() => setLapak(lapak === x.$id ? '' : x.$id)}>
                <div><b>{x.nama_usaha}</b><small>{p.filter((y) => y.id_mitra === x.$id).length} produk</small></div>
              </button>
            ))}
          </div>
        </div></section>
      )}

      <section className="sec"><div className="wrap">
        <h2>{lapak ? `Produk ${nama[lapak]}` : 'Semua produk'}</h2>
        <div className="grid" aria-live="polite" style={{ marginTop: 18 }}>
          {p === null && Array.from({ length: 6 }, (_, i) => <div key={i} className="skel" />)}
          {tampil.map((x, n) => (
            <article key={x.$id} className="card prod" style={{ '--i': Math.min(n, 12) }}>
              <Link href={`/produk/${x.$id}`} className="ph" aria-label={x.nama}>
                {x.id_gambar ? <img src={img(x.id_gambar)} alt="" loading="lazy" /> : <span>{x.nama[0]}</span>}
                {x.stok < 1 && <em className="habis">Habis</em>}
              </Link>
              <div className="pb">
                <Link href={`/produk/${x.$id}`} className="nm">{x.nama}</Link>
                <small className="muted">{nama[x.id_mitra] || 'Mitra'}</small>
                <div className="pf">
                  <span className="tag">{rp(x.harga)}</span>
                  {x.stok > 0 && <button className={'plus' + (baru === x.$id ? ' ok' : '')} aria-label={`Tambah ${x.nama} ke keranjang`} onClick={() => tambah(x)}>{baru === x.$id ? '✓' : '+'}</button>}
                </div>
              </div>
            </article>
          ))}
        </div>
        {p && !tampil.length && <p className="kosong">{p.length ? 'Tidak ada produk yang cocok. Coba kata kunci, kategori, atau lapak lain.' : 'Belum ada produk. Mitra yang sudah diverifikasi bisa menambahkannya dari menu Lapak saya.'}</p>}
      </div></section>

      <section className="sec" id="cara"><div className="wrap">
        <h2>Cara belanja</h2><p className="sub">Tiga langkah, dari katalog sampai barang di tanganmu.</p>
        <div className="steps">
          <div className="step"><i>1</i><h3>Pilih produk</h3><p className="muted">Cari di katalog, lalu masukkan ke keranjang atau langsung beli sekarang.</p></div>
          <div className="step"><i>2</i><h3>Bayar dan pesan</h3><p className="muted">Pilih dikirim atau ambil sendiri, lalu bayar lewat QRIS, virtual account, atau di tempat.</p></div>
          <div className="step"><i>3</i><h3>Terima atau ambil</h3><p className="muted">Pantau status pesananmu. Mitra mendapat kabar lewat email atau WhatsApp.</p></div>
        </div>
        {peran !== 'mitra' && (
          <div className="band">
            <div><h2>Punya usaha kecil? Buka lapakmu di sini.</h2><p>Kelola produk, stok, pesanan, dan saldo dalam satu tempat.</p></div>
            <Link href="/masuk?daftar=mitra" className="btn sun lg">Daftar jadi mitra</Link>
          </div>
        )}
      </div></section>
    </>
  );
}
