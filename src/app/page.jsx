'use client';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { list, Query, rp, img } from '@/lib/aw';
import { useSaya } from '@/components/Shell';
import { PetaTenant } from '@/components/DenahTenant';
import Lapak from '@/components/Lapak';
import PilihAddOn from '@/components/PilihAddOn';
import { kategoriProduk } from '@/lib/kategori';
import Ikon from '@/components/Ikon';
import Logo from '@/components/Logo';
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
let katalogTerakhir;
let permintaanKatalog;

async function muatKatalog(tabel) {
  const batas = 500;
  const ambilHalaman = (offset) => list(tabel, [Query.limit(batas), Query.offset(offset)]);
  const hasil = [...await ambilHalaman(0)];
  if (hasil.length < batas) return hasil;
  const paralel = 4;
  for (let offset = batas; ; offset += batas * paralel) {
    const halaman = await Promise.all(Array.from({ length: paralel }, (_, i) => ambilHalaman(offset + i * batas)));
    for (const batch of halaman) {
      hasil.push(...batch);
      if (batch.length < batas) return hasil;
    }
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

function segarkanKatalog() {
  if (katalogTerakhir && Date.now() - katalogTerakhir.diambil < 10000) return Promise.resolve(katalogTerakhir);
  permintaanKatalog ??= Promise.all([muatKatalog('produk'), muatKatalog('mitra')])
    .then(([ps, ms]) => {
      katalogTerakhir = {
        diambil: Date.now(),
        produk: perbaruiUrutan(katalogTerakhir?.produk, acakDaftar(ps)),
        mitra: perbaruiUrutan(katalogTerakhir?.mitra, acakDaftar(ms)),
      };
      return katalogTerakhir;
    })
    .finally(() => { permintaanKatalog = undefined; });
  return permintaanKatalog;
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

function useKolomProduk() {
  const [kolom, setKolom] = useState(4);
  useEffect(() => {
    const kecil = window.matchMedia('(max-width: 640px)');
    const sedang = window.matchMedia('(max-width: 900px)');
    const ukur = () => setKolom(kecil.matches ? 2 : sedang.matches ? 3 : 4);
    ukur();
    kecil.addEventListener('change', ukur);
    sedang.addEventListener('change', ukur);
    return () => {
      kecil.removeEventListener('change', ukur);
      sedang.removeEventListener('change', ukur);
    };
  }, []);
  return kolom;
}

const ANIMASI_BERANDA = '.searchcard, .sec h2, .sec .sub, .stall, .prod, .step, .denah-beranda, .band';

export default function Beranda() {
  const { akun, peran, keranjang, ubahItemKeranjang } = useSaya();
  const [p, setP] = useState(null);
  const [galatKatalog, setGalatKatalog] = useState('');
  const [m, setM] = useState([]);
  const [q, setQ] = useState('');
  const [k, setK] = useState('');
  const [lapak, setLapak] = useState('');
  const [batasProduk, setBatasProduk] = useState(PRODUK_PER_TAMPIL);
  const [produkAddOn, setProdukAddOn] = useState(null);
  const [baru, setBaru] = useState(null);
  const judulProduk = useRef(null);
  const relLapak = useRef(null);
  const relProduk = useRef(null);
  const ujungProduk = useRef(null);
  const kolomProduk = useKolomProduk();

  useEffect(() => {
    const konten = document.getElementById('konten-utama');
    if (!konten || !('IntersectionObserver' in window)) return;

    const pengamat = new IntersectionObserver((entri) => {
      for (const { target, isIntersecting } of entri) {
        if (!isIntersecting) continue;
        target.setAttribute('data-muncul-beranda', '');
        pengamat.unobserve(target);
      }
    }, { threshold: 0.08 });
    const pindai = (node, tangani) => {
      if (node.matches?.(ANIMASI_BERANDA)) tangani(node);
      node.querySelectorAll?.(ANIMASI_BERANDA).forEach(tangani);
    };
    const amati = (elemen) => {
      if (!elemen.hasAttribute('data-muncul-beranda')) pengamat.observe(elemen);
    };
    pindai(konten, amati);
    const perubahan = new MutationObserver((entri) => {
      for (const { addedNodes, removedNodes } of entri) {
        removedNodes.forEach((node) => pindai(node, (elemen) => pengamat.unobserve(elemen)));
        addedNodes.forEach((node) => {
          if (konten.contains(node)) pindai(node, amati);
        });
      }
    });
    perubahan.observe(konten, { childList: true, subtree: true });

    return () => {
      perubahan.disconnect();
      pengamat.disconnect();
    };
  }, []);

  useEffect(() => {
    let aktif = true;
    if (katalogTerakhir) {
      setP(katalogTerakhir.produk);
      setM(katalogTerakhir.mitra);
    }
    const muat = async () => {
      try {
        const { produk, mitra } = await segarkanKatalog();
        if (!aktif) return;
        setP(produk);
        setM(mitra);
        setGalatKatalog('');
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

  const layananMitra = useMemo(() => new Map(m.map((mitra) => [mitra.$id, mitra])), [m]);
  const kategoriPerProduk = useMemo(() => new Map((p ?? []).map((produk) => [produk.$id, kategoriProduk(produk)])), [p]);
  const kat = useMemo(() => [...new Set([...kategoriPerProduk.values()].flat())].sort((a, b) => a.localeCompare(b, 'id')), [kategoriPerProduk]);
  const lapakAda = useMemo(() => {
    const ids = new Set((p ?? []).map((produk) => produk.id_mitra));
    return m.filter((mitra) => ids.has(mitra.$id));
  }, [p, m]);
  const lapakDipilih = layananMitra.get(lapak);
  const kategori = kat.includes(k) ? k : '';
  const kataCari = q.trim().toLowerCase();
  const nomorCari = kataCari.match(/^(?:tenant\s*)?(\d+)$/)?.[1];
  const { produkCocok, jumlahPerLapak } = useMemo(() => {
    const lapakCocok = new Set(m.filter((x) => x.nama_usaha.toLowerCase().includes(kataCari)
      || (nomorCari && x.nomor_tenant === Number(nomorCari))).map((x) => x.$id));
    const jumlahPerLapak = new Map();
    const produkCocok = (p ?? []).filter((x) => {
      const kelompok = kategoriPerProduk.get(x.$id);
      if (kategori && !kelompok.includes(kategori)) return false;
      if (!lapakCocok.has(x.id_mitra) && !x.nama.toLowerCase().includes(kataCari)
        && !kelompok.some((nama) => nama.toLowerCase().includes(kataCari))) return false;
      jumlahPerLapak.set(x.id_mitra, (jumlahPerLapak.get(x.id_mitra) ?? 0) + 1);
      return true;
    });
    return { produkCocok, jumlahPerLapak };
  }, [p, m, kategoriPerProduk, kategori, kataCari, nomorCari]);
  const hasilLapak = m.filter((x) => jumlahPerLapak.has(x.$id));
  const tampil = lapakDipilih ? produkCocok.filter((x) => x.id_mitra === lapak) : produkCocok;
  const ukuranHalaman = kolomProduk * 3;
  const produkTerlihat = Math.min(tampil.length, batasProduk);
  const halamanProduk = Array.from({ length: Math.ceil(produkTerlihat / ukuranHalaman) },
    (_, i) => tampil.slice(i * ukuranHalaman, Math.min((i + 1) * ukuranHalaman, produkTerlihat)));
  const jumlahHalaman = Math.ceil(tampil.length / ukuranHalaman);
  const keranjangMap = useMemo(() => Object.fromEntries((keranjang || []).filter((i) => !i.add_on).map((i) => [i.id_produk, i.jumlah])), [keranjang]);

  useEffect(() => {
    if (relProduk.current) relProduk.current.scrollLeft = 0;
  }, [kataCari, kategori, lapak]);

  useEffect(() => {
    if (relLapak.current) relLapak.current.scrollLeft = 0;
  }, [kataCari, kategori]);

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
  }, [batasProduk, tampil.length, ukuranHalaman]);

  const pilihKategori = (nilai) => {
    setK(nilai);
    setBatasProduk(PRODUK_PER_TAMPIL);
  };
  const pilihLapak = (id) => {
    setLapak(id);
    if (id) {
      setQ('');
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
      <div className="curtain" aria-hidden="true"><span className="brand"><Logo /></span></div>
      {produkAddOn && <PilihAddOn produk={produkAddOn} onTutup={() => setProdukAddOn(null)} />}
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
          {kat.length > 0 && (
            <div className="kategori-katalog" role="group" aria-label="Kategori produk" tabIndex={0}>
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
        <NavigasiKatalog rel={relProduk} label="produk" jumlah={jumlahHalaman} />
        <div id="rel-produk" ref={relProduk} className="rel-produk rel-kartu-produk" role="region" aria-label="Daftar produk" tabIndex={jumlahHalaman > 1 ? 0 : undefined} style={{ '--kolom-produk': kolomProduk }}>
          {p === null && <div className="halaman-produk">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skel" />)}</div>}
          {halamanProduk.map((halaman, indeks) => (
            <div key={indeks} className="halaman-produk" ref={indeks === halamanProduk.length - 1 && tampil.length > batasProduk ? ujungProduk : null}>
              {halaman.map((x, n) => (
                <article key={x.$id} className="card prod" style={{ '--i': Math.min(n, 12) }}>
                  <Link href={`/produk/${x.$id}`} className="ph" aria-label={x.nama}>
                    {x.id_gambar ? <img src={img(x.id_gambar)} alt="" loading="lazy" decoding="async" /> : <span>{x.nama[0]}</span>}
                    {kategoriPerProduk.get(x.$id)?.length > 0 && <span className="kat">{kategori || kategoriPerProduk.get(x.$id)[0]}</span>}
                    {x.stok < 1 && <em className="habis">Habis</em>}
                    {x.stok > 0 && (x.stok_varian || x.stok <= 5) && <em className="sisa">Sisa {x.stok} pcs</em>}
                  </Link>
                  <div className="pb">
                    <Link href={`/produk/${x.$id}`} className="nm">{x.nama}</Link>
                    <small className="muted">{layananMitra.get(x.id_mitra)?.nama_usaha || 'Mitra'}</small>
                    <small className="muted" style={{ display: 'block' }}>{layananMitra.get(x.id_mitra)?.antar_aktif
                      ? 'Siap diantar + ' + rp(layananMitra.get(x.id_mitra).ongkir) + ' ongkir' : 'Ambil di lapak'}</small>
                    <div className="pf">
                      <span className="tag">{rp(x.harga)}</span>
                      {x.stok > 0 && (
                        x.pilihan_add_on?.length ? (
                          <button type="button" className="plus" aria-label={`Tambah ${x.nama} dan pilih add-on`} onClick={() => setProdukAddOn(x)}>
                            <Ikon n="plus" size={20} />
                          </button>
                        ) : keranjangMap[x.$id] > 0 ? (
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
            </div>
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
          <div className="denah-peta">
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
