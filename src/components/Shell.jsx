'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { account, ambil, api } from '@/lib/aw';
import Footer from '@/components/Footer';

const Ctx = createContext({});
export const useSaya = () => useContext(Ctx);

export default function Shell({ children }) {
  const [s, setS] = useState({ memuat: true });
  const [t, setT] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const timer = useRef();
  const pulih = useRef(false);
  const path = usePathname();

  const toast = useCallback((teks, galat = false) => {
    setT({ teks, galat }); clearTimeout(timer.current); timer.current = setTimeout(() => setT(null), 3200);
  }, []);

  const muat = useCallback(async () => {
    try {
      const akun = await account.get();
      const g = (x) => ambil(x, akun.$id).catch(() => null);
      const ambilSemua = () => Promise.all([g('pengguna'), g('pembeli'), g('mitra'), g('admin')]);
      let [pengguna, pembeli, mt, ad] = await ambilSemua();
      let galatProfil = '';
      // Akun sudah login tapi profilnya belum ada atau tidak terbaca: pulihkan otomatis sekali.
      if ((!pengguna || (!pembeli && !mt && !ad)) && !pulih.current) {
        pulih.current = true;
        try { await api('/api/profil', { aksi: 'pulihkan' }); [pengguna, pembeli, mt, ad] = await ambilSemua(); }
        catch (e) { galatProfil = e.message; }
      }
      if (!pengguna && !galatProfil) galatProfil = 'Data profilmu belum bisa dibaca.';
      setS({ akun, pengguna, pembeli, mitra: mt, peran: ad ? 'admin' : mt ? 'mitra' : pembeli ? 'pembeli' : null, galatProfil });
    } catch { setS({}); }
  }, []);
  useEffect(() => { muat(); }, [muat]);

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
      {s.peran === 'mitra' && <Link href="/mitra" onClick={onClick} aria-current={aktif('/mitra')}>Lapak saya</Link>}
      {s.peran === 'admin' && <Link href="/admin" onClick={onClick} aria-current={aktif('/admin')}>Admin</Link>}
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
    <Ctx.Provider value={{ ...s, muat, toast, keluar }}>
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
      {t && <div className={'toast' + (t.galat ? ' err' : '')} role="status">{t.teks}</div>}
    </Ctx.Provider>
  );
}
