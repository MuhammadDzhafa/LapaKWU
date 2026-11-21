'use client';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { list, Query, rp, img } from '@/lib/aw';
import { useSaya } from '@/components/Shell';
import { PetaTenant } from '@/components/DenahTenant';
import Lapak from '@/components/Lapak';
import Ikon from '@/components/Ikon';
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
const PRODUK_PER_TAMPIL = 24;

async function muatKatalog(tabel) {
  const hasil = [];
  const batas = 500;
  for (let offset = 0; ; offset += batas) {
    const batch = await list(tabel, [Query.limit(batas), Query.offset(offset)]);
    hasil.push(...batch);
    if (batch.length < batas) return hasil;
  }
}

function acakDaftar(daftar) {
  const hasil = [...daftar];
  for (let i = hasil.length - 1; i > 0; i--) {
    const pilih = Math.floor(Math.random() * (i + 1));
    [hasil[i], hasil[pilih]] = [hasil[pilih], hasil[i]];
  }
  return hasil;
}

function perbaruiUrutan(sebelum, acak) {
  if (!sebelum?.length) return acak;
  const terbaru = new Map(acak.map((item) => [item.$id, item]));
  const urut = [];
  for (const { $id } of sebelum) {
    const item = terbaru.get($id);
    if (item) urut.push(item);
    terbaru.delete($id);
  }
  return [...urut, ...terbaru.values()];
}

function NavigasiKatalog({ rel, label, jumlah }) {
  const geser = (arah) => {
    const elemen = rel.current;
    if (!elemen) return;
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    elemen.scrollBy({ left: arah * elemen.clientWidth, behavior });
  };
  if (jumlah < 2) return null;
  return (
    <div className="navigasi-produk">
      <small className="muted">Geser untuk melihat {label} lainnya</small>
      <button type="button" className="chip" aria-label={`Geser ${label} ke kiri`} aria-controls={`rel-${label}`} onClick={() => geser(-1)}><Ikon n="chevron-left" size={18} /></button>
      <button type="button" className="chip" aria-label={`Geser ${label} ke kanan`} aria-controls={`rel-${label}`} onClick={() => geser(1)}><Ikon n="chevron-right" size={18} /></button>
    </div>
  );
}

