'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { account, ambil, api, list, Query, rp, ubahJumlahKeranjang } from '@/lib/aw';
import Footer from '@/components/Footer';
import { bacaKeranjangLokal, simpanKeranjangLokal } from '@/lib/keranjang-lokal';

const Ctx = createContext({});
export const useSaya = () => useContext(Ctx);

export default function Shell({ children }) {
  const [s, setS] = useState({ memuat: true });
  const [t, setT] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [keranjang, setKeranjang] = useState([]);
  const versiKeranjang = useRef(0);
  const timer = useRef();
  const pulih = useRef(false);
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
  const ubahItemKeranjang = useCallback(async (p, delta = 1) => {
    if (!s.akun) {
      router.push('/masuk');
      return 0;
    }

    const cur = keranjang.find((i) => i.id_produk === p.$id);
    const curJml = cur?.jumlah || 0;
    const targetJml = Math.max(0, Math.min(curJml + delta, p.stok || 9999));

    // Update optimistik di state lokal
    setKeranjang((prev) => {
      if (targetJml <= 0) {
        return prev.filter((i) => i.id_produk !== p.$id);
      }
      const existing = prev.find((i) => i.id_produk === p.$id);
      if (existing) {
        return prev.map((i) => (i.id_produk === p.$id ? { ...i, jumlah: targetJml, subtotal: targetJml * p.harga } : i));
      }
      return [...prev, { id_produk: p.$id, id_keranjang: s.akun.$id, jumlah: targetJml, subtotal: targetJml * p.harga }];
    });

    try {
      const hasilJml = await ubahJumlahKeranjang(s.akun.$id, p, delta);
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
      return curJml;
    }
  }, [s.akun, s.peran, keranjang, toast, router, muatKeranjang]);

  const totalKeranjang = keranjang.reduce((a, i) => a + (i.subtotal || 0), 0);
  const jumlahKeranjang = keranjang.reduce((a, i) => a + (i.jumlah || 0), 0);

  // Tutup sidebar saat layar melebar ke desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 700px)');
    const handler = (e) => { if (e.matches) setSidebarOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    const esc = (e) => e.key === 'Escape' && setSidebarOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [sidebarOpen]);

  const keluar = async () => { try { await account.deleteSession({ sessionId: 'current' }); } catch {} location.href = '/'; };
  const tutup = () => setSidebarOpen(false);
  const perlu = s.pengguna && !s.pengguna.kontak_terverifikasi;

  const nama = s.pengguna?.nama || s.akun?.name || s.akun?.email || '';
  const awal = (nama.trim()[0] || '?').toUpperCase();
  const aktif = (h) => (h === '/' ? path === '/' : path.startsWith(h)) ? 'page' : undefined;

  const NavMenu = ({ onClick }) => (
    <>
      <Link href="/" onClick={onClick} aria-current={aktif('/')}>Katalog</Link>
      {s.peran === 'pembeli' && (
        <>
          <Link href="/keranjang" onClick={onClick} aria-current={aktif('/keranjang')}>Keranjang</Link>
          <Link href="/pesanan" onClick={onClick} aria-current={aktif('/pesanan')}>Pesanan</Link>
        </>
      )}
      {s.peran === 'mitra' && (
        <>
          <Link href="/mitra" onClick={onClick} aria-current={aktif('/mitra')}>Lapak saya</Link>
          <Link href="/keranjang" onClick={onClick} aria-current={aktif('/keranjang')}>Keranjang</Link>
          <Link href="/pesanan" onClick={onClick} aria-current={aktif('/pesanan')}>Pesanan</Link>
        </>
      )}
      {s.peran === 'admin' && (
        <>
          <Link href="/admin" onClick={onClick} aria-current={aktif('/admin')}>Admin</Link>
          <Link href="/keranjang" onClick={onClick} aria-current={aktif('/keranjang')}>Keranjang</Link>
          <Link href="/pesanan" onClick={onClick} aria-current={aktif('/pesanan')}>Pesanan</Link>
        </>
      )}
    </>
  );

  const NavUserDesktop = () => (
    s.akun ? (
      <Link href="/profil" className="me" aria-current={aktif('/profil')} aria-label={`Profil ${nama}`}>
        <i>{awal}</i><span>{nama.split(' ')[0]}</span>
      </Link>
    ) : !s.memuat ? (
      <Link href="/masuk" className="btn sm">Masuk</Link>
    ) : null
  );

  const NavUserMobile = ({ onClick }) => (
    s.akun ? (
      <Link href="/profil" className="nav-user-card" onClick={onClick} aria-current={aktif('/profil')}>
        <i className="user-avatar" aria-hidden="true">{awal}</i>
        <div className="user-info">
          <b className="user-name">{nama}</b>
          <span className="user-role">
            {s.peran === 'mitra' ? 'Mitra Lapak' : s.peran === 'admin' ? 'Administrator' : 'Akun Pembeli'} • Profil →
          </span>
        </div>
      </Link>
    ) : !s.memuat ? (
      <Link href="/masuk" className="btn sm" onClick={onClick} style={{ width: '100%', textAlign: 'center' }}>
        Masuk / Daftar Akun
      </Link>
    ) : null
  );

  return (
    <Ctx.Provider value={{ ...s, muat, toast, keluar, keranjang, totalKeranjang, jumlahKeranjang, ubahItemKeranjang, muatKeranjang, selesaiCheckout }}>
      {/* ── Desktop header ── */}
      <header className="top">
        <div className="wrap">
          <Link href="/" className="brand">Lapa<b>KWU</b></Link>
          {/* Nav desktop */}
          <nav aria-label="Menu utama" className="nav-desktop">
            <NavMenu />
            <NavUserDesktop />
          </nav>
          {/* Tombol hamburger mobile */}
          <button
            className="nav-hamburger"
            aria-label="Buka menu"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* ── Mobile sidebar ── */}
      <div className={`nav-overlay${sidebarOpen ? ' open' : ''}`} onClick={tutup} aria-hidden="true" />
      <aside className={`nav-sidebar${sidebarOpen ? ' open' : ''}`} aria-label="Menu navigasi">
        <div className="nav-sidebar-head">
          <Link href="/" className="brand" onClick={tutup}>Lapa<b>KWU</b></Link>
          <button className="nav-close" aria-label="Tutup menu" onClick={tutup}>✕</button>
        </div>
        <nav className="nav-sidebar-body">
          <NavMenu onClick={tutup} />
        </nav>
        <div className="nav-sidebar-foot">
          <NavUserMobile onClick={tutup} />
        </div>
      </aside>
      {perlu && (
        <div className="banner"><div className="wrap">
          <span>Akunmu belum diverifikasi lewat {s.pengguna.kanal === 'WHATSAPP' ? 'WhatsApp' : 'email'}.</span>
          <Link href="/verifikasi" className="btn sm out">Verifikasi sekarang</Link>
        </div></div>
      )}
      <div key={path} className="page">{children}</div>
      <Footer />

      {/* ── Floating Cart Bar ala ShopeeFood / GoFood ── */}
      {jumlahKeranjang > 0 && !['/keranjang', '/checkout'].includes(path) && (
        <Link href="/keranjang" className="floating-cart-bar" aria-label="Buka keranjang belanja">
          <div className="cart-bar-left">
            <div className="cart-bar-icon-wrap">
              <span className="cart-bar-icon">🛍️</span>
              <span className="cart-bar-badge">{jumlahKeranjang}</span>
            </div>
            <div className="cart-bar-info">
              <span className="cart-bar-qty">{jumlahKeranjang} item di keranjang</span>
              <b className="cart-bar-total">{rp(totalKeranjang)}</b>
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

      {t && <div className={'toast' + (t.galat ? ' err' : '')} role="status">{t.teks}</div>}
    </Ctx.Provider>
  );
}
