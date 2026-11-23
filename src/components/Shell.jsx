'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Logo from '@/components/Logo';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { account, list, Query, rp, ubahJumlahKeranjang } from '@/lib/aw';
import Footer from '@/components/Footer';
import Motion from '@/components/Motion';
import Ikon from '@/components/Ikon';
import Notifikasi from '@/components/Notifikasi';
import { hargaSatuanProduk, itemCocok, stokPilihan } from '@/lib/add-on';
import { bacaKeranjangLokal, simpanKeranjangLokal } from '@/lib/keranjang-lokal';

const Ctx = createContext({});
export const useSaya = () => useContext(Ctx);

export default function Shell({ children }) {
  const [s, setS] = useState({ memuat: true });
  const [t, setT] = useState(null);
  const [keranjang, setKeranjang] = useState([]);
  const versiKeranjang = useRef(0);
  const pil = useRef(null);
  const timer = useRef();
  const path = usePathname();
  const router = useRouter();

  const toast = useCallback((teks, galat = false) => {
    setT({ teks, galat }); clearTimeout(timer.current); timer.current = setTimeout(() => setT(null), 3200);
  }, []);

  const muatKeranjang = useCallback(async (uid) => {
    const versi = ++versiKeranjang.current;
    if (!uid) {
      setKeranjang([]);
      return;
    }
    try {
      const items = await list('item_keranjang', [Query.equal('id_keranjang', uid)]);
      if (versi !== versiKeranjang.current) return;
      setKeranjang(items);
      simpanKeranjangLokal(uid, items);
    } catch {
      // Pertahankan salinan terakhir jika server tidak dapat dijangkau.
    }
  }, []);

  const selesaiCheckout = useCallback((uid, idItem) => {
    if (!idItem.length) return;
    const terpesan = new Set(idItem);
    const tanpaItemTerpesan = (items) => items.filter((item) => !terpesan.has(item.$id));
    setKeranjang(tanpaItemTerpesan);
    const lokal = bacaKeranjangLokal(uid);
    if (lokal) simpanKeranjangLokal(uid, tanpaItemTerpesan(lokal));
    muatKeranjang(uid);
  }, [muatKeranjang]);

  const muat = useCallback(async () => {
    try {
      const data = await account.get();
      if (!data) { setS({ memuat: false }); muatKeranjang(); return; }
      setS({
        akun: { $id: data.$id, name: data.name, email: data.email },
        pengguna: data.pengguna,
        pembeli: data.pembeli,
        mitra: data.mitra,
        admin: data.admin,
        peran: data.peran,
        memuat: false,
      });
      if (data.$id) {
        setKeranjang(bacaKeranjangLokal(data.$id) || []);
        muatKeranjang(data.$id);
      }
    } catch (error) {
      if (error.code === 401) {
        setS({ memuat: false });
        muatKeranjang();
      } else {
        setS((prev) => ({ ...prev, memuat: false }));
        toast(error.message || 'Gagal memeriksa sesi.', true);
      }
    }
  }, [muatKeranjang, toast]);
  useEffect(() => { muat(); }, [muat]);

  // Fungsi tambah / kurangi item keranjang secara instan & reaktif
  const ubahItemKeranjang = useCallback(async (p, delta = 1, addOn = '', catatan = '') => {
    if (!s.akun) {
      router.push('/masuk');
      return 0;
    }

    const cocok = (i) => itemCocok(i, p.$id, addOn, catatan);
    const cur = keranjang.find(cocok);
    const curJml = cur?.jumlah || 0;
    const targetJml = Math.max(0, delta < 0 ? curJml + delta : Math.min(curJml + delta, stokPilihan(p, addOn)));
    const subtotal = targetJml * hargaSatuanProduk(p, addOn);

    // Update optimistik di state lokal
    setKeranjang((prev) => {
      if (targetJml <= 0) {
        return prev.filter((i) => !cocok(i));
      }
      const existing = prev.find(cocok);
      if (existing) {
        return prev.map((i) => (cocok(i) ? { ...i, jumlah: targetJml, subtotal } : i));
      }
      return [...prev, { id_produk: p.$id, add_on: addOn, catatan_item: catatan, id_keranjang: s.akun.$id, jumlah: targetJml, subtotal }];
    });

    try {
      const hasilJml = await ubahJumlahKeranjang(s.akun.$id, p, delta, addOn, catatan);
      if (hasilJml > 0 && delta > 0) {
        toast(`${p.nama} (${hasilJml}) ada di keranjang`);
      } else if (hasilJml === 0 && delta < 0) {
        toast(`${p.nama} dihapus dari keranjang`);
      }
      // Muat ulang untuk memastikan sinkron dengan server
      muatKeranjang(s.akun.$id);
      return hasilJml;
    } catch (err) {
      toast(err.message || 'Gagal memperbarui keranjang', true);
      muatKeranjang(s.akun.$id);
      return null;
    }
  }, [s.akun, s.peran, keranjang, toast, router, muatKeranjang]);

  const totalKeranjang = keranjang.reduce((a, i) => a + (i.subtotal || 0), 0);
  const jumlahKeranjang = keranjang.reduce((a, i) => a + (i.jumlah || 0), 0);

  // pil yang meluncur mengikuti menu yang disorot di navbar desktop
  const sorot = (e) => {
    const a = e.target.closest?.('a:not(.btn):not(.me), button.link');
    const p = pil.current;
    if (!p) return;
    if (!a) { p.style.opacity = 0; return; }
    p.style.opacity = 1; p.style.width = `${a.offsetWidth}px`; p.style.transform = `translateX(${a.offsetLeft}px)`;
  };
  const redup = () => { if (pil.current) pil.current.style.opacity = 0; };

  const keluar = async () => { try { await account.deleteSession({ sessionId: 'current' }); } catch {} location.href = '/'; };
  const perlu = s.pengguna && !s.pengguna.kontak_terverifikasi;

  const nama = s.pengguna?.nama || s.akun?.name || s.akun?.email || '';
  const awal = (nama.trim()[0] || '?').toUpperCase();
  const aktif = (h) => (h === '/' ? path === '/' : path.startsWith(h)) ? 'page' : undefined;

  const tanpaDock = ['/checkout', '/masuk', '/daftar', '/lupa-sandi', '/reset-sandi', '/verifikasi'].includes(path);
  const dock = s.akun ? [
    ['/', 'Katalog', 'home'],
    ...(s.peran === 'mitra' ? [['/mitra', 'Lapak', 'store']] : s.peran === 'admin' ? [['/admin', 'Admin', 'shield']] : []),
    ['/keranjang', 'Keranjang', 'bag'],
    ['/pesanan', 'Pesanan', 'receipt'],
    ['/profil', 'Saya', 'user'],
  ] : [['/', 'Katalog', 'home'], ['/masuk', 'Masuk', 'login']];

  const menuDesktop = dock.filter(([href]) => href !== '/masuk' && href !== '/profil');
  const menuPengguna = (
    s.akun ? (
      <Link href="/profil" className="me" aria-current={aktif('/profil')} aria-label={`Profil ${nama}`}>
        <i>{awal}</i><span>{nama.split(' ')[0]}</span>
      </Link>
    ) : !s.memuat && path !== '/masuk' ? (
      <Link href="/masuk" className="btn sm">Masuk</Link>
    ) : null
  );

  return (
    <Ctx.Provider value={{ ...s, muat, toast, keluar, keranjang, totalKeranjang, jumlahKeranjang, ubahItemKeranjang, muatKeranjang, selesaiCheckout }}>
      <a className="lewati-navigasi" href="#konten-utama">Langsung ke konten</a>
      <Motion />
      {/* ── Desktop header ── */}
      <header className="top">
        <div className="wrap">
          <Link href="/" className="brand"><Logo /></Link>
          {/* Nav desktop */}
          <nav aria-label="Menu utama" className="nav-desktop" onPointerOver={sorot} onPointerLeave={redup} onFocus={sorot} onBlur={redup}>
            <span className="nav-pill" ref={pil} aria-hidden="true" />
            {menuDesktop.map(([href, label]) => <Link key={href} href={href} aria-current={aktif(href)}>{href === '/mitra' ? 'Lapak saya' : label}</Link>)}
            {menuPengguna}
          </nav>
          {s.akun && <Notifikasi key={s.akun.$id} uid={s.akun.$id} peran={s.peran} />}
        </div>
        {t && <div className={'toast' + (t.galat ? ' err' : '')} role="status">{t.teks}</div>}
      </header>

      {perlu && (
        <div className="banner"><div className="wrap">
          <span>Akunmu belum diverifikasi lewat {s.pengguna.kanal === 'WHATSAPP' ? 'WhatsApp' : 'email'}.</span>
          <Link href="/verifikasi" className="btn sm out">Verifikasi sekarang</Link>
        </div></div>
      )}
      <div id="konten-utama" tabIndex={-1}>{children}</div>
      <Footer tampilkanTautanTamu={!s.memuat && !s.akun} />

      {!tanpaDock && !s.memuat && (
        <nav className="dock" aria-label="Menu cepat" style={{ '--n': dock.length }}>
          {dock.map(([h, l, ic]) => (
            <Link key={h} href={h} className="dock-i" aria-current={aktif(h)}>
              <span className="dock-ic">
                <Ikon n={ic} size={22} />
                {h === '/keranjang' && jumlahKeranjang > 0 && <b key={jumlahKeranjang} className="dock-n">{jumlahKeranjang > 99 ? '99+' : jumlahKeranjang}</b>}
              </span>
              <span className="dock-t">{l}</span>
            </Link>
          ))}
        </nav>
      )}

      {/* ── Floating Cart Bar ala ShopeeFood / GoFood ── */}
      {jumlahKeranjang > 0 && !['/keranjang', '/checkout'].includes(path) && (
        <Link href="/keranjang" className="floating-cart-bar" aria-label="Buka keranjang belanja">
          <div className="cart-bar-left">
            <div className="cart-bar-icon-wrap">
              <span className="cart-bar-icon">🛍️</span>
              <span key={jumlahKeranjang} className="cart-bar-badge">{jumlahKeranjang}</span>
            </div>
            <div className="cart-bar-info">
              <span className="cart-bar-qty">{jumlahKeranjang} item di keranjang</span>
              <b key={totalKeranjang} className="cart-bar-total">{rp(totalKeranjang)}</b>
            </div>
          </div>
          <div className="cart-bar-right">
            <span className="cart-bar-btn">
              Lihat Keranjang
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </span>
          </div>
        </Link>
      )}

    </Ctx.Provider>
  );
}