export default function Beranda() {
  const { akun, peran, keranjang, ubahItemKeranjang } = useSaya();
  const [p, setP] = useState(null);
  const [galatKatalog, setGalatKatalog] = useState('');
  const [m, setM] = useState([]);
  const [q, setQ] = useState('');
  const [k, setK] = useState('');
  const [lapak, setLapak] = useState('');
  const [batasProduk, setBatasProduk] = useState(PRODUK_PER_TAMPIL);
  const [baru, setBaru] = useState(null);
  const judulProduk = useRef(null);
  const relLapak = useRef(null);
  const relProduk = useRef(null);
  const ujungProduk = useRef(null);

  useEffect(() => {
    let aktif = true;
    let memuat = false;
    const muat = async () => {
      if (memuat) return;
      memuat = true;
      try {
        const [ps, ms] = await Promise.all([muatKatalog('produk'), muatKatalog('mitra')]);
        if (aktif) {
          const produkAcak = acakDaftar(ps);
          const lapakAcak = acakDaftar(ms);
          setP((sebelum) => perbaruiUrutan(sebelum, produkAcak));
          setM((sebelum) => perbaruiUrutan(sebelum, lapakAcak));
          setGalatKatalog('');
        }
      } catch (error) {
        if (aktif) setGalatKatalog(error.message);
      } finally {
        memuat = false;
      }
    };
    muat();
    const t = setInterval(() => { if (!document.hidden) muat(); }, 30000); // stok mengikuti penjualan offline mitra
    return () => {
      aktif = false;
      clearInterval(t);
    };
  }, []);

  const layananMitra = useMemo(() => new Map(m.map((mitra) => [mitra.$id, mitra])), [m]);
  const kat = useMemo(() => [...new Set((p || []).map((x) => x.kategori).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id')), [p]);
  const jumlahPerLapak = useMemo(() => {
    const jumlah = new Map();
    for (const produk of p || []) jumlah.set(produk.id_mitra, (jumlah.get(produk.id_mitra) || 0) + 1);
    return jumlah;
  }, [p]);
  const lapakAda = useMemo(() => m.filter((x) => jumlahPerLapak.has(x.$id)), [m, jumlahPerLapak]);
  const lapakDipilih = layananMitra.get(lapak);
  const kategori = kat.includes(k) ? k : '';
  const kataCari = q.trim().toLowerCase();
  const nomorCari = kataCari.match(/^(?:tenant\s*)?(\d+)$/)?.[1];
  const lapakCocok = new Set(lapakAda.filter((x) => x.nama_usaha.toLowerCase().includes(kataCari) || (nomorCari && x.nomor_tenant === Number(nomorCari))).map((x) => x.$id));
  const produkCocok = (p || []).filter((x) => (!kategori || x.kategori === kategori) && (lapakCocok.has(x.id_mitra) || x.nama.toLowerCase().includes(kataCari)));
  const lapakDariProduk = new Set(produkCocok.map((x) => x.id_mitra));
  const hasilLapak = lapakAda.filter((x) => lapakCocok.has(x.$id) || lapakDariProduk.has(x.$id));
  const tampil = lapakDipilih ? produkCocok.filter((x) => x.id_mitra === lapak) : produkCocok;
  const keranjangMap = useMemo(() => Object.fromEntries((keranjang || []).map((i) => [i.id_produk, i.jumlah])), [keranjang]);

  useEffect(() => {
    if (relProduk.current) relProduk.current.scrollLeft = 0;
  }, [kataCari, kategori, lapak]);

  useEffect(() => {
    if (relLapak.current) relLapak.current.scrollLeft = 0;
  }, [kataCari]);

  useEffect(() => {
    const rel = relProduk.current;
    const ujung = ujungProduk.current;
    if (!rel || !ujung) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        observer.disconnect();
        setBatasProduk((batas) => batas + PRODUK_PER_TAMPIL);
      }
    }, { root: rel, rootMargin: '0px 400px 0px 0px' });
    observer.observe(ujung);
    return () => observer.disconnect();
  }, [batasProduk, tampil.length]);

  const pilihKategori = (nilai) => {
    setK(nilai);
    setBatasProduk(PRODUK_PER_TAMPIL);
  };
  const pilihLapak = (id) => {
    setLapak(id);
    if (id) {
      setQ('');
      setK('');
    }
    setBatasProduk(PRODUK_PER_TAMPIL);
    judulProduk.current?.focus({ preventScroll: true });
    judulProduk.current?.scrollIntoView({ block: 'start' });
  };

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
                <li><b><Hitung ke={kat.length} /></b> kategori</li>
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
            <input type="search" aria-label="Cari produk, lapak, atau nomor tenant" placeholder="Cari produk, lapak, atau tenant" value={q} onChange={(e) => { setQ(e.target.value); setLapak(''); setBatasProduk(PRODUK_PER_TAMPIL); }} />
          </div>
          {kat.length > 8 ? (
            <div className="kategori-katalog field">
              <label htmlFor="kategori-katalog">Kategori produk</label>
              <select id="kategori-katalog" value={kategori} onChange={(e) => pilihKategori(e.target.value)}>
                <option value="">Semua kategori</option>
                {kat.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          ) : kat.length > 0 && (
            <div className="chips" role="group" aria-label="Kategori produk">
              {['', ...kat].map((c) => <button type="button" key={c} className={'chip' + (c === kategori ? ' on' : '')} aria-pressed={c === kategori} onClick={() => pilihKategori(c)}>{c || 'Semua'}</button>)}
            </div>
          )}
        </div>
      </div>

      {lapakAda.length > 0 && (
        <section className="sec" id="mitra"><div className="wrap">
          <h2>Lapak mitra <span className="jml">{hasilLapak.length}</span></h2>
          <NavigasiKatalog rel={relLapak} label="lapak" jumlah={hasilLapak.length} />
          <div id="rel-lapak" ref={relLapak} className="rel-produk stalls" role="region" aria-label="Daftar lapak yang dapat digeser" tabIndex={hasilLapak.length > 1 ? 0 : undefined}>
            {hasilLapak.map((x) => (
              <button type="button" key={x.$id} className={'stall' + (lapak === x.$id ? ' on' : '')} aria-pressed={lapak === x.$id} onClick={() => pilihLapak(lapak === x.$id ? '' : x.$id)}>
                <div><b>{x.nama_usaha}</b><small>{x.nomor_tenant != null && `Tenant ${x.nomor_tenant} · `}{jumlahPerLapak.get(x.$id)} produk</small></div>
              </button>
            ))}
          </div>
          {!hasilLapak.length && <p className="kosong" role="status">Tidak ada lapak yang cocok.</p>}
        </div></section>
      )}

      <section className="sec"><div className="wrap">
        <h2 ref={judulProduk} tabIndex={-1} className="judul-katalog">{lapakDipilih ? `Produk ${lapakDipilih.nama_usaha}` : 'Semua produk'}{p && <span className="jml" aria-label={`${tampil.length} produk`}>{tampil.length}</span>}</h2>
        {lapakDipilih && <button type="button" className="chip hapus-filter-lapak" onClick={() => pilihLapak('')}>Lihat produk semua lapak</button>}
        <NavigasiKatalog rel={relProduk} label="produk" jumlah={tampil.length} />
        <div id="rel-produk" ref={relProduk} className="rel-produk rel-kartu-produk" role="region" aria-label="Daftar produk yang dapat digeser" tabIndex={tampil.length > 1 ? 0 : undefined}>
          {p === null && Array.from({ length: 6 }, (_, i) => <div key={i} className="skel" />)}
          {tampil.slice(0, batasProduk).map((x, n) => (
            <article key={x.$id} className="card prod" style={{ '--i': Math.min(n, 12) }}>
              <Link href={`/produk/${x.$id}`} className="ph" aria-label={x.nama}>
                {x.id_gambar ? <img src={img(x.id_gambar)} alt="" loading="lazy" /> : <span>{x.nama[0]}</span>}
                {x.kategori && <span className="kat">{x.kategori}</span>}
                {x.stok < 1 && <em className="habis">Habis</em>}
                {x.stok > 0 && x.stok <= 5 && <em className="sisa">Sisa {x.stok}</em>}
              </Link>
              <div className="pb">
                <Link href={`/produk/${x.$id}`} className="nm">{x.nama}</Link>
                <small className="muted">{layananMitra.get(x.id_mitra)?.nama_usaha || 'Mitra'}</small>
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
                          <Ikon n="minus" size={16} />
                        </button>
                        <span className="step-num">{keranjangMap[x.$id]}</span>
                        <button
                          type="button"
                          className="step-btn plus-btn"
                          aria-label={`Tambah ${x.nama}`}
                          disabled={keranjangMap[x.$id] >= x.stok}
                          onClick={(e) => { e.preventDefault(); handleUbah(x, 1, e.currentTarget); }}
                        >
                          <Ikon n="plus" size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={'plus' + (baru === x.$id ? ' ok' : '')}
                        aria-label={`Tambah ${x.nama} ke keranjang`}
                        onClick={(e) => { e.preventDefault(); handleUbah(x, 1, e.currentTarget); }}
                      >
                        <Ikon n={baru === x.$id ? 'check' : 'plus'} size={20} />
                      </button>
                    )
                  )}
                </div>
              </div>
            </article>
          ))}
          {tampil.length > batasProduk && <span ref={ujungProduk} className="ujung-produk" aria-hidden="true" />}
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
