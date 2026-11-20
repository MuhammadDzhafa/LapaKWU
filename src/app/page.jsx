'use client';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { list, Query, rp, img } from '@/lib/aw';
import { useSaya } from '@/components/Shell';
import { PetaTenant } from '@/components/DenahTenant';
import Lapak from '@/components/Lapak';
import { Hitung, terbang } from '@/components/Motion';

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
const TICKER_ITEMS = Array.from({ length: 6 }, () => ['Ambil di lapak', 'QRIS', 'Bayar di tempat', 'Produk mitra KWU']).flat();

export default function Beranda() {
  const { akun, peran, toast, keranjang, ubahItemKeranjang } = useSaya();
  const r = useRouter();
  const [p, setP] = useState(null);
  const [galatKatalog, setGalatKatalog] = useState('');
  const [m, setM] = useState([]);
  const [q, setQ] = useState('');
  const [k, setK] = useState('Semua');
  const [lapak, setLapak] = useState('');
  const [baru, setBaru] = useState(null);

  useEffect(() => {
    let aktif = true;
    const muat = async () => {
      try {
        const [ps, ms] = await Promise.all([list('produk', [Query.orderDesc('$createdAt'), Query.limit(500)]), list('mitra', [Query.limit(500)])]);
        if (aktif) { setP(ps); setM(ms); setGalatKatalog(''); }
      } catch (error) {
        if (aktif) setGalatKatalog(error.message);
      }
    };
    muat();
    const t = setInterval(() => { if (!document.hidden) muat(); }, 30000); // stok mengikuti penjualan offline mitra
    return () => {
      aktif = false;
      clearInterval(t);
    };
  }, []);

  const nama = useMemo(() => Object.fromEntries(m.map((x) => [x.$id, x.nama_usaha])), [m]);
  const kat = useMemo(() => ['Semua', ...new Set((p || []).map((x) => x.kategori))], [p]);
  const layananMitra = new Map(m.map((mitra) => [mitra.$id, mitra]));
  const lapakAda = m.filter((x) => (p || []).some((y) => y.id_mitra === x.$id));
  const tampil = (p || []).filter((x) => (k === 'Semua' || x.kategori === k) && (!lapak || x.id_mitra === lapak) && x.nama.toLowerCase().includes(q.toLowerCase()));
  const keranjangMap = useMemo(() => Object.fromEntries((keranjang || []).map((i) => [i.id_produk, i.jumlah])), [keranjang]);

  const handleUbah = (x, delta, dari) => {
    ubahItemKeranjang(x, delta);
    if (delta > 0) {
      if (akun) terbang(dari);
      setBaru(x.$id);
      setTimeout(() => setBaru((v) => (v === x.$id ? null : v)), 800);
    }
  };

  return (
    <>
      <section className="hero2">
        <div className="aurora" aria-hidden="true"><i /><i /><i /><b /></div>
        <div className="awning" aria-hidden="true" />
        <div className="wrap">
          <div>
            <h1 aria-label={JUDUL.join(' ')}>{JUDUL.map((w, i) => <Fragment key={w}><span className="w" aria-hidden="true" style={{ '--w': i }}><span>{w}</span></span>{i < JUDUL.length - 1 && ' '}</Fragment>)}</h1>
            <p className="lead">Banyak mitra, satu keranjang. Bayar lewat QRIS atau langsung di lapak, lalu ambil pesananmu saat siap.</p>
            <div className="cta">
              <a href="#katalog" className="btn lg">Lihat produk</a>
              {peran !== 'mitra' && <Link href="/mitra/tata-cara" className="btn lg out">Buka lapakmu</Link>}
            </div>
            {p && p.length > 0 && (
              <ul className="hstats" aria-label="Isi katalog saat ini">
                <li><b><Hitung ke={p.length} /></b> produk</li>
                <li><b><Hitung ke={lapakAda.length} /></b> lapak mitra</li>
                <li><b><Hitung ke={kat.length - 1} /></b> kategori</li>
              </ul>
            )}
          </div>
          <Panggung><Lapak /><Live /></Panggung>
        </div>
        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            <div className="ticker-group">
              {TICKER_ITEMS.map((t, idx) => <span key={'t1-' + idx}>{t}</span>)}
            </div>
            <div className="ticker-group" aria-hidden="true">
              {TICKER_ITEMS.map((t, idx) => <span key={'t2-' + idx}>{t}</span>)}
            </div>
          </div>
        </div>
      </section>

      <div className="wrap">
        <div className="searchcard" id="katalog">
          <div className="cari">
            <input type="search" aria-label="Cari produk" placeholder="Cari produk, misalnya keripik" value={q} onChange={(e) => setQ(e.target.value)} />
            {!q && <kbd aria-hidden="true">/</kbd>}
          </div>
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
        <h2>{lapak ? `Produk ${nama[lapak]}` : 'Semua produk'}{p && <span className="jml" aria-label={`${tampil.length} produk`}>{tampil.length}</span>}</h2>
        <div className="grid" aria-live="polite" style={{ marginTop: 18 }}>
          {p === null && Array.from({ length: 6 }, (_, i) => <div key={i} className="skel" />)}
          {tampil.map((x, n) => (
            <article key={x.$id} className="card prod" style={{ '--i': Math.min(n, 12) }}>
              <Link href={`/produk/${x.$id}`} className="ph" aria-label={x.nama}>
                {x.id_gambar ? <img src={img(x.id_gambar)} alt="" loading="lazy" /> : <span>{x.nama[0]}</span>}
                {x.kategori && <span className="kat">{x.kategori}</span>}
                {x.stok < 1 && <em className="habis">Habis</em>}
                {x.stok > 0 && x.stok <= 5 && <em className="sisa">Sisa {x.stok}</em>}
              </Link>
              <div className="pb">
                <Link href={`/produk/${x.$id}`} className="nm">{x.nama}</Link>
                <small className="muted">{nama[x.id_mitra] || 'Mitra'}</small>
                <small className="muted" style={{ display: 'block' }}>{layananMitra.get(x.id_mitra)?.antar_aktif
                  ? 'Siap diantar + ' + rp(layananMitra.get(x.id_mitra).ongkir) + ' ongkir' : 'Ambil di lapak'}</small>
                <div className="pf">
                  <span className="tag">{rp(x.harga)}</span>
                  {x.stok > 0 && (
                    keranjangMap[x.$id] > 0 ? (
                      <div className="stepper-card" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="step-btn minus"
                          aria-label={`Kurangi ${x.nama}`}
                          onClick={(e) => { e.preventDefault(); handleUbah(x, -1, e.currentTarget); }}
                        >
                          −
                        </button>
                        <span className="step-num">{keranjangMap[x.$id]}</span>
                        <button
                          type="button"
                          className="step-btn plus-btn"
                          aria-label={`Tambah ${x.nama}`}
                          disabled={keranjangMap[x.$id] >= x.stok}
                          onClick={(e) => { e.preventDefault(); handleUbah(x, 1, e.currentTarget); }}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={'plus' + (baru === x.$id ? ' ok' : '')}
                        aria-label={`Tambah ${x.nama} ke keranjang`}
                        onClick={(e) => { e.preventDefault(); handleUbah(x, 1, e.currentTarget); }}
                      >
                        {baru === x.$id ? '✓' : '+'}
                      </button>
                    )
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
        {galatKatalog && <p className="msg err" role="status">{galatKatalog} Katalog akan dimuat ulang otomatis.</p>}
        {p && !tampil.length && <p className="kosong">{p.length ? 'Tidak ada produk yang cocok. Coba kata kunci, kategori, atau lapak lain.' : 'Belum ada produk. Mitra yang sudah diverifikasi bisa menambahkannya dari menu Lapak saya.'}</p>}
      </div></section>

      <section className="sec" id="cara"><div className="wrap">
        <h2>Cara belanja</h2><p className="sub">Tiga langkah, dari katalog sampai barang di tanganmu.</p>
        <div className="steps">
          <div className="step"><i>1</i><h3>Pilih produk</h3><p className="muted">Cari di katalog, lalu masukkan ke keranjang atau langsung beli sekarang.</p></div>
          <div className="step"><i>2</i><h3>Bayar dan pesan</h3><p className="muted">Pilih QRIS dengan unggah bukti transfer, atau bayar langsung di lapak.</p></div>
          <div className="step"><i>3</i><h3>Ambil pesanan</h3><p className="muted">Pantau status pesananmu dan ambil dari lapak mitra setelah siap.</p></div>
        </div>
        <section className="denah-beranda" id="denah" aria-labelledby="judul-denah">
          <h2 id="judul-denah">Denah tenant</h2>
          <div className="denah-scroll" tabIndex={0} aria-label="Denah lengkap, geser ke samping pada layar kecil">
            <PetaTenant />
          </div>
        </section>
        {peran !== 'mitra' && (
          <div className="band">
            <div><h2>Punya usaha kecil? Buka lapakmu di sini.</h2><p>Kelola produk, stok, pesanan, dan saldo dalam satu tempat.</p></div>
            <Link href="/mitra/tata-cara" className="btn sun lg">Daftar jadi mitra</Link>
          </div>
        )}
      </div></section>
    </>
  );
}
